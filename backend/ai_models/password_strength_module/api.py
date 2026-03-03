# password_ai/views.py
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .pipeline import predict_password_strength


@csrf_exempt
def predict_strength(request):
    if request.method == "POST":
        body = json.loads(request.body)
        password = body.get("password")

        result = predict_password_strength(password)
        return JsonResponse(result)

    return JsonResponse({"error": "Only POST allowed"})