from django.shortcuts import render, redirect
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.utils import timezone
import json
import requests
import os
from datetime import datetime, timedelta
from .models import OutlookAccount
from users.models import CustomUser
from papillon.vault_service import get_secret

CLIENT_ID = get_secret('OUTLOOK_CLIENT_ID', vault_path='papillon/outlook', default=None)
CLIENT_SECRET = get_secret('OUTLOOK_CLIENT_SECRET', vault_path='papillon/outlook', default=None)
TENANT_ID = get_secret('OUTLOOK_TENANT_ID', vault_path='papillon/outlook', default=None)
REDIRECT_URI = 'http://localhost:8000/outlook/callback'

@csrf_exempt
@require_http_methods(["POST"])
def save_client_id(request):
    """Save Client ID and Client Secret to session for OAuth flow"""
    
    if 'user_id' not in request.session:
        return JsonResponse({
            'success': False,
            'detail': 'Not authenticated'
        }, status=401)
    
    try:
        payload = json.loads(request.body)
        client_id = payload.get('client_id', '').strip()
        client_secret = payload.get('client_secret', '').strip()
        
        if not client_id or not client_secret:
            return JsonResponse({
                'success': False,
                'detail': 'Client ID and Client Secret are required'
            }, status=400)
        
        request.session['outlook_temp_client_id'] = client_id
        request.session['outlook_temp_client_secret'] = client_secret
        request.session.modified = True
        
        return JsonResponse({
            'success': True
        }, status=200)
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'detail': 'Invalid JSON payload'
        }, status=400)

@csrf_exempt
@require_http_methods(["GET"])
def authorize(request):
    """Redirect user to Microsoft OAuth authorization"""
    
    if 'user_id' not in request.session:
        return JsonResponse({
            'success': False,
            'detail': 'Not authenticated'
        }, status=401)

    client_id = request.session.get('outlook_temp_client_id')
    if not client_id:
        return JsonResponse({
            'success': False,
            'detail': 'Client ID not provided'
        }, status=400)
    
    # Microsoft authorization endpoint - use common for personal accounts
    auth_url = (
        f"https://login.microsoftonline.com/common/oauth2/v2.0/authorize?"
        f"client_id={client_id}&"
        f"redirect_uri={REDIRECT_URI}&"
        f"response_type=code&"
        f"scope=https%3A%2F%2Fgraph.microsoft.com%2FMail.Read%20https%3A%2F%2Fgraph.microsoft.com%2FUser.Read%20offline_access&"
        f"prompt=consent"
    )
    
    request.session['outlook_auth_user_id'] = request.session['user_id']
    request.session.modified = True
    
    return JsonResponse({
        'success': True,
        'auth_url': auth_url
    }, status=200)


@csrf_exempt
@require_http_methods(["GET"])
def callback(request):
    """Handle OAuth callback from Microsoft"""
    
    code = request.GET.get('code')
    error = request.GET.get('error')
    
    if error:
        return JsonResponse({
            'success': False,
            'detail': f'Authorization failed: {error}'
        }, status=400)
    
    if not code:
        return JsonResponse({
            'success': False,
            'detail': 'No authorization code received'
        }, status=400)
    
    if 'outlook_auth_user_id' not in request.session:
        return JsonResponse({
            'success': False,
            'detail': 'Session expired'
        }, status=401)
    
    try:
        user = CustomUser.objects.get(username=request.session['outlook_auth_user_id'])
    except CustomUser.DoesNotExist:
        return JsonResponse({
            'success': False,
            'detail': 'User not found'
        }, status=404)
    
    # Exchange authorization code for tokens - use common for personal accounts
    token_url = f"https://login.microsoftonline.com/common/oauth2/v2.0/token"
    client_id = request.session.get('outlook_temp_client_id')
    client_secret = request.session.get('outlook_temp_client_secret')
    
    if not client_id or not client_secret:
        return JsonResponse({
            'success': False,
            'detail': 'Client ID or Client Secret not provided'
        }, status=400)
    
    token_data = {
        'client_id': client_id,
        'client_secret': client_secret,
        'code': code,
        'redirect_uri': REDIRECT_URI,
        'grant_type': 'authorization_code',
        'scope': 'https://graph.microsoft.com/User.Read https://graph.microsoft.com/Mail.Read offline_access'
    }
    
    try:
        token_response = requests.post(token_url, data=token_data)
        token_response.raise_for_status()
        tokens = token_response.json()
        
        headers = {
            'Authorization': f"Bearer {tokens['access_token']}",
            'Content-Type': 'application/json'
        }
        
        me_response = requests.get('https://graph.microsoft.com/v1.0/me', headers=headers)
        me_response.raise_for_status()
        user_info = me_response.json()
        
        outlook_email = user_info.get('mail') or user_info.get('userPrincipalName') or user_info.get('mailNickname') or ''
        
        outlook_account, created = OutlookAccount.objects.update_or_create(
            user=user,
            defaults={
                'access_token': tokens['access_token'],
                'refresh_token': tokens.get('refresh_token', ''),
                'expires_at': timezone.now() + timedelta(seconds=tokens.get('expires_in', 3600)),
                'is_connected': True,
                'outlook_email': outlook_email
            }
        )
        
        del request.session['outlook_auth_user_id']
        request.session.modified = True
        
        return redirect('http://localhost:5173/dashboard')
    
    except requests.exceptions.RequestException as e:
        return JsonResponse({
            'success': False,
            'detail': f'Token exchange failed: {str(e)}'
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'detail': str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def disconnect(request):
    """Disconnect Outlook account"""
    
    if 'user_id' not in request.session:
        return JsonResponse({
            'success': False,
            'detail': 'Not authenticated'
        }, status=401)
    
    try:
        user = CustomUser.objects.get(username=request.session['user_id'])
        outlook_account = OutlookAccount.objects.get(user=user)
        outlook_account.delete()
        
        return JsonResponse({
            'success': True,
            'detail': 'Outlook account disconnected'
        }, status=200)
    
    except OutlookAccount.DoesNotExist:
        return JsonResponse({
            'success': False,
            'detail': 'No Outlook account connected'
        }, status=404)
    except CustomUser.DoesNotExist:
        return JsonResponse({
            'success': False,
            'detail': 'User not found'
        }, status=404)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'detail': str(e)
        }, status=500)


@require_http_methods(["GET"])
def get_outlook_status(request):
    """Get Outlook connection status"""
    
    if 'user_id' not in request.session:
        return JsonResponse({
            'success': False,
            'detail': 'Not authenticated'
        }, status=401)
    
    try:
        user = CustomUser.objects.get(username=request.session['user_id'])
        outlook_account = OutlookAccount.objects.get(user=user)
        
        return JsonResponse({
            'success': True,
            'is_connected': outlook_account.is_connected,
            'outlook_email': outlook_account.outlook_email,
            'connected_at': outlook_account.created_at.isoformat()
        }, status=200)
    
    except OutlookAccount.DoesNotExist:
        return JsonResponse({
            'success': True,
            'is_connected': False,
            'outlook_email': None
        }, status=200)


@csrf_exempt
@require_http_methods(["GET"])
def get_latest_mail(request):
    """Get latest email from Outlook inbox"""
    
    if 'user_id' not in request.session:
        return JsonResponse({
            'success': False,
            'detail': 'Not authenticated'
        }, status=401)
    
    try:
        user = CustomUser.objects.get(username=request.session['user_id'])
        outlook_account = OutlookAccount.objects.get(user=user)
        
        if not outlook_account.is_connected:
            return JsonResponse({
                'success': False,
                'detail': 'Outlook account not connected'
            }, status=400)
        
        access_token = outlook_account.access_token
        
        if not access_token:
            return JsonResponse({
                'success': False,
                'detail': 'Failed to decrypt access token'
            }, status=400)
        
        headers = {
            'Authorization': f"Bearer {access_token}",
            'Content-Type': 'application/json'
        }
        
        me_response = requests.get(
            'https://graph.microsoft.com/v1.0/me/messages?$top=1&$orderby=receivedDateTime desc&$select=subject,from,receivedDateTime,bodyPreview',
            headers=headers
        )
        
        me_response.raise_for_status()
        response_data = me_response.json()
        emails = response_data.get('value', [])
        
        if not emails:
            return JsonResponse({
                'success': True,
                'detail': 'No emails found',
                'email': None
            }, status=200)
        
        latest_email = emails[0]
        
        return JsonResponse({
            'success': True,
            'email': {
                'subject': latest_email.get('subject', ''),
                'from': latest_email.get('from', {}).get('emailAddress', {}).get('address', ''),
                'from_name': latest_email.get('from', {}).get('emailAddress', {}).get('name', ''),
                'received_date': latest_email.get('receivedDateTime', ''),
                'preview': latest_email.get('bodyPreview', '')
            }
        }, status=200)
        
    except OutlookAccount.DoesNotExist:
        return JsonResponse({
            'success': False,
            'detail': 'Outlook account not connected'
        }, status=400)
    except CustomUser.DoesNotExist:
        return JsonResponse({
            'success': False,
            'detail': 'User not found'
        }, status=404)
    except requests.exceptions.RequestException as e:
        return JsonResponse({
            'success': False,
            'detail': f'Failed to fetch emails: {str(e)}'
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'detail': str(e)
        }, status=500)
