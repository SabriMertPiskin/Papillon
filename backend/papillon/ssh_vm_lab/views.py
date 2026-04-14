import os
from pathlib import Path

from django.http import FileResponse, JsonResponse
from django.views.decorators.http import require_http_methods

from users.views import require_role
from vm_lab.aws_service import start_ec2_instance


INSTANCE_ID = os.getenv('AWS_INSTANCE_ID', '')
AWS_KEY_FILENAME = os.getenv('AWS_KEY_FILENAME', '')
AWS_KEY_PATH = Path(__file__).resolve().parent.parent / 'vm_lab' / AWS_KEY_FILENAME


@require_http_methods(['GET'])
@require_role('admin', 'analyst')
def start_instance_view(request):
    try:
        result = start_ec2_instance(INSTANCE_ID)
        return JsonResponse({'success': True, 'data': result}, status=200)
    except Exception as exc:
        return JsonResponse({'success': False, 'error': str(exc)}, status=500)


@require_http_methods(['GET'])
@require_role('admin', 'analyst')
def download_aws_key(request):
    if not AWS_KEY_PATH.exists():
        return JsonResponse({'success': False, 'detail': 'awskey.pem not found.'}, status=404)

    return FileResponse(
        AWS_KEY_PATH.open('rb'),
        as_attachment=True,
        filename=AWS_KEY_FILENAME,
    )
