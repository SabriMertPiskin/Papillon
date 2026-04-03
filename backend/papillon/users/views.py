from django.shortcuts import render, redirect
from django.contrib.auth.hashers import check_password
from django.contrib import messages
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from .models import CustomUser
from .forms import RegistrationForm, LoginForm
from outlook.models import OutlookAccount
import json
import pyotp
import qrcode
import qrcode.image.svg
import base64
import io
import hashlib
import time
import secrets
from django.contrib.auth.hashers import make_password as hash_backup_code

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
        
        # MFA kontrolü - MFA aktifse session oluşturmadan mfa_required döndür
        if user.mfa_enabled and user.mfa_secret:
            # Geçici bir token oluştur (password doğrulandı ama MFA bekliyor)
            mfa_token = _generate_mfa_token(user.username)
            request.session['mfa_pending_user'] = user.username
            request.session['mfa_token'] = mfa_token
            request.session['mfa_pending_time'] = time.time()
            request.session.set_expiry(300)  # 5 dakika MFA için süre
            request.session.modified = True
            
            return JsonResponse({
                'success': True,
                'mfa_required': True,
                'mfa_token': mfa_token,
                'detail': 'MFA doğrulaması gerekiyor'
            }, status=200)
        
        # MFA aktif değilse direkt session oluştur
        request.session['user_id'] = user.username
        request.session['email'] = user.email
        request.session.set_expiry(3600)  # 1 hour
        request.session.modified = True
        
        return JsonResponse({
            'success': True,
            'mfa_required': False,
            'detail': f'Welcome back, {user.username}!',
            'user': _get_user_auth_data(user)
        }, status=200)
    
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'detail': 'Invalid JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'detail': str(e)}, status=500)


def _generate_mfa_token(username):
    """Geçici MFA token üret (login ile verify-mfa arasında kullanılır)"""
    raw = f"{username}:{time.time()}:{id(username)}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


def _generate_backup_code():
    """6 haneli rastgele yedek kod üret"""
    return f"{secrets.randbelow(10**6):06d}"


def _get_user_auth_data(user):
    """User login response'u için temel data hazırla (outlook_connected + role dahil)"""
    from outlook.models import OutlookAccount
    
    outlook_connected = False
    try:
        outlook_account = OutlookAccount.objects.get(user=user)
        outlook_connected = bool(outlook_account.outlook_email and outlook_account._access_token)
    except OutlookAccount.DoesNotExist:
        outlook_connected = False
    
    # Ensure admin accounts never expose a personal domain.
    domain_value = user.domain or ''
    vm_lab_path_value = user.vm_lab_path or ''
    if user.role == 'admin':
        if user.domain or user.vm_lab_path:
            user.domain = ''
            user.vm_lab_path = ''
            user.save(update_fields=['domain', 'vm_lab_path', 'updated_at'])
        domain_value = ''
        vm_lab_path_value = ''

    return {
        'username': user.username,
        'email': user.email,
        'domain': domain_value,
        'vm_lab_path': vm_lab_path_value,
        'role': user.role,
        'created_at': user.created_at.isoformat(),
        'mfa_enabled': user.mfa_enabled,
        'outlook_connected': outlook_connected
    }


@csrf_exempt
@require_http_methods(["POST"])
def verify_mfa(request):
    """Login sonrası MFA kod doğrulama"""
    try:
        data = json.loads(request.body)
        mfa_token = data.get('mfa_token', '')
        otp_code = data.get('otp_code', '')
        
        if not mfa_token or not otp_code:
            return JsonResponse(
                {'success': False, 'detail': 'MFA token ve OTP kodu gerekli'},
                status=400
            )
        
        # Session'daki pending MFA bilgisini kontrol et
        pending_user = request.session.get('mfa_pending_user')
        session_token = request.session.get('mfa_token')
        pending_time = request.session.get('mfa_pending_time', 0)
        
        if not pending_user or session_token != mfa_token:
            return JsonResponse(
                {'success': False, 'detail': 'Geçersiz veya süresi dolmuş MFA oturumu'},
                status=401
            )
        
        # 5 dakika zaman aşımı
        if time.time() - pending_time > 300:
            request.session.flush()
            return JsonResponse(
                {'success': False, 'detail': 'MFA süresi doldu, tekrar giriş yapın'},
                status=401
            )
        
        try:
            user = CustomUser.objects.get(username=pending_user, is_active=True)
        except CustomUser.DoesNotExist:
            return JsonResponse(
                {'success': False, 'detail': 'Kullanıcı bulunamadı'},
                status=401
            )
        
        # Yedek kod mu kullanılıyor?
        use_backup = data.get('use_backup', False)
        
        if use_backup:
            # Yedek kod doğrulama
            if not user.mfa_backup_code or not check_password(otp_code, user.mfa_backup_code):
                return JsonResponse(
                    {'success': False, 'detail': 'Geçersiz yedek kod'},
                    status=401
                )
            
            # Yedek kod doğru — yeni yedek kod üret
            new_backup_code = _generate_backup_code()
            user.mfa_backup_code = hash_backup_code(new_backup_code)
            user.save()
            
            # Session oluştur
            del request.session['mfa_pending_user']
            del request.session['mfa_token']
            del request.session['mfa_pending_time']
            
            request.session['user_id'] = user.username
            request.session['email'] = user.email
            request.session.set_expiry(3600)
            request.session.modified = True
            
            return JsonResponse({
                'success': True,
                'detail': f'Welcome back, {user.username}!',
                'new_backup_code': new_backup_code,
                'user': _get_user_auth_data(user)
            }, status=200)
        
        # TOTP doğrula
        totp = pyotp.TOTP(user.mfa_secret)
        if not totp.verify(otp_code, valid_window=1):
            return JsonResponse(
                {'success': False, 'detail': 'Geçersiz doğrulama kodu'},
                status=401
            )
        
        # MFA başarılı — geçici verileri temizle ve gerçek session oluştur
        del request.session['mfa_pending_user']
        del request.session['mfa_token']
        del request.session['mfa_pending_time']
        
        request.session['user_id'] = user.username
        request.session['email'] = user.email
        request.session.set_expiry(3600)
        request.session.modified = True
        
        return JsonResponse({
            'success': True,
            'detail': f'Welcome back, {user.username}!',
            'user': _get_user_auth_data(user)
        }, status=200)
    
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'detail': 'Invalid JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'detail': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def mfa_setup(request):
    """MFA kurulumu başlat — QR kod ve secret döndür"""
    try:
        if 'user_id' not in request.session:
            return JsonResponse(
                {'success': False, 'detail': 'Not authenticated'},
                status=401
            )
        
        user = CustomUser.objects.get(username=request.session['user_id'])
        
        # Yeni TOTP secret üret
        secret = pyotp.random_base32()
        totp = pyotp.TOTP(secret)
        
        # QR kod için provisioning URI
        provisioning_uri = totp.provisioning_uri(
            name=user.email,
            issuer_name='Papillon'
        )
        
        # QR kodu base64 PNG olarak üret
        qr = qrcode.QRCode(version=1, box_size=6, border=2)
        qr.add_data(provisioning_uri)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        qr_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        
        # Secret'ı geçici olarak session'da tut (verify edilene kadar DB'ye yazmıyoruz)
        request.session['mfa_setup_secret'] = secret
        request.session.modified = True
        
        return JsonResponse({
            'success': True,
            'secret': secret,
            'qr_code': f'data:image/png;base64,{qr_base64}',
            'detail': 'QR kodu Google Authenticator ile tara, ardından kodu doğrula'
        }, status=200)
    
    except CustomUser.DoesNotExist:
        return JsonResponse({'success': False, 'detail': 'User not found'}, status=404)
    except Exception as e:
        return JsonResponse({'success': False, 'detail': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def mfa_verify_setup(request):
    """MFA kurulumunu doğrula ve aktifleştir"""
    try:
        if 'user_id' not in request.session:
            return JsonResponse(
                {'success': False, 'detail': 'Not authenticated'},
                status=401
            )
        
        data = json.loads(request.body)
        otp_code = data.get('otp_code', '')
        
        if not otp_code:
            return JsonResponse(
                {'success': False, 'detail': 'Doğrulama kodu gerekli'},
                status=400
            )
        
        secret = request.session.get('mfa_setup_secret')
        if not secret:
            return JsonResponse(
                {'success': False, 'detail': 'Önce MFA setup başlatın'},
                status=400
            )
        
        # TOTP kodu doğrula
        totp = pyotp.TOTP(secret)
        if not totp.verify(otp_code, valid_window=1):
            return JsonResponse(
                {'success': False, 'detail': 'Geçersiz doğrulama kodu'},
                status=400
            )
        
        # Doğrulama başarılı — MFA'yı aktifleştir + yedek kod üret
        user = CustomUser.objects.get(username=request.session['user_id'])
        backup_code = _generate_backup_code()
        user.mfa_secret = secret
        user.mfa_enabled = True
        user.mfa_backup_code = hash_backup_code(backup_code)
        user.save()
        
        # Geçici secret'ı session'dan temizle
        del request.session['mfa_setup_secret']
        request.session.modified = True
        
        return JsonResponse({
            'success': True,
            'backup_code': backup_code,
            'detail': 'MFA başarıyla aktifleştirildi!'
        }, status=200)
    
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'detail': 'Invalid JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'detail': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def mfa_disable(request):
    """MFA'yı devre dışı bırak"""
    try:
        if 'user_id' not in request.session:
            return JsonResponse(
                {'success': False, 'detail': 'Not authenticated'},
                status=401
            )
        
        data = json.loads(request.body)
        password = data.get('password', '')
        
        if not password:
            return JsonResponse(
                {'success': False, 'detail': 'Şifre doğrulaması gerekli'},
                status=400
            )
        
        user = CustomUser.objects.get(username=request.session['user_id'])
        
        # Şifre doğrula (güvenlik için)
        if not check_password(password, user.password):
            return JsonResponse(
                {'success': False, 'detail': 'Şifre yanlış'},
                status=401
            )
        
        user.mfa_enabled = False
        user.mfa_secret = None
        user.mfa_backup_code = None
        user.save()
        
        return JsonResponse({
            'success': True,
            'detail': 'MFA devre dışı bırakıldı'
        }, status=200)
    
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'detail': 'Invalid JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'detail': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def mfa_status(request):
    """Kullanıcının MFA durumunu döndür"""
    try:
        if 'user_id' not in request.session:
            return JsonResponse(
                {'success': False, 'detail': 'Not authenticated'},
                status=401
            )
        
        user = CustomUser.objects.get(username=request.session['user_id'])
        
        return JsonResponse({
            'success': True,
            'mfa_enabled': user.mfa_enabled
        }, status=200)
    
    except CustomUser.DoesNotExist:
        return JsonResponse({'success': False, 'detail': 'User not found'}, status=404)
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
        domain_value = user.domain or ''
        vm_lab_path_value = user.vm_lab_path or ''
        if user.role == 'admin':
            if user.domain or user.vm_lab_path:
                user.domain = ''
                user.vm_lab_path = ''
                user.save(update_fields=['domain', 'vm_lab_path', 'updated_at'])
            domain_value = ''
            vm_lab_path_value = ''

        return JsonResponse({
            'success': True,
            'user': {
                'username': user.username,
                'email': user.email,
                'domain': domain_value,
                'vm_lab_path': vm_lab_path_value,
                'role': user.role,
                'created_at': user.created_at.isoformat(),
                'updated_at': user.updated_at.isoformat(),
                'mfa_enabled': user.mfa_enabled
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


@csrf_exempt
@require_http_methods(["POST"])
def change_password(request):
    """Change user password"""
    try:
        if 'user_id' not in request.session:
            return JsonResponse(
                {'success': False, 'detail': 'Not authenticated'},
                status=401
            )
        
        username = request.session.get('user_id')
        data = json.loads(request.body)
        current_password = data.get('current_password', '')
        new_password = data.get('new_password', '')
        
        if not current_password or not new_password:
            return JsonResponse(
                {'success': False, 'detail': 'Current and new password are required'},
                status=400
            )
        
        # Get user
        try:
            user = CustomUser.objects.get(username=username)
        except CustomUser.DoesNotExist:
            return JsonResponse(
                {'success': False, 'detail': f'User not found: {username}'},
                status=404
            )
        
        # Verify current password
        if not check_password(current_password, user.password):
            return JsonResponse(
                {'success': False, 'detail': 'Current password is incorrect'},
                status=401
            )
        
        # Update password
        user.set_password(new_password)
        user.save()
        
        return JsonResponse({
            'success': True,
            'detail': 'Password changed successfully'
        }, status=200)
    
    except json.JSONDecodeError as e:
        return JsonResponse({'success': False, 'detail': f'Invalid JSON: {str(e)}'}, status=400)
    except Exception as e:
        import traceback
        error_detail = f'{str(e)} - {traceback.format_exc()}'
        return JsonResponse({'success': False, 'detail': error_detail}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def update_domain(request):
    """Update user domain"""
    try:
        if 'user_id' not in request.session:
            return JsonResponse(
                {'success': False, 'detail': 'Not authenticated - no session user_id'},
                status=401
            )
        
        username = request.session.get('user_id')
        data = json.loads(request.body)
        domain = data.get('domain', '').strip()
        
        # Get user
        try:
            user = CustomUser.objects.get(username=username)
        except CustomUser.DoesNotExist:
            return JsonResponse(
                {'success': False, 'detail': f'User not found: {username}'},
                status=404
            )

        if user.role == 'admin':
            return JsonResponse(
                {'success': False, 'detail': 'Admin users cannot store a personal domain'},
                status=403
            )
        
        # Update domain
        user.domain = domain
        user.save()
        
        # Verify save worked
        user.refresh_from_db()
        
        return JsonResponse({
            'success': True,
            'detail': 'Domain updated successfully',
            'domain': user.domain
        }, status=200)

    except json.JSONDecodeError as e:
        return JsonResponse({'success': False, 'detail': f'Invalid JSON: {str(e)}'}, status=400)
    except Exception as e:
        import traceback
        error_detail = f'{str(e)} - {traceback.format_exc()}'
        return JsonResponse({'success': False, 'detail': error_detail}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def update_vm_lab_path(request):
    """Update user VM Lab executable path."""
    try:
        if 'user_id' not in request.session:
            return JsonResponse(
                {'success': False, 'detail': 'Not authenticated - no session user_id'},
                status=401
            )

        username = request.session.get('user_id')
        data = json.loads(request.body)
        vm_lab_path = data.get('vm_lab_path', '').strip()

        try:
            user = CustomUser.objects.get(username=username)
        except CustomUser.DoesNotExist:
            return JsonResponse(
                {'success': False, 'detail': f'User not found: {username}'},
                status=404
            )

        if user.role == 'admin':
            return JsonResponse(
                {'success': False, 'detail': 'Admin users cannot store a personal VM Lab path'},
                status=403
            )

        user.vm_lab_path = vm_lab_path
        user.save()
        user.refresh_from_db()

        return JsonResponse({
            'success': True,
            'detail': 'VM Lab path updated successfully',
            'vm_lab_path': user.vm_lab_path or ''
        }, status=200)

    except json.JSONDecodeError as e:
        return JsonResponse({'success': False, 'detail': f'Invalid JSON: {str(e)}'}, status=400)
    except Exception as e:
        import traceback
        error_detail = f'{str(e)} - {traceback.format_exc()}'
        return JsonResponse({'success': False, 'detail': error_detail}, status=500)


 # ==================== RBAC Decorator ====================

def require_role(*allowed_roles):
    """
    Decorator to restrict view access by user role.
    Usage:
        @require_role('admin')
        @require_role('admin', 'analyst')
    """
    def decorator(view_func):
        def wrapper(request, *args, **kwargs):
            # Check if user is authenticated
            user_id = request.session.get('user_id')
            if not user_id:
                return JsonResponse(
                    {'success': False, 'detail': 'Not authenticated'},
                    status=401
                )
            
            try:
                user = CustomUser.objects.get(username=user_id)
            except CustomUser.DoesNotExist:
                request.session.flush()
                return JsonResponse(
                    {'success': False, 'detail': 'User not found'},
                    status=401
                )
            
            # Check if user has required role
            if user.role not in allowed_roles:
                return JsonResponse(
                    {'success': False, 'detail': f'Access denied: required role {allowed_roles}, current role: {user.role}'},
                    status=403
                )
            
            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator


@csrf_exempt
@require_http_methods(["GET"])
@require_role('admin')
def resolve_analyst_vm_lab_path(request):
    """
    Admin-only helper for VM Lab.
    GET /auth/resolve-analyst-vm-lab-path/?username=analyst_username
    Returns analyst domain and VM Lab path; fails if either is missing.
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

        domain = (analyst.domain or '').strip()
        vm_lab_path = (analyst.vm_lab_path or '').strip()

        if not domain:
            return JsonResponse(
                {'success': False, 'detail': f'Analyst "{analyst_username}" has no configured domain'},
                status=400
            )

        if not vm_lab_path:
            return JsonResponse(
                {'success': False, 'detail': f'Analyst "{analyst_username}" has no configured VM Lab path'},
                status=400
            )

        return JsonResponse({
            'success': True,
            'analyst_username': analyst.username,
            'domain': domain,
            'vm_lab_path': vm_lab_path,
        }, status=200)

    except Exception as e:
        return JsonResponse({'success': False, 'detail': str(e)}, status=500)


