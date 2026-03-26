import time
from .models import DomainTrafficEvent


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


def _extract_client_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '') or ''


class DomainTrafficLoggingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        started = time.perf_counter()
        response = self.get_response(request)

        path = request.path or ''
        if path.startswith('/static/') or path.startswith('/admin/'):
            return response
        if path.startswith('/ai/network-ids/monitor-snapshot/') or path.startswith('/ai/network-ids/ingest-event/'):
            return response
        if path.startswith('/favicon'):
            return response

        domain = _normalize_domain(request.get_host())
        if not domain:
            return response

        elapsed_ms = (time.perf_counter() - started) * 1000
        try:
            DomainTrafficEvent.objects.create(
                domain=domain,
                client_ip=_extract_client_ip(request),
                method=(request.method or 'GET')[:12],
                path=(request.get_full_path() or path)[:512],
                status_code=getattr(response, 'status_code', None),
                response_ms=round(elapsed_ms, 3),
                user_agent=(request.META.get('HTTP_USER_AGENT', '') or '')[:2000],
                source='middleware',
            )
        except Exception:
            # Logging must never break request lifecycle.
            pass

        return response
