from django.shortcuts import render, redirect
from django.contrib.auth.hashers import check_password
from django.contrib import messages
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from .models import CustomUser
from .forms import RegistrationForm, LoginForm
import json

@csrf_exempt
@require_http_methods(["POST"])
def register(request):
    """API endpoint for user registration - returns JSON"""
    try:
        data = json.loads(request.body)
        
        # Validate required fields
        if not data.get('username') or not data.get('email') or not data.get('password'):
            return JsonResponse(
                {'success': False, 'detail': 'Username, email, and password are required'},
                status=400
            )
        
        # Check if user exists
        if CustomUser.objects.filter(username=data['username']).exists():
            return JsonResponse(
                {'success': False, 'detail': 'Username already exists'},
                status=400
            )
        
        if CustomUser.objects.filter(email=data['email']).exists():
            return JsonResponse(
                {'success': False, 'detail': 'Email already registered'},
                status=400
            )
        
        # Create user
        user = CustomUser(
            username=data['username'],
            email=data['email'],
            domain=data.get('domain', '')
        )
        user.set_password(data['password'])
        user.save()
        
        return JsonResponse({
            'success': True,
            'detail': 'Registration successful',
            'user': {
                'username': user.username,
                'email': user.email,
                'domain': user.domain
            }
        }, status=201)
    
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'detail': 'Invalid JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'detail': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def login(request):
    """API endpoint for user login - returns JSON with session"""
    try:
        data = json.loads(request.body)
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return JsonResponse(
                {'success': False, 'detail': 'Email and password are required'},
                status=400
            )
        
        # Find user by email
        try:
            user = CustomUser.objects.get(email=email, is_active=True)
        except CustomUser.DoesNotExist:
            return JsonResponse(
                {'success': False, 'detail': 'Invalid email or password'},
                status=401
            )
        
        # Verify password
        if not check_password(password, user.password):
            return JsonResponse(
                {'success': False, 'detail': 'Invalid email or password'},
                status=401
            )
        
        # Create secure session
        request.session['user_id'] = user.username
        request.session['email'] = user.email
        request.session.set_expiry(3600)  # 1 hour
        request.session.modified = True
        
        return JsonResponse({
            'success': True,
            'detail': f'Welcome back, {user.username}!',
            'user': {
                'username': user.username,
                'email': user.email,
                'domain': user.domain,
                'created_at': user.created_at.isoformat()
            }
        }, status=200)
    
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'detail': 'Invalid JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'detail': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def logout(request):
    """API endpoint for logout - clears session"""
    try:
        if 'user_id' in request.session:
            del request.session['user_id']
        if 'email' in request.session:
            del request.session['email']
        request.session.flush()
        
        return JsonResponse({
            'success': True,
            'detail': 'Successfully logged out'
        }, status=200)
    except Exception as e:
        return JsonResponse({'success': False, 'detail': str(e)}, status=500)


@require_http_methods(["GET"])
def dashboard(request):
    """API endpoint for dashboard - requires session"""
    try:
        if 'user_id' not in request.session:
            return JsonResponse(
                {'success': False, 'detail': 'Not authenticated'},
                status=401
            )
        
        user = CustomUser.objects.get(username=request.session['user_id'])
        return JsonResponse({
            'success': True,
            'user': {
                'username': user.username,
                'email': user.email,
                'domain': user.domain,
                'created_at': user.created_at.isoformat(),
                'updated_at': user.updated_at.isoformat()
            }
        }, status=200)
    
    except CustomUser.DoesNotExist:
        request.session.flush()
        return JsonResponse(
            {'success': False, 'detail': 'User not found'},
            status=401
        )
    except Exception as e:
        return JsonResponse({'success': False, 'detail': str(e)}, status=500)
