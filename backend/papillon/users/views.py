from django.shortcuts import render, redirect
from django.contrib.auth.hashers import check_password
from django.contrib import messages
from django.http import JsonResponse
from .models import CustomUser
from .forms import RegistrationForm, LoginForm
import json

def register(request):
    if request.method == 'POST':
        form = RegistrationForm(request.POST)
        if form.is_valid():
            try:
                user = form.save()
                messages.success(request, 'Registration successful! Please log in.')
                return redirect('login')
            except Exception as e:
                messages.error(request, f'Error creating user: {str(e)}')
        else:
            for field, errors in form.errors.items():
                for error in errors:
                    messages.error(request, f'{field}: {error}')
    else:
        form = RegistrationForm()
    
    return render(request, 'users/register.html', {'form': form})


def login(request):
    if request.method == 'POST':
        form = LoginForm(request.POST)
        if form.is_valid():
            email = form.cleaned_data['email']
            password = form.cleaned_data['password']
            
            try:
                user = CustomUser.objects.get(email=email, is_active=True)
                
                if check_password(password, user.password):
                    # Create secure session
                    request.session['user_id'] = user.username
                    request.session['email'] = user.email
                    request.session.set_expiry(3600)  # 1 hour session timeout
                    request.session.modified = True
                    
                    messages.success(request, f'Welcome back, {user.username}!')
                    return redirect('dashboard')
                else:
                    messages.error(request, 'Invalid email or password.')
            
            except CustomUser.DoesNotExist:
                messages.error(request, 'Invalid email or password.')
            except Exception as e:
                messages.error(request, f'Login error: {str(e)}')
    else:
        form = LoginForm()
    
    return render(request, 'users/login.html', {'form': form})


def logout(request):
    """Clear session and redirect to login"""
    if 'user_id' in request.session:
        del request.session['user_id']
    if 'email' in request.session:
        del request.session['email']
    request.session.flush()  # Clear all session data
    messages.success(request, 'You have been logged out.')
    return redirect('login')


def dashboard(request):
    """Protected view - requires login"""
    if 'user_id' not in request.session:
        messages.warning(request, 'Please log in first.')
        return redirect('login')
    
    try:
        user = CustomUser.objects.get(username=request.session['user_id'])
        return render(request, 'users/dashboard.html', {'user': user})
    except CustomUser.DoesNotExist:
        request.session.flush()
        return redirect('login')
