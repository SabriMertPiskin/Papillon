import os
import sys
import json
import re
import math
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

# ai_models klasörünü path'e ekle
AI_MODULE_PATH = os.path.join(
    os.path.dirname(__file__), '..', '..', 'ai_models', 'password_strength_module'
)
sys.path.append(AI_MODULE_PATH)

# Model'i lazy-load et (ilk istek geldiğinde yüklesin)
_model = None
_model_loaded = False


def _get_model():
    """Model'i lazy-load et"""
    global _model, _model_loaded
    if not _model_loaded:
        try:
            import joblib
            model_path = os.path.join(AI_MODULE_PATH, 'password_strength_model.pkl')
            _model = joblib.load(model_path)
            print(f"Password Strength Model loaded from: {model_path}")
        except Exception as e:
            print(f"CRITICAL: Password model could not be loaded: {e}")
            _model = None
        _model_loaded = True
    return _model


def _calculate_entropy(password):
    """Şifre entropisini hesapla"""
    charset_size = 0

    if re.search(r"[a-z]", password):
        charset_size += 26
    if re.search(r"[A-Z]", password):
        charset_size += 26
    if re.search(r"[çğıöşü]", password):
        charset_size += 6
    if re.search(r"[ÇĞİÖŞÜ]", password):
        charset_size += 6
    if re.search(r"[0-9]", password):
        charset_size += 10
    if re.search(r'[!@#$%^&*(),.?":{}|<>_\-+=/\\[\]~`]', password):
        charset_size += 32

    if charset_size == 0:
        return 0

    return len(password) * math.log2(charset_size)


def _extract_features(password):
    """Model için feature extraction"""
    import pandas as pd
    features = {
        "length": len(password),
        "has_upper": int(bool(re.search(r"[A-Z]", password))),
        "has_lower": int(bool(re.search(r"[a-z]", password))),
        "has_digit": int(bool(re.search(r"[0-9]", password))),
        "has_special": int(bool(re.search(r'[!@#$%^&*(),.?":{}|<>]', password))),
        "digit_count": len(re.findall(r"[0-9]", password)),
        "special_count": len(re.findall(r'[!@#$%^&*(),.?":{}|<>]', password)),
        "entropy": _calculate_entropy(password),
        "unique_chars": len(set(password)),
        "repeated_ratio": len(password) / len(set(password)) if len(set(password)) > 0 else 0
    }
    return pd.DataFrame([features])


def _generate_suggestions(password, strength_label):
    """Şifre iyileştirme önerileri üret"""
    suggestions = []

    if len(password) < 8:
        suggestions.append('Password should be at least 8 characters long.')
    elif len(password) < 12:
        suggestions.append('Consider using 12+ characters for stronger security.')

    if not re.search(r"[A-Z]", password):
        suggestions.append('Add uppercase letters (A-Z).')
    if not re.search(r"[a-z]", password):
        suggestions.append('Add lowercase letters (a-z).')
    if not re.search(r"[0-9]", password):
        suggestions.append('Add numbers (0-9).')
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        suggestions.append('Add special characters (!@#$%^&*).')

    unique_ratio = len(set(password)) / len(password) if len(password) > 0 else 0
    if unique_ratio < 0.5:
        suggestions.append('Too many repeated characters. Use more variety.')

    common_passwords = ['123456', 'password', 'qwerty', '123456789', '12345678',
                        '111111', 'iloveyou', 'admin', 'letmein', 'welcome']
    if password.lower() in common_passwords:
        suggestions.append('This is a commonly used password. Choose something unique.')

    if strength_label == 'Strong' and not suggestions:
        suggestions.append('Great password! Consider enabling MFA for extra security.')

    return suggestions


@csrf_exempt
@require_http_methods(["POST"])
def predict_strength(request):
    """
    POST /ai/password-strength/predict/
    Şifreyi AI modeli ile analiz et.
    """
    try:
        data = json.loads(request.body)
        password = data.get('password', '').strip()

        if not password:
            return JsonResponse({
                'success': False,
                'detail': 'Password is required'
            }, status=400)

        model = _get_model()
        if model is None:
            return JsonResponse({
                'success': False,
                'detail': 'AI Password model could not be loaded'
            }, status=503)

        # Feature extraction ve prediction
        features = _extract_features(password)
        prediction = int(model.predict(features)[0])

        labels = {0: "Weak", 1: "Normal", 2: "Strong"}
        strength_label = labels.get(prediction, "Unknown")

        # Öneriler üret
        suggestions = _generate_suggestions(password, strength_label)

        return JsonResponse({
            'success': True,
            'prediction': strength_label,
            'strength_level': prediction,
            'suggestions': suggestions,
            'entropy': round(_calculate_entropy(password), 2),
            'password_length': len(password)
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
