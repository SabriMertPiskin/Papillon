import onnxruntime as rt
import numpy as np
import os

class PhishingDetector:
    _instance = None
    _sess = None

    def __new__(cls):
        # Singleton Pattern: Modeli her istekte tekrar yüklememek için
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
        except Exception as e:
            print(f"CRITICAL ERROR: Phishing model could not be loaded. {e}")
            self._sess = None

    def predict(self, email_text):
        if self._sess is None:
            return {"error": "Model not loaded"}

        try:
            # ONNX Runtime input formatı: [Batch_Size, 1] boyutunda numpy array
            inputs = np.array([[email_text]], dtype=object)
            
            input_name = self._sess.get_inputs()[0].name
            label_name = self._sess.get_outputs()[0].name
            
            # Tahmin yürüt
            pred_onx = self._sess.run([label_name], {input_name: inputs})[0]
            
            # Sonuç 1 ise Phishing, 0 ise Güvenli
            is_phishing = int(pred_onx[0])
            
            return {
                "is_phishing": is_phishing == 1,
                "label": "PHISHING" if is_phishing == 1 else "SAFE",
                "confidence": "High" # Random Forest ONNX çıktısında olasılık (proba) almak biraz daha karışıktır, şimdilik label yeterli.
            }
        except Exception as e:
            return {"error": str(e)}

# Test etmek istersen bu dosya doğrudan çalıştırıldığında burası devreye girer
if __name__ == "__main__":
    detector = PhishingDetector()
    sample_text = "Urgent! Verify your account immediately at http://fake-bank.com"
    print(detector.predict(sample_text))