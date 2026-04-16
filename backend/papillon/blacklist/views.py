import os
import re
import json

import requests
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from .models import BlacklistedIP
from users.models import CustomUser


# IPv4, IPv6, CIDR validasyonu
IP_REGEX = re.compile(
    r'^(\d{1,3}\.){3}\d{1,3}(/\d{1,2})?$'           # IPv4 + CIDR
    r'|^([0-9a-fA-F]{1,4}:){1,7}[0-9a-fA-F]{1,4}'   # IPv6
    r'(/\d{1,3})?$'                                    # IPv6 CIDR
)


def _get_authenticated_user(request):
    if 'user_id' not in request.session:
        return None, JsonResponse({'success': False, 'detail': 'Not authenticated'}, status=401)
    try:
        return CustomUser.objects.get(username=request.session['user_id']), None
    except CustomUser.DoesNotExist:
        return None, JsonResponse({'success': False, 'detail': 'User not found'}, status=404)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def blacklist_list_create(request):
    """
    GET  /blacklist/     — Tüm blacklist'i listele
    POST /blacklist/     — Yeni IP ekle
    """
    user, auth_error = _get_authenticated_user(request)
    if auth_error:
        return auth_error

    if request.method == "GET":
        entries = BlacklistedIP.objects.all()
        data = [{
            'id': e.id,
            'ip_address': e.ip_address,
            'reason': e.reason,
            'blocked_by': e.blocked_by,
            'created_at': e.created_at.isoformat(),
        } for e in entries]

        return JsonResponse({
            'success': True,
            'count': len(data),
            'blacklist': data,
        }, status=200)

    # POST — Yeni IP ekle
    try:
        body = json.loads(request.body)
        ip_address = body.get('ip_address', '').strip()
        reason = body.get('reason', '').strip() or 'Manual block'

        if not ip_address:
            return JsonResponse({
                'success': False,
                'detail': 'ip_address field is required.'
            }, status=400)

        if not IP_REGEX.match(ip_address):
            return JsonResponse({
                'success': False,
                'detail': 'Invalid IP address format. IPv4, IPv6, or CIDR expected.'
            }, status=400)

        # Duplicate kontrol
        if BlacklistedIP.objects.filter(ip_address=ip_address).exists():
            return JsonResponse({
                'success': False,
                'detail': f'{ip_address} is already in the blacklist.'
            }, status=409)

        entry = BlacklistedIP.objects.create(
            ip_address=ip_address,
            reason=reason,
            blocked_by=user.username,
        )

        return JsonResponse({
            'success': True,
            'detail': f'{ip_address} added to blacklist.',
            'entry': {
                'id': entry.id,
                'ip_address': entry.ip_address,
                'reason': entry.reason,
                'blocked_by': entry.blocked_by,
                'created_at': entry.created_at.isoformat(),
            }
        }, status=201)

    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'detail': 'Invalid JSON payload.'
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'detail': str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def blacklist_abuseipdb_lookup(request):
    """
    POST /blacklist/abuseipdb/
    Body: { "ip_address": "1.2.3.4" }
    """
    try:
        user, auth_error = _get_authenticated_user(request)
        if auth_error:
            return auth_error

        api_key = (os.getenv('ABUSEIPDB_KEY') or '').strip()
        if not api_key:
            return JsonResponse({
                'success': False,
                'detail': 'ABUSEIPDB_KEY is not configured.'
            }, status=503)

        body = json.loads(request.body)
        ip_address = body.get('ip_address', '').strip()
        max_age_days = body.get('max_age_days', 90)

        if not ip_address:
            return JsonResponse({
                'success': False,
                'detail': 'ip_address field is required.'
            }, status=400)

        if not IP_REGEX.match(ip_address):
            return JsonResponse({
                'success': False,
                'detail': 'Invalid IP address format. IPv4, IPv6, or CIDR expected.'
            }, status=400)

        response = requests.get(
            'https://api.abuseipdb.com/api/v2/check',
            headers={
                'Key': api_key,
                'Accept': 'application/json',
            },
            params={
                'ipAddress': ip_address,
                'maxAgeInDays': max_age_days,
                'verbose': 'true',
            },
            timeout=20,
        )
        response.raise_for_status()

        payload = response.json() or {}
        data = payload.get('data') or {}

        result = {
            'ip_address': data.get('ipAddress') or ip_address,
            'abuse_confidence_score': data.get('abuseConfidenceScore'),
            'total_reports': data.get('totalReports'),
            'num_distinct_users': data.get('numDistinctUsers'),
            'country_code': data.get('countryCode') or '-',
            'usage_type': data.get('usageType') or '-',
            'isp': data.get('isp') or '-',
            'domain': data.get('domain') or '-',
            'is_public': data.get('isPublic'),
            'last_reported_at': data.get('lastReportedAt') or '-',
        }

        return JsonResponse({
            'success': True,
            'result': result,
            'raw': data,
        }, status=200)

    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'detail': 'Invalid JSON payload.'
        }, status=400)
    except requests.HTTPError as exc:
        detail = 'AbuseIPDB request failed.'
        try:
            payload = exc.response.json()
            detail = payload.get('errors', [{}])[0].get('detail') or payload.get('message') or detail
        except Exception:
            pass
        return JsonResponse({'success': False, 'detail': detail}, status=502)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'detail': str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["DELETE"])
def blacklist_delete(request, pk):
    """
    DELETE /blacklist/<id>/ — IP'yi blacklist'ten kaldır
    """
    try:
        _, auth_error = _get_authenticated_user(request)
        if auth_error:
            return auth_error

        entry = BlacklistedIP.objects.get(pk=pk)
        ip = entry.ip_address
        entry.delete()
        return JsonResponse({
            'success': True,
            'detail': f'{ip} removed from blacklist.'
        }, status=200)
    except BlacklistedIP.DoesNotExist:
        return JsonResponse({
            'success': False,
            'detail': 'Entry not found.'
        }, status=404)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'detail': str(e)
        }, status=500)
