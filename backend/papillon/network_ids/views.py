import os
import json
import numpy as np
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

# ============================================
# AI Model — Lazy Loading
# ============================================
AI_MODULE_PATH = os.path.join(
    os.path.dirname(__file__), '..', '..', 'ai_models', 'network_intrusion_classification_module'
)

_model = None
_label_encoder = None
_scaler = None
_loaded = False


def _load_model():
    """XGBoost IDS modelini, label encoder'ı ve scaler'ı lazy-load et"""
    global _model, _label_encoder, _scaler, _loaded
    if not _loaded:
        try:
            import joblib
            model_path = os.path.join(AI_MODULE_PATH, 'xgb_model.pkl')
            encoder_path = os.path.join(AI_MODULE_PATH, 'label_encoder.pkl')
            scaler_path = os.path.join(AI_MODULE_PATH, 'scaler.pkl')

            _model = joblib.load(model_path)
            _label_encoder = joblib.load(encoder_path)
            if os.path.exists(scaler_path):
                _scaler = joblib.load(scaler_path)
            print(f"[Network IDS] Model loaded from: {model_path}")
        except Exception as e:
            import traceback
            print(f"[Network IDS] CRITICAL: Model could not be loaded: {e}")
            traceback.print_exc()
        _loaded = True
    return _model, _label_encoder, _scaler


def _classify_threat_level(label):
    """AI label'dan tehdit seviyesi belirle"""
    label_lower = str(label).lower()
    if label_lower in ['normal', 'benign']:
        return 'low', 'Normal Traffic'
    elif label_lower in ['dos', 'ddos', 'u2r', 'r2l']:
        return 'critical', label
    elif label_lower in ['probe', 'scan', 'reconnaissance']:
        return 'high', label
    else:
        return 'high', label


# ============================================
# Views
# ============================================
@csrf_exempt
@require_http_methods(["POST"])
def predict_intrusion(request):
    """
    POST /ai/network-ids/predict/
    Network traffic feature'larını analiz et → saldırı sınıflandırması yap.
    Body: { "features": [f1, f2, ..., fN] }
    """
    try:
        data = json.loads(request.body)
        features = data.get('features')

        if not features or not isinstance(features, list):
            return JsonResponse({
                'success': False,
                'detail': 'Features array is required. Send numeric feature values as a list.'
            }, status=400)

        model, label_encoder, scaler = _load_model()
        if model is None:
            return JsonResponse({
                'success': False,
                'detail': 'Network IDS AI model could not be loaded.'
            }, status=503)

        # Feature array oluştur
        feature_array = np.array(features, dtype=float).reshape(1, -1)

        # Scaler varsa uygula
        if scaler is not None:
            feature_array = scaler.transform(feature_array)

        # Prediction
        prediction = model.predict(feature_array)
        predicted_label = str(label_encoder.inverse_transform(prediction)[0])

        # Probability (eğer destekleniyorsa)
        try:
            probabilities = model.predict_proba(feature_array)[0]
            confidence = float(max(probabilities))
        except Exception:
            confidence = 0.85

        # Tehdit seviyesi
        risk_level, display_label = _classify_threat_level(predicted_label)

        return JsonResponse({
            'success': True,
            'result': {
                'prediction': predicted_label,
                'label': display_label,
                'risk_level': risk_level,
                'confidence': round(confidence, 4),
            }
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


@csrf_exempt
@require_http_methods(["POST"])
def analyze_batch(request):
    """
    POST /ai/network-ids/analyze-batch/
    Toplu trafik analizi — birden fazla feature set gönder.
    Body: { "samples": [[f1,f2,...], [f1,f2,...], ...] }
    """
    try:
        data = json.loads(request.body)
        samples = data.get('samples')

        if not samples or not isinstance(samples, list):
            return JsonResponse({
                'success': False,
                'detail': 'Samples array is required.'
            }, status=400)

        model, label_encoder, scaler = _load_model()
        if model is None:
            return JsonResponse({
                'success': False,
                'detail': 'Network IDS AI model could not be loaded.'
            }, status=503)

        feature_array = np.array(samples, dtype=float)

        if scaler is not None:
            feature_array = scaler.transform(feature_array)

        predictions = model.predict(feature_array)
        labels = label_encoder.inverse_transform(predictions)

        results = []
        for i, label in enumerate(labels):
            risk_level, display_label = _classify_threat_level(str(label))
            results.append({
                'index': i,
                'prediction': str(label),
                'label': display_label,
                'risk_level': risk_level,
            })

        # İstatistikler
        total = len(results)
        normal_count = sum(1 for r in results if r['risk_level'] == 'low')
        threat_count = total - normal_count

        return JsonResponse({
            'success': True,
            'results': results,
            'stats': {
                'total': total,
                'normal': normal_count,
                'threats': threat_count,
                'threat_rate': round(threat_count / total * 100, 1) if total > 0 else 0,
            }
        }, status=200)

    except Exception as e:
        return JsonResponse({
            'success': False,
            'detail': str(e)
        }, status=500)
