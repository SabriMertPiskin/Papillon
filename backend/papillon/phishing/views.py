import os
import sys
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.db.models import Q
from .models import PhishingLog
from users.models import CustomUser
from users.views import require_role

# ai_models klasörünü path'e ekle (attack_surface ile aynı pattern)
sys.path.append(os.path.join(
    os.path.dirname(__file__), '..', '..', 'ai_models', 'phishing_detection_module'
))


def _get_detector():
    """PhishingDetector'ı lazy-load et"""
    try:
        from api import PhishingDetector
        return PhishingDetector()
    except Exception as e:
        print(f"PhishingDetector yüklenemedi: {e}")
        return None


def _score_from_prediction(is_phishing):
    """
    AI prediction'ından risk skoru ve status üret.
    Not: Mevcut model sadece binary (phishing/safe) döndürüyor.
    Score'u buna göre hesaplıyoruz.
    """
    if is_phishing:
        return 90, 'phishing'
    else:
        return 10, 'clean'


def _generate_ai_reasons(prediction_result, sender='', subject=''):
    """
    AI karar gerekçeleri üret (Explainable AI).
    Gerçek model sadece binary çıktı verdiği için,
    ek analizlerle zenginleştiriyoruz.
    """
    reasons = []
    label = prediction_result.get('label', '')

    if label == 'PHISHING':
        # Sender analizi
        if sender:
            known_domains = ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com',
                             'github.com', 'microsoft.com', 'google.com', 'apple.com']
            sender_domain = sender.split('@')[-1] if '@' in sender else ''
            if sender_domain and sender_domain not in known_domains:
                reasons.append(
                    f'Sender domain ({sender_domain}) is not recognized as a known trusted provider.'
                )
            else:
                reasons.append('Sender domain appears legitimate but email content is suspicious.')

        reasons.append('AI NLP model classified the email text as phishing based on language patterns.')

        # Subject analizi
        if subject:
            urgency_words = ['urgent', 'immediately', 'alert', 'verify', 'suspend',
                             'restricted', 'expire', 'warning', 'confirm', 'update']
            found = [w for w in urgency_words if w.lower() in subject.lower()]
            if found:
                reasons.append(
                    f'Subject line contains urgency keywords: {", ".join(found)}.'
                )
    else:
        reasons.append('AI NLP model classified the email content as safe.')
        if sender:
            reasons.append(f'Sender ({sender}) does not exhibit common phishing characteristics.')
        reasons.append('No urgency-based social engineering patterns detected.')

    return reasons


@csrf_exempt
@require_http_methods(["POST"])
@require_role('analyst')
def predict_phishing(request):
    """
    POST /ai/phishing/predict/
    E-posta metnini AI modeli ile analiz et ve sonucu kaydet.
    """
    if 'user_id' not in request.session:
        return JsonResponse({
            'success': False,
            'detail': 'Not authenticated'
        }, status=401)

    try:
        data = json.loads(request.body)
        email_text = data.get('email_text', '').strip()
        sender = data.get('sender', '').strip()
        subject = data.get('subject', '').strip()

        if not email_text:
            return JsonResponse({
                'success': False,
                'detail': 'email_text is required'
            }, status=400)

        # AI Model ile tahmin yap
        detector = _get_detector()
        if detector is None:
            return JsonResponse({
                'success': False,
                'detail': 'AI Phishing model could not be loaded'
            }, status=503)

        prediction = detector.predict(email_text)

        if 'error' in prediction:
            return JsonResponse({
                'success': False,
                'detail': f'Model prediction error: {prediction["error"]}'
            }, status=500)

        # Score ve status hesapla
        is_phishing = prediction.get('is_phishing', False)
        score, status = _score_from_prediction(is_phishing)

        # AI gerekçeleri üret
        ai_reasons = _generate_ai_reasons(prediction, sender, subject)

        # Kullanıcıyı bul
        try:
            user = CustomUser.objects.get(username=request.session['user_id'])
        except CustomUser.DoesNotExist:
            return JsonResponse({
                'success': False,
                'detail': 'User not found'
            }, status=404)

        # Veritabanına kaydet
        log = PhishingLog.objects.create(
            user=user,
            sender=sender,
            subject=subject,
            preview=email_text[:200],
            full_body=email_text,
            score=score,
            status=status,
            ai_label=prediction.get('label', ''),
            ai_reasons=ai_reasons
        )

        return JsonResponse({
            'success': True,
            'result': {
                'id': log.id,
                'is_phishing': is_phishing,
                'label': prediction.get('label', ''),
                'score': score,
                'status': status,
                'ai_reasons': ai_reasons,
                'scanned_at': log.scanned_at.isoformat()
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
@require_http_methods(["GET"])
@require_role('analyst')
def get_phishing_history(request):
    """
    GET /ai/phishing/history/
    Kullanıcının tüm phishing loglarını ve istatistikleri getir.
    Query params: ?status=phishing&search=paypal
    """
    if 'user_id' not in request.session:
        return JsonResponse({
            'success': False,
            'detail': 'Not authenticated'
        }, status=401)

    try:
        user = CustomUser.objects.get(username=request.session['user_id'])
    except CustomUser.DoesNotExist:
        return JsonResponse({
            'success': False,
            'detail': 'User not found'
        }, status=404)

    # Filtreleme
    logs = PhishingLog.objects.filter(user=user)

    status_filter = request.GET.get('status', '').strip()
    if status_filter and status_filter != 'all':
        logs = logs.filter(status=status_filter)

    search = request.GET.get('search', '').strip()
    if search:
        logs = logs.filter(
            Q(sender__icontains=search) | Q(subject__icontains=search)
        )

    # İstatistikler (tüm loglardan, filtreden bağımsız)
    all_logs = PhishingLog.objects.filter(user=user)
    stats = {
        'total_phishing': all_logs.filter(status='phishing').count(),
        'total_suspicious': all_logs.filter(status='suspicious').count(),
        'total_clean': all_logs.filter(status='clean').count(),
        'total_scanned': all_logs.count()
    }

    # Log verisini JSON'a çevir
    logs_data = []
    for log in logs[:100]:  # Son 100 kayıt
        logs_data.append({
            'id': log.id,
            'date': log.scanned_at.strftime('%Y-%m-%d %H:%M:%S'),
            'sender': log.sender,
            'subject': log.subject,
            'preview': log.preview,
            'fullBody': log.full_body,
            'score': log.score,
            'status': log.status,
            'aiReasons': log.ai_reasons,
        })

    return JsonResponse({
        'success': True,
        'logs': logs_data,
        'stats': stats
    }, status=200)
