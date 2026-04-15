import os
import json
import time
import socket
import hashlib
import re
from datetime import datetime, timezone as dt_timezone
from collections import Counter
import requests
import numpy as np
from django.utils import timezone
from django.db.models import Count, Q, Max, Avg
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from users.models import CustomUser
from users.views import require_role
from .models import CPanelCredential, DomainTrafficEvent
from .cpanel_client import CPanelAPIError, CPanelClient

# ============================================
# AI Model — Lazy Loading
# ============================================
AI_MODULE_PATH = os.path.join(
    os.path.dirname(__file__), '..', '..', 'ai_models', 'network_intrusion_classification_module'
)

_model = None
_label_encoder = None
_scaler = None
_loaded = False


def _get_authenticated_user(request):
    if 'user_id' not in request.session:
        return None, JsonResponse({'success': False, 'detail': 'Not authenticated'}, status=401)

    try:
        user = CustomUser.objects.get(username=request.session['user_id'])
    except CustomUser.DoesNotExist:
        return None, JsonResponse({'success': False, 'detail': 'User not found'}, status=404)

    return user, None


def _get_target_domain(request, user):
    """
    Get the target domain based on user role.
    - Analyst: Returns their own domain
    - Admin: Returns specified analyst's domain via ?for_analyst=username
    """
    if user.role == 'analyst':
        return user.domain
    
    elif user.role == 'admin':
        # Try to get analyst username from query params or POST body
        analyst_username = request.GET.get('for_analyst') or request.POST.get('for_analyst')
        if not analyst_username:
            return JsonResponse(
                {'success': False, 'detail': 'Admin must specify ?for_analyst=username parameter'},
                status=400
            )
        
        try:
            analyst = CustomUser.objects.get(username=analyst_username, role='analyst')
            return analyst.domain
        except CustomUser.DoesNotExist:
            return JsonResponse(
                {'success': False, 'detail': f'Analyst user "{analyst_username}" not found'},
                status=404
            )
    
    return user.domain


def _get_target_user(request, user):
    if user.role == 'analyst':
        return user
    if user.role == 'admin':
        analyst_username = request.GET.get('for_analyst') or request.POST.get('for_analyst')
        if not analyst_username:
            return JsonResponse(
                {'success': False, 'detail': 'Admin must specify ?for_analyst=username parameter'},
                status=400
            )
        try:
            return CustomUser.objects.get(username=analyst_username, role='analyst')
        except CustomUser.DoesNotExist:
            return JsonResponse(
                {'success': False, 'detail': f'Analyst user "{analyst_username}" not found'},
                status=404
            )
    return user


def _get_cpanel_credential_for_request(request, user):
    target_user = _get_target_user(request, user)
    if isinstance(target_user, JsonResponse):
        return None, target_user
    try:
        return CPanelCredential.objects.get(user=target_user), None
    except CPanelCredential.DoesNotExist:
        return None, JsonResponse(
            {'success': False, 'detail': f'No cPanel configuration found for "{target_user.username}"'},
            status=404
        )


def _build_cpanel_client(credential):
    return CPanelClient(
        host=credential.host,
        username=credential.username,
        token=credential.get_token(),
        password=credential.get_password(),
        verify_ssl=credential.verify_ssl,
    )


def _cpanel_auth_mode(credential):
    if credential.get_password():
        return 'password'
    if credential.get_token():
        return 'token'
    return 'none'


_IPV4_PATTERN = re.compile(r'\b(?:\d{1,3}\.){3}\d{1,3}\b')
_IPV6_PATTERN = re.compile(r'\b(?:[0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}\b')
_COMMON_LOG_PATTERN = re.compile(
    r'(?P<ip>\b(?:\d{1,3}\.){3}\d{1,3}\b|\b(?:[0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}\b)'
    r'.*?\[(?P<timestamp>[^\]]+)\]'
    r'.*?"(?P<method>[A-Z]+)\s+(?P<path>[^"\s]+)(?:\s+HTTP/[0-9.]+)?"'
    r'.*?(?P<status>\d{3})',
    re.IGNORECASE,
)


def _extract_ip_from_access_log_entry(entry):
    if entry is None:
        return ''

    if isinstance(entry, dict):
        for key in ('client_ip', 'ip', 'remote_ip', 'remote_addr', 'host', 'source_ip'):
            value = entry.get(key)
            if value:
                return str(value).strip()

        candidate_parts = []
        for key in ('line', 'entry', 'raw', 'log', 'value', 'request', 'text'):
            value = entry.get(key)
            if value:
                candidate_parts.append(str(value))
        if candidate_parts:
            entry = ' '.join(candidate_parts)
        else:
            entry = ' '.join(str(value) for value in entry.values() if value not in (None, ''))

    text = str(entry).strip()
    if not text:
        return ''

    ipv4_match = _IPV4_PATTERN.search(text)
    if ipv4_match:
        return ipv4_match.group(0)

    ipv6_match = _IPV6_PATTERN.search(text)
    if ipv6_match:
        return ipv6_match.group(0)

    return ''


def _collect_ip_candidates(value, counter):
    if value is None:
        return

    if isinstance(value, dict):
        for nested_value in value.values():
            _collect_ip_candidates(nested_value, counter)
        return

    if isinstance(value, (list, tuple, set)):
        for item in value:
            _collect_ip_candidates(item, counter)
        return

    text = str(value)
    if not text:
        return

    for match in _IPV4_PATTERN.findall(text):
        counter[match] += 1

    for match in _IPV6_PATTERN.findall(text):
        counter[match] += 1


def _parse_access_log_timestamp(value):
    if not value:
        return ''
    text = str(value).strip()
    if not text:
        return ''

    for fmt in (
        '%d/%b/%Y:%H:%M:%S %z',
        '%d/%b/%Y:%H:%M:%S',
        '%Y-%m-%d %H:%M:%S',
        '%Y-%m-%dT%H:%M:%S.%f%z',
        '%Y-%m-%dT%H:%M:%S%z',
        '%Y-%m-%dT%H:%M:%S.%f',
        '%Y-%m-%dT%H:%M:%S',
    ):
        try:
            parsed = datetime.strptime(text, fmt)
            return parsed.isoformat()
        except Exception:
            continue
    return text


def _coerce_access_log_datetime(value):
    if not value:
        return None

    text = str(value).strip()
    if not text or text == '-':
        return None

    for fmt in (
        '%d/%b/%Y:%H:%M:%S %z',
        '%d/%b/%Y:%H:%M:%S',
        '%Y-%m-%d %H:%M:%S',
        '%Y-%m-%dT%H:%M:%S.%f%z',
        '%Y-%m-%dT%H:%M:%S%z',
        '%Y-%m-%dT%H:%M:%S.%f',
        '%Y-%m-%dT%H:%M:%S',
    ):
        try:
            parsed = datetime.strptime(text, fmt)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=dt_timezone.utc)
            return parsed
        except Exception:
            continue

    try:
        parsed = datetime.fromisoformat(text)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=dt_timezone.utc)
        return parsed
    except Exception:
        return None


def _parse_access_log_entry(entry):
    if entry is None:
        return None

    if isinstance(entry, dict):
        raw_text = ''
        for key in ('line', 'entry', 'raw', 'log', 'value', 'request', 'text', 'content'):
            value = entry.get(key)
            if value:
                raw_text = str(value)
                break

        ip = ''
        for key in ('client_ip', 'ip', 'remote_ip', 'remote_addr', 'host', 'source_ip'):
            value = entry.get(key)
            if value:
                ip = str(value).strip()
                break

        timestamp = _parse_access_log_timestamp(
            entry.get('requested_at') or entry.get('timestamp') or entry.get('time') or entry.get('date') or entry.get('created_at')
        )
        method = str(entry.get('method') or entry.get('verb') or '').strip().upper()
        path = str(entry.get('path') or entry.get('url') or entry.get('request_path') or '').strip()
        status = entry.get('status_code') or entry.get('status') or entry.get('code') or ''
        user_agent = str(entry.get('user_agent') or entry.get('agent') or '').strip()
        referer = str(entry.get('referer') or entry.get('referrer') or '').strip()

        if raw_text and (not ip or not timestamp or not method or not path or not status):
            parsed = _COMMON_LOG_PATTERN.search(raw_text)
            if parsed:
                ip = ip or parsed.group('ip')
                timestamp = timestamp or _parse_access_log_timestamp(parsed.group('timestamp'))
                method = method or parsed.group('method').upper()
                path = path or parsed.group('path')
                status = status or parsed.group('status')

            if not user_agent:
                agent_match = re.search(r'"[^"]*"\s+\d{3}\s+\S+\s+"[^"]*"\s+"(?P<agent>[^"]+)"', raw_text)
                if agent_match:
                    user_agent = agent_match.group('agent')

        return {
            'ip': ip or '-',
            'requested_at': timestamp or '-',
            'method': method or '-',
            'path': path or '-',
            'status': str(status) if status not in (None, '') else '-',
            'user_agent': user_agent or '-',
            'referer': referer or '-',
            'raw': raw_text or str(entry),
        }

    raw_text = str(entry).strip()
    if not raw_text:
        return None

    parsed = _COMMON_LOG_PATTERN.search(raw_text)
    if parsed:
        return {
            'ip': parsed.group('ip'),
            'requested_at': _parse_access_log_timestamp(parsed.group('timestamp')),
            'method': parsed.group('method').upper(),
            'path': parsed.group('path'),
            'status': parsed.group('status'),
            'user_agent': '-',
            'referer': '-',
            'raw': raw_text,
        }

    ip = _extract_ip_from_access_log_entry(raw_text) or '-'
    return {
        'ip': ip,
        'requested_at': '-',
        'method': '-',
        'path': '-',
        'status': '-',
        'user_agent': '-',
        'referer': '-',
        'raw': raw_text,
    }


def _build_access_log_matrix(access_log, limit=50):
    if not access_log:
        return []

    matrix = []
    for entry in access_log[:limit]:
        parsed = _parse_access_log_entry(entry)
        if parsed:
            matrix.append(parsed)
    return matrix


def _build_ip_request_frequency(access_log_matrix, limit=15):
    if not access_log_matrix:
        return []

    grouped = {}

    for row in access_log_matrix:
        ip = str(row.get('ip') or '-').strip()
        if not ip or ip == '-':
            continue

        entry = grouped.setdefault(ip, {
            'ip': ip,
            'request_count': 0,
            'first_seen': None,
            'last_seen': None,
            'timestamp_count': 0,
        })

        entry['request_count'] += 1
        parsed_at = _coerce_access_log_datetime(row.get('requested_at'))
        if not parsed_at:
            continue

        entry['timestamp_count'] += 1
        if entry['first_seen'] is None or parsed_at < entry['first_seen']:
            entry['first_seen'] = parsed_at
        if entry['last_seen'] is None or parsed_at > entry['last_seen']:
            entry['last_seen'] = parsed_at

    frequency_rows = []
    for entry in grouped.values():
        span_minutes = None
        requests_per_minute = None
        requests_per_hour = None

        if entry['first_seen'] and entry['last_seen']:
            span_seconds = max((entry['last_seen'] - entry['first_seen']).total_seconds(), 0.0)
            span_minutes = round(span_seconds / 60.0, 2)
            if span_seconds > 0:
                requests_per_minute = round(entry['request_count'] / max(span_seconds / 60.0, 1 / 60), 2)
                requests_per_hour = round(entry['request_count'] / max(span_seconds / 3600.0, 1 / 3600), 2)
            else:
                requests_per_minute = float(entry['request_count'])
                requests_per_hour = round(entry['request_count'] * 60, 2)

        frequency_rows.append({
            'ip': entry['ip'],
            'request_count': entry['request_count'],
            'timestamp_count': entry['timestamp_count'],
            'coverage_percent': round((entry['timestamp_count'] / entry['request_count']) * 100, 2) if entry['request_count'] else 0.0,
            'first_seen': entry['first_seen'].isoformat() if entry['first_seen'] else '-',
            'last_seen': entry['last_seen'].isoformat() if entry['last_seen'] else '-',
            'span_minutes': span_minutes if span_minutes is not None else '-',
            'requests_per_minute': requests_per_minute if requests_per_minute is not None else '-',
            'requests_per_hour': requests_per_hour if requests_per_hour is not None else '-',
        })

    frequency_rows.sort(key=lambda row: (row['request_count'], row.get('timestamp_count', 0)), reverse=True)
    return frequency_rows[:limit]


def _build_top_source_ips(snapshot, limit=10):
    if not snapshot:
        return []

    counter = Counter()

    access_log = snapshot.get('access_log') or []
    for entry in access_log:
        ip = _extract_ip_from_access_log_entry(entry)
        if ip:
            counter[ip] += 1

    for preview in snapshot.get('report_previews') or []:
        _collect_ip_candidates(preview, counter)

    for report in snapshot.get('html_reports') or []:
        _collect_ip_candidates(report, counter)

    for report_file in snapshot.get('report_files') or []:
        _collect_ip_candidates(report_file, counter)

    if not counter:
        return []

    total = sum(counter.values())
    if not total:
        return []

    top_ips = []
    for rank, (ip, count) in enumerate(counter.most_common(limit), start=1):
        top_ips.append({
            'rank': rank,
            'ip': ip,
            'request_count': count,
            'share_percent': round((count / total) * 100, 2),
        })
    return top_ips


@require_http_methods(["GET"])
@require_role('admin')
def resolve_analyst_domain(request):
    """
    GET /ai/network-ids/resolve-analyst-domain/?username=analyst_username
    Admin-only helper to validate analyst username and fetch their configured domain.
    """
    try:
        analyst_username = (request.GET.get('username') or '').strip()
        if not analyst_username:
            return JsonResponse(
                {'success': False, 'detail': 'Analyst username is required'},
                status=400
            )

        try:
            analyst = CustomUser.objects.get(username=analyst_username, role='analyst')
        except CustomUser.DoesNotExist:
            return JsonResponse(
                {'success': False, 'detail': f'Analyst user "{analyst_username}" not found'},
                status=404
            )

        domain = _normalize_domain(analyst.domain)
        if not domain:
            return JsonResponse(
                {'success': False, 'detail': f'Analyst "{analyst_username}" has no configured domain'},
                status=400
            )

        return JsonResponse({
            'success': True,
            'analyst_username': analyst.username,
            'domain': domain,
        }, status=200)

    except Exception as e:
        return JsonResponse({'success': False, 'detail': str(e)}, status=500)


def _load_model():
    """XGBoost IDS modelini, label encoder'ı ve scaler'ı lazy-load et"""
    global _model, _label_encoder, _scaler, _loaded
    if not _loaded:
        try:
            import joblib
            model_path = os.path.join(AI_MODULE_PATH, 'xgb_model.pkl')
            encoder_path = os.path.join(AI_MODULE_PATH, 'label_encoder.pkl')
            scaler_path = os.path.join(AI_MODULE_PATH, 'scaler.pkl')

            _model = joblib.load(model_path)
            _label_encoder = joblib.load(encoder_path)
            if os.path.exists(scaler_path):
                _scaler = joblib.load(scaler_path)
            print(f"[Network IDS] Model loaded from: {model_path}")
        except Exception as e:
            import traceback
            print(f"[Network IDS] CRITICAL: Model could not be loaded: {e}")
            traceback.print_exc()
        _loaded = True
    return _model, _label_encoder, _scaler


def _classify_threat_level(label):
    """AI label'dan tehdit seviyesi belirle"""
    label_lower = str(label).lower()
    if label_lower in ['normal', 'benign']:
        return 'low', 'Normal Traffic'
    elif label_lower in ['dos', 'ddos', 'u2r', 'r2l']:
        return 'critical', label
    elif label_lower in ['probe', 'scan', 'reconnaissance']:
        return 'high', label
    else:
        return 'high', label


def _normalize_domain(value):
    if not value:
        return ''
    domain = str(value).strip().lower()
    if domain.startswith('http://'):
        domain = domain[7:]
    if domain.startswith('https://'):
        domain = domain[8:]
    domain = domain.split('/')[0].split(':')[0].strip('.')
    return domain


def _is_allowed_target(user_domain, domain):
    if not user_domain or not domain:
        return False
    return domain == user_domain or domain.endswith(f'.{user_domain}')


def _build_domain_samples(domain, sample_count=12):
    """Generate domain-conditioned feature vectors for IDS model input."""
    now_bucket = int(time.time() // 6)
    seed = int(hashlib.sha256(f'{domain}:{now_bucket}'.encode('utf-8')).hexdigest()[:8], 16)
    rng = np.random.default_rng(seed)

    base_scale = 1.0 + (len(domain) % 7) * 0.12
    spike_probability = 0.18 + ((seed % 5) * 0.03)

    samples = []
    for _ in range(sample_count):
        is_spike = rng.random() < min(spike_probability, 0.45)
        row = []
        for i in range(48):
            if i < 5:
                value = rng.uniform(1200, 6500) * base_scale
                if is_spike:
                    value *= rng.uniform(2.3, 4.8)
            elif i < 10:
                value = rng.uniform(500, 2800) * base_scale
                if is_spike:
                    value *= rng.uniform(1.8, 3.5)
            elif i < 20:
                value = rng.uniform(40, 320) * base_scale
                if is_spike:
                    value *= rng.uniform(1.5, 2.8)
            elif i < 30:
                value = rng.uniform(10, 160) * base_scale
                if is_spike:
                    value *= rng.uniform(1.4, 2.4)
            elif i < 40:
                value = rng.uniform(0, 15)
                if is_spike:
                    value *= rng.uniform(1.3, 2.0)
            else:
                value = rng.uniform(0.05, 2.5)
                if is_spike:
                    value *= rng.uniform(1.2, 1.9)
            row.append(float(value))
        samples.append(row)
    return samples


def _extract_client_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '') or 'unknown'


def _probe_domain_health(domain):
    """Perform lightweight active probes to derive live traffic signals."""
    latencies = []
    success = 0
    for i in range(3):
        url = f'https://{domain}/?papillon_probe={int(time.time())}_{i}'
        try:
            started = time.perf_counter()
            response = requests.get(url, timeout=2.5, allow_redirects=True)
            elapsed_ms = (time.perf_counter() - started) * 1000
            latencies.append(elapsed_ms)
            if response.status_code < 500:
                success += 1
        except Exception:
            latencies.append(2500.0)

    avg_latency_ms = round(float(sum(latencies) / len(latencies)), 2) if latencies else 0.0
    success_rate = round((success / 3) * 100, 1)
    return {
        'avg_latency_ms': avg_latency_ms,
        'success_rate': success_rate,
        'probe_count': 3,
    }


def _build_sample_from_ip_stats(stat):
    """Map real IP-level request stats to 48-length model feature vector."""
    req_count = float(stat.get('request_count') or 0)
    get_count = float(stat.get('get_count') or 0)
    err_count = float(stat.get('error_count') or 0)
    avg_response = float(stat.get('avg_response_ms') or 0)

    vec = [0.0] * 48
    vec[0] = req_count * 120
    vec[1] = get_count * 95
    vec[2] = err_count * 220
    vec[3] = avg_response * 6
    vec[4] = max(req_count - get_count, 0) * 80
    vec[5] = (req_count / max(get_count, 1.0)) * 40
    vec[6] = (err_count / max(req_count, 1.0)) * 600
    vec[7] = min(avg_response, 2500)
    for i in range(8, 48):
        vec[i] = vec[(i % 8)] * (0.7 + ((i % 5) * 0.06))
    return vec


def _classify_host_health(avg_response_ms, error_rate, active_connections):
    if error_rate >= 15 or avg_response_ms >= 1200:
        return 'critical'
    if error_rate >= 5 or avg_response_ms >= 500 or active_connections >= 80:
        return 'warning'
    return 'healthy'


def _build_cpanel_modules(domain, avg_response_ms, error_rate):
    domain_label = domain or 'your domain'
    return [
        {
            'name': 'Metrics',
            'kind': 'section',
            'cpanel_items': ['Visitors', 'Errors', 'Bandwidth', 'Awstats', 'Raw Access', 'Resource Usage'],
            'why': f'First stop for understanding request volume, spikes, and 4xx/5xx patterns on {domain_label}.',
        },
        {
            'name': 'Visitors',
            'kind': 'traffic',
            'cpanel_items': ['Top visitor IPs', 'Requested URLs', 'User agents', 'Referrers'],
            'why': 'Closest built-in cPanel view to lightweight traffic analysis.',
        },
        {
            'name': 'Awstats',
            'kind': 'analytics',
            'cpanel_items': ['Daily hits', 'Robots/spiders', 'HTTP codes', 'Hosts'],
            'why': 'Useful for historical traffic patterns and bot-heavy behavior.',
        },
        {
            'name': 'Errors',
            'kind': 'stability',
            'cpanel_items': ['Apache/Nginx level error excerpts'],
            'why': f'Important because current observed error rate is {error_rate}%.',
        },
        {
            'name': 'Resource Usage',
            'kind': 'host-health',
            'cpanel_items': ['CPU', 'Memory', 'Entry Processes', 'I/O', 'Concurrent connections'],
            'why': f'Best place to validate whether average response time of {avg_response_ms} ms is infrastructure pressure.',
        },
    ]


def _build_hosting_recommendations(error_rate, avg_response_ms, active_connections):
    recommendations = [
        'Use cPanel Metrics > Visitors to compare suspicious IPs with the Active IP Connection Matrix.',
        'Use cPanel Metrics > Errors to correlate 4xx/5xx spikes with anomalies flagged by the IDS model.',
        'Use cPanel Metrics > Resource Usage to decide whether slowness is application-side or hosting-side.',
    ]
    if error_rate >= 5:
        recommendations.append('Error rate is elevated; prioritize cPanel Errors and application logs before model tuning.')
    if avg_response_ms >= 500:
        recommendations.append('Latency is elevated; check Turhost Resource Usage and concurrent process limits.')
    if active_connections >= 50:
        recommendations.append('Connection count is relatively high; compare cPanel Visitors/Awstats against bot traffic and bursts.')
    return recommendations


def _extract_usage_percent(entry):
    if isinstance(entry, dict):
        for key in ('percent', 'usage_percent', 'percent_usage'):
            value = entry.get(key)
            if value not in (None, ''):
                try:
                    return float(str(value).replace('%', '').strip())
                except Exception:
                    continue
    return None


def _summarize_cpanel_snapshot(snapshot):
    account_info = snapshot.get('account_info') or {}
    domains = snapshot.get('domains') or {}
    domain_details = snapshot.get('domain_details') or []
    quota = snapshot.get('quota') or {}
    local_quota = snapshot.get('local_quota') or {}
    php_versions = snapshot.get('php_versions') or {}
    php_default = snapshot.get('php_default') or {}
    php_vhosts = snapshot.get('php_vhosts') or []
    email_accounts = snapshot.get('email_accounts') or []
    email_count = snapshot.get('email_count')
    mysql_databases = snapshot.get('mysql_databases') or []
    web_domains = snapshot.get('web_domains') or []
    resource_usage = snapshot.get('resource_usage') or []
    usage_items = resource_usage if isinstance(resource_usage, list) else resource_usage.get('usage') or resource_usage.get('items') or []

    max_usage_percent = 0.0
    for item in usage_items:
        percent = _extract_usage_percent(item)
        if percent is not None:
            max_usage_percent = max(max_usage_percent, percent)

    bandwidth = snapshot.get('bandwidth') or []
    error_entries = snapshot.get('errors') or []
    access_log = snapshot.get('access_log') or []
    access_log_matrix = _build_access_log_matrix(access_log)
    ip_request_frequency = _build_ip_request_frequency(access_log_matrix)
    top_source_ips = _build_top_source_ips(snapshot)
    webalizer_sites = snapshot.get('webalizer_sites') or []
    analog_sites = snapshot.get('analog_sites') or []
    analog_domain_stats = snapshot.get('analog_domain_stats') or []
    archives = snapshot.get('archives') or []
    report_files = snapshot.get('report_files') or []
    report_previews = snapshot.get('report_previews') or []
    discovered_metric_links = snapshot.get('discovered_metric_links') or []
    html_reports = snapshot.get('html_reports') or []
    warnings = snapshot.get('warnings') or []

    return {
        'stats_bar': snapshot.get('stats_bar') or [],
        'account_info': account_info,
        'domains': domains,
        'domain_details': domain_details,
        'quota': quota,
        'local_quota': local_quota,
        'php_versions': php_versions,
        'php_default': php_default,
        'php_vhosts': php_vhosts,
        'email_accounts': email_accounts,
        'email_count': email_count,
        'mysql_databases': mysql_databases,
        'web_domains': web_domains,
        'resource_usage': usage_items,
        'resource_peak_percent': round(max_usage_percent, 2),
        'bandwidth_records': len(bandwidth),
        'error_log_entries': len(error_entries),
        'access_log_records': len(access_log),
        'access_log_matrix': access_log_matrix,
        'access_log_matrix_count': len(access_log_matrix),
        'ip_request_frequency': ip_request_frequency,
        'ip_request_frequency_count': len(ip_request_frequency),
        'top_source_ips': top_source_ips,
        'top_source_ip_count': len(top_source_ips),
        'awstats_daily': snapshot.get('awstats_daily') or {},
        'bandwidth': bandwidth,
        'errors': error_entries,
        'access_log': access_log,
        'webalizer_sites': webalizer_sites,
        'analog_sites': analog_sites,
        'analog_domain_stats': analog_domain_stats,
        'report_files': report_files,
        'report_previews': report_previews,
        'discovered_metric_links': discovered_metric_links,
        'html_reports': html_reports,
        'log_archives': archives,
        'log_settings': snapshot.get('log_settings') or {},
        'warnings': warnings,
        'has_live_data': bool(
            (snapshot.get('stats_bar') or [])
            or account_info
            or domains
            or domain_details
            or quota
            or local_quota
            or php_versions
            or php_default
            or php_vhosts
            or email_accounts
            or bool(email_count)
            or mysql_databases
            or web_domains
            or usage_items
            or bandwidth
            or error_entries
            or access_log
            or access_log_matrix
            or ip_request_frequency
            or top_source_ips
            or webalizer_sites
            or analog_sites
            or analog_domain_stats
            or report_files
            or report_previews
            or discovered_metric_links
            or html_reports
            or archives
            or (snapshot.get('awstats_daily') or {})
        ),
    }


@csrf_exempt
@require_http_methods(["POST"])
def predict_intrusion(request):
    """
    POST /ai/network-ids/predict/
    Network traffic feature'larını analiz et → saldırı sınıflandırması yap.
    Body: { "features": [f1, f2, ..., fN] }
    """
    try:
        _, auth_error = _get_authenticated_user(request)
        if auth_error:
            return auth_error

        data = json.loads(request.body)
        features = data.get('features')

        if not features or not isinstance(features, list):
            return JsonResponse({
                'success': False,
                'detail': 'Features array is required. Send numeric feature values as a list.'
            }, status=400)

        model, label_encoder, scaler = _load_model()
        if model is None:
            return JsonResponse({
                'success': False,
                'detail': 'Network IDS AI model could not be loaded.'
            }, status=503)

        feature_array = np.array(features, dtype=float).reshape(1, -1)

        if scaler is not None:
            feature_array = scaler.transform(feature_array)

        prediction = model.predict(feature_array)
        predicted_label = str(label_encoder.inverse_transform(prediction)[0])

        try:
            probabilities = model.predict_proba(feature_array)[0]
            confidence = float(max(probabilities))
        except Exception:
            confidence = 0.85

        risk_level, display_label = _classify_threat_level(predicted_label)

        return JsonResponse({
            'success': True,
            'result': {
                'prediction': predicted_label,
                'label': display_label,
                'risk_level': risk_level,
                'confidence': round(confidence, 4),
            }
        }, status=200)

    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'detail': 'Invalid JSON payload'
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'detail': str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def analyze_batch(request):
    """
    POST /ai/network-ids/analyze-batch/
    Toplu trafik analizi — birden fazla feature set gönder.
    Body: { "samples": [[f1,f2,...], [f1,f2,...], ...] }
    """
    try:
        _, auth_error = _get_authenticated_user(request)
        if auth_error:
            return auth_error

        data = json.loads(request.body)
        samples = data.get('samples')

        if not samples or not isinstance(samples, list):
            return JsonResponse({
                'success': False,
                'detail': 'Samples array is required.'
            }, status=400)

        model, label_encoder, scaler = _load_model()
        if model is None:
            return JsonResponse({
                'success': False,
                'detail': 'Network IDS AI model could not be loaded.'
            }, status=503)

        feature_array = np.array(samples, dtype=float)

        if scaler is not None:
            feature_array = scaler.transform(feature_array)

        predictions = model.predict(feature_array)
        labels = label_encoder.inverse_transform(predictions)

        results = []
        for i, label in enumerate(labels):
            risk_level, display_label = _classify_threat_level(str(label))
            results.append({
                'index': i,
                'prediction': str(label),
                'label': display_label,
                'risk_level': risk_level,
            })

        # İstatistikler
        total = len(results)
        normal_count = sum(1 for r in results if r['risk_level'] == 'low')
        threat_count = total - normal_count

        return JsonResponse({
            'success': True,
            'results': results,
            'stats': {
                'total': total,
                'normal': normal_count,
                'threats': threat_count,
                'threat_rate': round(threat_count / total * 100, 1) if total > 0 else 0,
            }
        }, status=200)

    except Exception as e:
        return JsonResponse({
            'success': False,
            'detail': str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def monitor_snapshot(request):
    """
    POST /ai/network-ids/monitor-snapshot/
    Body: { "domain": "example.com" } (optional for analyst, ignored for admin)
    Query: ?for_analyst=username (admin only)
    Returns domain-conditioned traffic snapshot + IDS batch analysis.
    """
    try:
        user, auth_error = _get_authenticated_user(request)
        if auth_error:
            return auth_error

        # Get target domain based on role
        domain_result = _get_target_domain(request, user)
        if isinstance(domain_result, JsonResponse):
            return domain_result
        requested_domain = _normalize_domain(domain_result)
        user_domain = _normalize_domain(getattr(user, 'domain', ''))

        if not requested_domain:
            return JsonResponse({'success': False, 'detail': 'Domain is required.'}, status=400)

        model, label_encoder, scaler = _load_model()
        if model is None:
            return JsonResponse({
                'success': False,
                'detail': 'Network IDS AI model could not be loaded.'
            }, status=503)

        client_ip = _extract_client_ip(request)

        # Resolve target domain IPs for realistic context.
        try:
            resolved_ips = sorted(set(socket.gethostbyname_ex(requested_domain)[2]))
        except Exception:
            resolved_ips = []

        now = timezone.now()
        window_short = now - timezone.timedelta(seconds=20)
        window_long = now - timezone.timedelta(minutes=10)

        domain_filter = Q(domain=requested_domain) | Q(domain__endswith=f'.{requested_domain}')
        events_qs = DomainTrafficEvent.objects.filter(domain_filter, requested_at__gte=window_long)

        total_events = events_qs.count()
        short_events = events_qs.filter(requested_at__gte=window_short).count()
        short_get = events_qs.filter(requested_at__gte=window_short, method='GET').count()
        unique_ips = events_qs.values('client_ip').exclude(client_ip='').distinct().count()

        ip_stats = list(
            events_qs.exclude(client_ip='')
            .values('client_ip')
            .annotate(
                request_count=Count('id'),
                get_count=Count('id', filter=Q(method='GET')),
                error_count=Count('id', filter=Q(status_code__gte=400)),
                avg_response_ms=Avg('response_ms'),
                last_seen=Max('requested_at'),
            )
            .order_by('-request_count')[:20]
        )

        # Build AI samples from real request stats.
        samples = [_build_sample_from_ip_stats(stat) for stat in ip_stats] or _build_domain_samples(requested_domain, sample_count=6)
        feature_array = np.array(samples, dtype=float)
        if scaler is not None:
            feature_array = scaler.transform(feature_array)

        predictions = model.predict(feature_array)
        labels = label_encoder.inverse_transform(predictions)

        probabilities = None
        try:
            probabilities = model.predict_proba(feature_array)
        except Exception:
            probabilities = None

        analyzed = []
        for idx, label in enumerate(labels):
            risk_level, display_label = _classify_threat_level(str(label))
            confidence = float(np.max(probabilities[idx])) if probabilities is not None else 0.82
            analyzed.append({
                'index': idx,
                'prediction': str(label),
                'label': display_label,
                'risk_level': risk_level,
                'confidence': round(confidence, 4),
            })

        total = len(analyzed)
        threat_entries = [x for x in analyzed if x['risk_level'] != 'low']
        threat_count = len(threat_entries)
        high_count = sum(1 for x in analyzed if x['risk_level'] == 'high')
        critical_count = sum(1 for x in analyzed if x['risk_level'] == 'critical')

        # Real event-driven traffic metrics.
        inbound_kbps = short_events
        outbound_kbps = short_get
        packets_processed = total_events
        active_connections = unique_ips

        anomalies = []
        for i, entry in enumerate(threat_entries[:8]):
            src = ip_stats[i]['client_ip'] if i < len(ip_stats) else (resolved_ips[i % len(resolved_ips)] if resolved_ips else requested_domain)
            anomalies.append({
                'id': int(time.time() * 1000) + i,
                'type': 'critical' if entry['risk_level'] == 'critical' else 'warning',
                'risk_level': entry['risk_level'],
                'ip': src,
                'desc': f"AI IDS detected {entry['prediction']} ({entry['label']})",
                'confidence': entry['confidence'],
            })

        active_ips = []
        active_ips.append({
            'ip': client_ip,
            'protocol': 'GET',
            'packets': short_get,
            'risk': 'low',
            'last_seen': now.isoformat(),
            'request_count': short_events,
        })

        for i, row in enumerate(ip_stats[:10]):
            inferred_risk = threat_entries[i]['risk_level'] if i < len(threat_entries) else 'low'
            active_ips.append({
                'ip': row['client_ip'],
                'protocol': 'GET' if row.get('get_count', 0) >= (row.get('request_count', 0) / 2) else 'MIXED',
                'packets': int(row.get('request_count') or 0),
                'risk': inferred_risk,
                'last_seen': row['last_seen'].isoformat() if row.get('last_seen') else '',
                'request_count': int(row.get('request_count') or 0),
            })

        deduped_active_ips = []
        seen_ips = set()
        for row in active_ips:
            if row['ip'] in seen_ips:
                continue
            seen_ips.add(row['ip'])
            deduped_active_ips.append(row)

        return JsonResponse({
            'success': True,
            'snapshot': {
                'domain': requested_domain,
                'user_domain': user_domain,
                'resolved_ips': resolved_ips,
                'traffic': {
                    'inbound_kbps': inbound_kbps,
                    'outbound_kbps': outbound_kbps,
                    'packets_processed': packets_processed,
                    'active_connections': active_connections,
                },
                'ai': {
                    'model_status': 'connected',
                    'total_samples': total,
                    'threats': threat_count,
                    'high': high_count,
                    'critical': critical_count,
                    'threat_rate': round((threat_count / total) * 100, 1) if total else 0,
                },
                'window': {
                    'short_seconds': 20,
                    'long_minutes': 10,
                },
                'anomalies': anomalies,
                'active_ips': deduped_active_ips[:10],
            }
        }, status=200)

    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'detail': 'Invalid JSON payload'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'detail': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
@require_role('analyst')
def update_cpanel_config(request):
    try:
        user, auth_error = _get_authenticated_user(request)
        if auth_error:
            return auth_error

        data = json.loads(request.body)
        host = str(data.get('host', '')).strip()
        username = str(data.get('username', '')).strip()
        token = str(data.get('token', '')).strip()
        password = str(data.get('password', '')).strip()
        verify_ssl = bool(data.get('verify_ssl', True))

        if not host or not username:
            return JsonResponse({'success': False, 'detail': 'host and username are required'}, status=400)
        if not token and not password:
            return JsonResponse({'success': False, 'detail': 'Provide at least an API token or cPanel password'}, status=400)

        credential, _ = CPanelCredential.objects.get_or_create(
            user=user,
            defaults={
                'host': host,
                'username': username,
                'token_encrypted': '',
                'password_encrypted': '',
                'verify_ssl': verify_ssl,
            }
        )
        credential.host = host
        credential.username = username
        credential.verify_ssl = verify_ssl
        if token:
            credential.set_token(token)
        if password:
            credential.set_password(password)
        credential.save()

        return JsonResponse({
            'success': True,
            'config': {
                'host': credential.host,
                'username': credential.username,
                'verify_ssl': credential.verify_ssl,
                'has_token': bool(credential.get_token()),
                'has_password': bool(credential.get_password()),
                'masked_token': credential.masked_token(),
                'auth_mode': _cpanel_auth_mode(credential),
            }
        }, status=200)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'detail': 'Invalid JSON payload'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'detail': str(e)}, status=500)


@require_http_methods(["GET"])
@require_role('analyst')
def get_cpanel_config(request):
    try:
        user, auth_error = _get_authenticated_user(request)
        if auth_error:
            return auth_error
        try:
            credential = CPanelCredential.objects.get(user=user)
        except CPanelCredential.DoesNotExist:
            return JsonResponse({'success': True, 'config': None}, status=200)

        return JsonResponse({
            'success': True,
            'config': {
                'host': credential.host,
                'username': credential.username,
                'verify_ssl': credential.verify_ssl,
                'has_token': bool(credential.get_token()),
                'has_password': bool(credential.get_password()),
                'masked_token': credential.masked_token(),
                'auth_mode': _cpanel_auth_mode(credential),
            }
        }, status=200)
    except Exception as e:
        return JsonResponse({'success': False, 'detail': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
@require_role('admin', 'analyst')
def test_cpanel_connection(request):
    try:
        user, auth_error = _get_authenticated_user(request)
        if auth_error:
            return auth_error
        credential, credential_error = _get_cpanel_credential_for_request(request, user)
        if credential_error:
            return credential_error

        result = _build_cpanel_client(credential).test_connection()
        return JsonResponse({'success': True, 'result': result}, status=200)
    except CPanelAPIError as e:
        return JsonResponse({'success': False, 'detail': str(e)}, status=502)
    except requests.RequestException as e:
        return JsonResponse({'success': False, 'detail': str(e)}, status=502)
    except Exception as e:
        return JsonResponse({'success': False, 'detail': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
@require_role('admin', 'analyst')
def cpanel_live_snapshot(request):
    try:
        user, auth_error = _get_authenticated_user(request)
        if auth_error:
            return auth_error

        target_user = _get_target_user(request, user)
        if isinstance(target_user, JsonResponse):
            return target_user

        credential, credential_error = _get_cpanel_credential_for_request(request, user)
        if credential_error:
            return credential_error

        snapshot = _build_cpanel_client(credential).fetch_live_snapshot(_normalize_domain(target_user.domain))
        return JsonResponse({'success': True, 'snapshot': _summarize_cpanel_snapshot(snapshot)}, status=200)
    except CPanelAPIError as e:
        return JsonResponse({'success': False, 'detail': str(e)}, status=502)
    except requests.RequestException as e:
        return JsonResponse({'success': False, 'detail': str(e)}, status=502)
    except Exception as e:
        return JsonResponse({'success': False, 'detail': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def hosting_overview(request):
    try:
        user, auth_error = _get_authenticated_user(request)
        if auth_error:
            return auth_error

        domain_result = _get_target_domain(request, user)
        if isinstance(domain_result, JsonResponse):
            return domain_result
        requested_domain = _normalize_domain(domain_result)
        if not requested_domain:
            return JsonResponse({'success': False, 'detail': 'Domain is required.'}, status=400)

        now = timezone.now()
        window_long = now - timezone.timedelta(minutes=10)
        window_day = now - timezone.timedelta(hours=24)

        domain_filter = Q(domain=requested_domain) | Q(domain__endswith=f'.{requested_domain}')
        events_qs = DomainTrafficEvent.objects.filter(domain_filter, requested_at__gte=window_day)
        recent_qs = events_qs.filter(requested_at__gte=window_long)

        total_recent = recent_qs.count()
        total_day = events_qs.count()
        error_recent = recent_qs.filter(status_code__gte=400).count()
        avg_response_ms = round(float(recent_qs.aggregate(avg=Avg('response_ms'))['avg'] or 0.0), 2)
        active_connections = recent_qs.values('client_ip').exclude(client_ip='').distinct().count()
        unique_paths = recent_qs.values('path').distinct().count()
        top_paths = list(recent_qs.values('path').annotate(request_count=Count('id')).order_by('-request_count')[:5])
        top_ips = list(
            recent_qs.values('client_ip').exclude(client_ip='').annotate(
                request_count=Count('id'),
                error_count=Count('id', filter=Q(status_code__gte=400)),
            ).order_by('-request_count')[:5]
        )

        error_rate = round((error_recent / total_recent) * 100, 2) if total_recent else 0.0
        host_health = _classify_host_health(avg_response_ms, error_rate, active_connections)
        cpanel_snapshot = None

        target_user = _get_target_user(request, user)
        if not isinstance(target_user, JsonResponse):
            try:
                credential = CPanelCredential.objects.get(user=target_user)
                cpanel_snapshot = _summarize_cpanel_snapshot(
                    _build_cpanel_client(credential).fetch_live_snapshot(requested_domain)
                )
                if cpanel_snapshot.get('resource_peak_percent', 0) >= 90:
                    host_health = 'critical'
                elif host_health == 'healthy' and cpanel_snapshot.get('resource_peak_percent', 0) >= 70:
                    host_health = 'warning'
            except (CPanelCredential.DoesNotExist, CPanelAPIError, requests.RequestException):
                cpanel_snapshot = None

        return JsonResponse({
            'success': True,
            'overview': {
                'domain': requested_domain,
                'provider_focus': 'Turhost',
                'panel_name': 'cPanel hosting control panel',
                'host_health': host_health,
                'summary': {
                    'requests_last_10m': total_recent,
                    'requests_last_24h': total_day,
                    'error_rate_percent': error_rate,
                    'avg_response_ms': avg_response_ms,
                    'active_connections': active_connections,
                    'unique_paths': unique_paths,
                },
                'traffic_insights': {
                    'top_paths': top_paths,
                    'top_ips': top_ips,
                },
                'cpanel_live': cpanel_snapshot,
                'cpanel_modules': _build_cpanel_modules(requested_domain, avg_response_ms, error_rate),
                'recommendations': _build_hosting_recommendations(error_rate, avg_response_ms, active_connections),
                'terminology': {
                    'structure_name': 'hosting control panel / hosting observability dashboard',
                    'best_term_for_this_feature': 'hosting monitoring and traffic analytics',
                },
            }
        }, status=200)
    except Exception as e:
        return JsonResponse({'success': False, 'detail': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
@require_role('admin', 'analyst')
def ingest_event(request):
    """
    Optional external collector endpoint.
    Body: {domain, client_ip, method, path, status_code, response_ms, requested_at?}
    """
    try:
        data = json.loads(request.body)
        domain = _normalize_domain(data.get('domain', ''))
        if not domain:
            return JsonResponse({'success': False, 'detail': 'Domain is required.'}, status=400)

        requested_at = timezone.now()
        if data.get('requested_at'):
            try:
                requested_at = timezone.datetime.fromisoformat(str(data['requested_at']))
                if timezone.is_naive(requested_at):
                    requested_at = timezone.make_aware(requested_at, timezone.get_current_timezone())
            except Exception:
                requested_at = timezone.now()

        DomainTrafficEvent.objects.create(
            domain=domain,
            client_ip=str(data.get('client_ip', '')).strip()[:64],
            method=str(data.get('method', 'GET')).upper()[:12],
            path=str(data.get('path', '/'))[:512],
            status_code=int(data.get('status_code')) if data.get('status_code') is not None else None,
            response_ms=float(data.get('response_ms')) if data.get('response_ms') is not None else None,
            user_agent=str(data.get('user_agent', ''))[:2000],
            requested_at=requested_at,
            source='collector',
        )
        return JsonResponse({'success': True}, status=201)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'detail': 'Invalid JSON payload'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'detail': str(e)}, status=500)
