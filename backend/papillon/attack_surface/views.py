import os
import sys
import socket
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import os
import sys
import socket
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json
from users.models import CustomUser

# Add the tools directory to path (relative to this file)
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'attack_surface_analysis_tools'))


def _normalize_domain(value):
    """Normalize a domain-like value for comparison."""
    if not value:
        return ''
    value = value.strip().lower()
    if value.startswith('http://'):
        value = value[7:]
    elif value.startswith('https://'):
        value = value[8:]
    value = value.split('/')[0].split(':')[0].strip('.')
    return value


def _is_allowed_target(user_domain, target_domain):
    """Allow exact domain or any subdomain of user's registered domain."""
    base = _normalize_domain(user_domain)
    target = _normalize_domain(target_domain)
    if not base or not target:
        return False
    return target == base or target.endswith('.' + base)


def _get_authenticated_user(request):
    if 'user_id' not in request.session:
        return None, JsonResponse({'success': False, 'detail': 'Not authenticated'}, status=401)
    try:
        return CustomUser.objects.get(username=request.session['user_id']), None
    except CustomUser.DoesNotExist:
        return None, JsonResponse({'success': False, 'detail': 'User not found'}, status=404)


def _get_target_domain(request, user):
    """
    Get the target domain based on user role.
    - Analyst: Returns their own domain
    - Admin: Returns specified analyst's domain via ?for_analyst=username
    """
    if user.role == 'analyst':
        return user.domain
    
    elif user.role == 'admin':
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


@csrf_exempt
@require_http_methods(["POST"])
def attack_surface_scan(request):
    try:
        user, auth_error = _get_authenticated_user(request)
        if auth_error:
            return auth_error

        # Get target domain based on role
        domain_result = _get_target_domain(request, user)
        if isinstance(domain_result, JsonResponse):
            return domain_result
        domain = _normalize_domain(domain_result)

        if not domain:
            return JsonResponse({'success': False, 'detail': 'Domain is required. Please configure in Profile or pass ?for_analyst=username as Admin.'}, status=400)

        # Resolve domain to IP
        try:
            ip = socket.gethostbyname(domain)
        except socket.gaierror:
            return JsonResponse({'success': False, 'detail': 'Invalid domain or unable to resolve'}, status=400)

        results = {
            'domain': domain,
            'ip': ip,
            'dns_records': [],
            'subdomains': [],
            'whois': [],
            'ssl_info': {},
            'open_ports': [],
            'emails': [],
            'admin_panels': [],
            'robots_txt': '',
            'ip_info': {}
        }

        # DNS Records (lazy import)
        try:
            from dns_records import get_records  # type: ignore
            results['dns_records'] = get_records(domain)
        except Exception as e:
            results['dns_records'] = [{'error': 'dns lookup unavailable: ' + str(e)}]

        # Subdomains
        try:
            from subdomain_finder import get_subdomains  # type: ignore
            results['subdomains'] = get_subdomains(domain)
        except Exception as e:
            results['subdomains'] = [{'error': 'subdomain enumeration unavailable: ' + str(e)}]

        # Whois
        try:
            from whois_search import get_whois  # type: ignore
            results['whois'] = get_whois(domain)
        except Exception as e:
            results['whois'] = [{'error': 'whois lookup unavailable: ' + str(e)}]

        # SSL Scan
        try:
            from ssl_scanner import scan_ssl_cert  # type: ignore
            ssl_result, validity = scan_ssl_cert(domain)
            results['ssl_info'] = {'data': ssl_result, 'valid': validity}
        except Exception as e:
            results['ssl_info'] = {'error': 'ssl scan unavailable: ' + str(e)}

        # Port Scan
        try:
            from port_scanner import scan_ports  # type: ignore
            ports = scan_ports(ip)
            results['open_ports'] = [{'port': p, 'service': s} for p, s in ports]
        except Exception as e:
            results['open_ports'] = [{'error': 'port scan unavailable: ' + str(e)}]

        # Email Harvesting
        try:
            from email_harvester import harvest_emails  # type: ignore
            emails = harvest_emails(domain)
            results['emails'] = emails
        except Exception as e:
            results['emails'] = [{'error': 'email harvesting unavailable: ' + str(e)}]

        # Admin Panel Scan
        try:
            from admin_panel_scanner import find_admin_panels  # type: ignore
            panels = find_admin_panels(domain)
            results['admin_panels'] = panels
        except Exception as e:
            results['admin_panels'] = [{'error': 'admin panel scan unavailable: ' + str(e)}]

        # Robots.txt
        try:
            from robots_parser import get_robots_txt  # type: ignore
            robots = get_robots_txt(domain)
            results['robots_txt'] = robots
        except Exception as e:
            results['robots_txt'] = 'robots fetch unavailable: ' + str(e)

        # IP Info (basic)
        try:
            from ip_address import get_ip  # type: ignore
            ip_info = get_ip(domain)
            results['ip_info'] = ip_info
        except Exception as e:
            results['ip_info'] = {'error': 'ip info unavailable: ' + str(e)}

        return JsonResponse({'success': True, 'results': results})

    except Exception as e:
        return JsonResponse({'success': False, 'detail': str(e)}, status=500)
