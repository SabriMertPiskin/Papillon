import uuid
from datetime import timedelta
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from users.models import CustomUser

# In-memory skeleton state. Later, this will be replaced by your friend's VM orchestrator integration.
_MACHINE_SESSIONS = {}


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


@require_http_methods(["GET"])
def machine_status(request):
    user, auth_error = _get_authenticated_user(request)
    if auth_error:
        return auth_error

    state = _MACHINE_SESSIONS.get(user.username)
    if state and state.get('expires_at') and timezone.now() >= state['expires_at']:
        _MACHINE_SESSIONS.pop(user.username, None)
        state = None

    return JsonResponse({
        'success': True,
        'machine': _build_machine_payload(state),
    }, status=200)


@csrf_exempt
@require_http_methods(["POST"])
def start_machine(request):
    user, auth_error = _get_authenticated_user(request)
    if auth_error:
        return auth_error

    existing = _MACHINE_SESSIONS.get(user.username)
    if existing and existing.get('running'):
        return JsonResponse({
            'success': True,
            'machine': _build_machine_payload(existing),
            'detail': 'Machine is already running.',
        }, status=200)

    # Skeleton machine boot output. Replace this block with external orchestrator call later.
    now = timezone.now()
    new_state = {
        'running': True,
        'machine_id': f"vm-{uuid.uuid4().hex[:8]}",
        'started_at': now,
        'expires_at': now + timedelta(hours=2),
        'connection': {
            'host': 'vm.placeholder.tryhackme.local',
            'port': 22,
            'protocol': 'ssh',
        },
        'detail': 'Machine booted successfully (skeleton mode).',
    }
    _MACHINE_SESSIONS[user.username] = new_state

    return JsonResponse({
        'success': True,
        'machine': _build_machine_payload(new_state),
        'detail': new_state['detail'],
    }, status=200)


@csrf_exempt
@require_http_methods(["POST"])
def terminate_machine(request):
    user, auth_error = _get_authenticated_user(request)
    if auth_error:
        return auth_error

    existing = _MACHINE_SESSIONS.get(user.username)
    if not existing or not existing.get('running'):
        return JsonResponse({
            'success': True,
            'machine': _build_machine_payload(None),
            'detail': 'No running machine found.',
        }, status=200)

    # Skeleton terminate output. Replace with orchestrator terminate call later.
    _MACHINE_SESSIONS.pop(user.username, None)

    return JsonResponse({
        'success': True,
        'machine': _build_machine_payload(None),
        'detail': 'Machine terminated successfully.',
    }, status=200)
