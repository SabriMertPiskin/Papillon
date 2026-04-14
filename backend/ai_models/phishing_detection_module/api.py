"""
Papillon Phishing Detection — ONNX Inference API (v2)
=====================================================
Returns probability scores instead of just binary labels.
"""
import onnxruntime as rt
import numpy as np
import os


class PhishingDetector:
    _instance = None
    _sess = None
    _has_proba = False

    def __new__(cls):
        # Singleton Pattern: Don't reload model on every request
        if cls._instance is None:
            cls._instance = super(PhishingDetector, cls).__new__(cls)
            cls._instance._load_model()
        return cls._instance

    def _load_model(self):
        try:
            base_dir = os.path.dirname(os.path.abspath(__file__))
            model_path = os.path.join(base_dir, "phishing_email_model.onnx")
            print(f"Loading Phishing Model from: {model_path}")
            self._sess = rt.InferenceSession(model_path)

            # Check available outputs
            output_names = [o.name for o in self._sess.get_outputs()]
            self._has_proba = 'probabilities' in output_names
            print(f"  ONNX outputs: {output_names} (proba={self._has_proba})")
        except Exception as e:
            print(f"CRITICAL ERROR: Phishing model could not be loaded. {e}")
            self._sess = None

    def predict(self, email_text):
        if self._sess is None:
            return {"error": "Model not loaded"}

        try:
            # ONNX Runtime input: [Batch_Size, 1] numpy array
            inputs = np.array([[email_text]], dtype=object)

            input_name = self._sess.get_inputs()[0].name

            if self._has_proba:
                # v2: Get both label and probabilities
                label_name = self._sess.get_outputs()[0].name    # 'label'
                proba_name = self._sess.get_outputs()[1].name    # 'probabilities'
                result = self._sess.run([label_name, proba_name], {input_name: inputs})

                predicted_label = int(result[0][0])
                probabilities = result[1][0]  # [P(safe), P(phishing)]

                # Extract confidence values
                p_safe = float(probabilities[0])
                p_phishing = float(probabilities[1])

                return {
                    "is_phishing": predicted_label == 1,
                    "label": "PHISHING" if predicted_label == 1 else "SAFE",
                    "confidence": round(max(p_safe, p_phishing), 4),
                    "p_phishing": round(p_phishing, 4),
                    "p_safe": round(p_safe, 4),
                }
            else:
                # Fallback: legacy model without probability output
                label_name = self._sess.get_outputs()[0].name
                pred = self._sess.run([label_name], {input_name: inputs})[0]
                predicted_label = int(pred[0])

                return {
                    "is_phishing": predicted_label == 1,
                    "label": "PHISHING" if predicted_label == 1 else "SAFE",
                    "confidence": 0.90 if predicted_label == 1 else 0.10,
                    "p_phishing": 0.90 if predicted_label == 1 else 0.10,
                    "p_safe": 0.10 if predicted_label == 1 else 0.90,
                }
        except Exception as e:
            return {"error": str(e)}


# Quick test
if __name__ == "__main__":
    detector = PhishingDetector()

    tests = [
        "Urgent! Verify your account immediately at http://fake-bank.com or it will be suspended",
        "Hi, your order has been shipped. Thank you for shopping with us. Track your package here.",
        "CONGRATULATIONS! You have won $1,000,000. Click here to claim your prize now!",
        "Meeting notes from today's standup. Please review the attached document.",
        "Your PayPal account has been limited. Confirm your identity within 24 hours.",
    ]

    for text in tests:
        result = detector.predict(text)
        print(f"\n{'PHISHING' if result['is_phishing'] else 'SAFE'} "
              f"(confidence: {result['confidence']:.1%}, "
              f"P(phish): {result['p_phishing']:.1%}) "
              f"-> {text[:60]}...")