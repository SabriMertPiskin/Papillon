import uuid
import json
import requests
from datetime import timedelta
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from users.models import CustomUser
from users.views import require_role

# In-memory skeleton state. Later, this will be replaced by your friend's VM orchestrator integration.
_MACHINE_SESSIONS = {}
VM_AGENT_BASE_URL = 'http://localhost:5001'


def _get_authenticated_user(request):
    if 'user_id' not in request.session:
        return None, JsonResponse({'success': False, 'detail': 'Not authenticated'}, status=401)

    try:
        user = CustomUser.objects.get(username=request.session['user_id'])
    except CustomUser.DoesNotExist:
        return None, JsonResponse({'success': False, 'detail': 'User not found'}, status=404)

    return user, None


def _build_machine_payload(state):
    if not state:
        return {
            'running': False,
            'machine_id': None,
            'started_at': None,
            'expires_at': None,
            'connection': None,
            'detail': 'Machine is not running.',
        }

    return {
        'running': state['running'],
        'machine_id': state['machine_id'],
        'started_at': state['started_at'].isoformat() if state.get('started_at') else None,
        'expires_at': state['expires_at'].isoformat() if state.get('expires_at') else None,
        'connection': state.get('connection'),
        'detail': state.get('detail', ''),
    }


def _resolve_target_user(request, user):
    """
    Resolve VM owner user based on role.
    - Analyst: acts on own VM.
    - Admin: must provide for_analyst and target analyst must have domain.
    """
    if user.role == 'analyst':
        return user, None

    if user.role == 'admin':
        for_analyst = (request.GET.get('for_analyst') or '').strip()
        if request.method == 'POST' and not for_analyst:
            try:
                data = json.loads(request.body or '{}')
                for_analyst = (data.get('for_analyst') or '').strip()
            except Exception:
                for_analyst = ''

        if not for_analyst:
            return None, JsonResponse(
                {'success': False, 'detail': 'Admin must specify for_analyst username'},
                status=400
            )

        try:
            analyst = CustomUser.objects.get(username=for_analyst, role='analyst')
        except CustomUser.DoesNotExist:
            return None, JsonResponse(
                {'success': False, 'detail': f'Analyst user "{for_analyst}" not found'},
                status=404
            )

        if not (analyst.domain or '').strip():
            return None, JsonResponse(
                {'success': False, 'detail': f'Analyst "{for_analyst}" has no configured domain'},
                status=400
            )

        return analyst, None

    return None, JsonResponse({'success': False, 'detail': 'Access denied'}, status=403)


def _trigger_vm_agent(action, vm_lab_path=None):
    """Trigger external local Flask VM agent endpoints."""
    endpoint_map = {
        'start': '/start-vm',
        'stop': '/stop-vm',
    }
    path = endpoint_map.get(action)
    if not path:
        return False, 'Unknown VM agent action.'

    try:
        request_kwargs = {'timeout': 4}
        if vm_lab_path and action in ('start', 'stop'):
            request_kwargs['params'] = {'path': vm_lab_path}

        response = requests.get(f'{VM_AGENT_BASE_URL}{path}', **request_kwargs)
        if response.status_code >= 400:
            return False, f'VM agent returned HTTP {response.status_code}'
        return True, response.text.strip() or 'ok'
    except requests.RequestException as exc:
        return False, f'Could not reach VM agent at {VM_AGENT_BASE_URL}{path}: {exc}'


@require_http_methods(["GET"])
def machine_status(request):
    user, auth_error = _get_authenticated_user(request)
    if auth_error:
        return auth_error

    target_user, target_error = _resolve_target_user(request, user)
    if target_error:
        return target_error

    state = _MACHINE_SESSIONS.get(target_user.username)
    if state and state.get('expires_at') and timezone.now() >= state['expires_at']:
        _MACHINE_SESSIONS.pop(target_user.username, None)
        state = None

    return JsonResponse({
        'success': True,
        'machine': _build_machine_payload(state),
    }, status=200)


@csrf_exempt
@require_http_methods(["POST"])
@require_role('admin', 'analyst')
def start_machine(request):
    user, auth_error = _get_authenticated_user(request)
    if auth_error:
        return auth_error

    target_user, target_error = _resolve_target_user(request, user)
    if target_error:
        return target_error

    existing = _MACHINE_SESSIONS.get(target_user.username)
    if existing and existing.get('running'):
        return JsonResponse({
            'success': True,
            'machine': _build_machine_payload(existing),
            'detail': 'Machine is already running.',
        }, status=200)

    vm_lab_path = (target_user.vm_lab_path or '').strip()
    if not vm_lab_path:
        return JsonResponse({
            'success': False,
            'detail': 'Please save your VM Lab path in Profile & Account first.',
        }, status=400)

    agent_ok, agent_detail = _trigger_vm_agent('start', vm_lab_path)
    if not agent_ok:
        return JsonResponse({
            'success': False,
            'detail': f'VM start trigger failed. {agent_detail}',
        }, status=502)

    # Skeleton machine boot output. Replace this block with external orchestrator call later.
    now = timezone.now()
    new_state = {
        'running': True,
        'machine_id': f"vm-{uuid.uuid4().hex[:8]}",
        'started_at': now,
        'expires_at': now + timedelta(hours=2),
        'vm_lab_path': vm_lab_path,
        'connection': {
            'ip': '127.0.0.1',
            'host': 'vm.placeholder.tryhackme.local',
            'port': 22,
            'protocol': 'ssh',
        },
        'detail': f'Machine booted successfully. Agent response: {agent_detail}',
    }
    _MACHINE_SESSIONS[target_user.username] = new_state

    return JsonResponse({
        'success': True,
        'machine': _build_machine_payload(new_state),
        'detail': new_state['detail'],
    }, status=200)


@csrf_exempt
@require_http_methods(["POST"])
@require_role('admin', 'analyst')
def terminate_machine(request):
    user, auth_error = _get_authenticated_user(request)
    if auth_error:
        return auth_error

    target_user, target_error = _resolve_target_user(request, user)
    if target_error:
        return target_error

    existing = _MACHINE_SESSIONS.get(target_user.username)
    if not existing or not existing.get('running'):
        return JsonResponse({
            'success': True,
            'machine': _build_machine_payload(None),
            'detail': 'No running machine found.',
        }, status=200)

    vm_lab_path = (existing.get('vm_lab_path') or target_user.vm_lab_path or '').strip()
    agent_ok, agent_detail = _trigger_vm_agent('stop', vm_lab_path)
    if not agent_ok:
        return JsonResponse({
            'success': False,
            'detail': f'VM stop trigger failed. {agent_detail}',
        }, status=502)

    # Skeleton terminate output. Replace with orchestrator terminate call later.
    _MACHINE_SESSIONS.pop(target_user.username, None)

    return JsonResponse({
        'success': True,
        'machine': _build_machine_payload(None),
        'detail': f'Machine terminated successfully. Agent response: {agent_detail}',
    }, status=200)