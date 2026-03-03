import os
import json
import joblib
import numpy as np
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

# Model path (aynı klasörde)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MODEL_PATH = os.path.join(BASE_DIR, "xgb_model.pkl")
ENCODER_PATH = os.path.join(BASE_DIR, "label_encoder.pkl")

model = joblib.load(MODEL_PATH)
label_encoder = joblib.load(ENCODER_PATH)


@csrf_exempt
def predict_intrusion(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            features = data.get("features")

            if not features:
                return JsonResponse({"error": "Features not provided"}, status=400)

            features = np.array(features).reshape(1, -1)

            prediction = model.predict(features)

            predicted_label = label_encoder.inverse_transform(prediction)[0]

            return JsonResponse({
                "prediction": predicted_label
            })

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"message": "Send POST request with features"})