import pandas as pd
import joblib
import re

model = joblib.load("password_strength_model.pkl")
def calculate_entropy(password):
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

    if re.search(r"[!@#$%^&*(),.?\":{}|<>_\-+=/\\[\]~`]", password):
        charset_size += 32  # yaklaşık değer

    if charset_size == 0:
        return 0

    entropy = len(password) * math.log2(charset_size)
    return entropy

def extract_features(password):
    return {
        "length": len(password),
        "has_upper": int(bool(re.search(r"[A-Z]", password))),
        "has_lower": int(bool(re.search(r"[a-z]", password))),
        "has_digit": int(bool(re.search(r"[0-9]", password))),
        "has_special": int(bool(re.search(r"[!@#$%^&*(),.?\":{}|<>]", password))),
        "digit_count": len(re.findall(r"[0-9]", password)),
        "special_count": len(re.findall(r"[!@#$%^&*(),.?\":{}|<>]", password)),
        "entropy": calculate_entropy(password),
        "unique_chars": len(set(password)),
        "repeated_ratio": len(password) / len(set(password)) if len(set(password)) > 0 else 0
    }

def predict_password_strength(password: str):
    features = pd.DataFrame([extract_features(password)])
    prediction = model.predict(features)[0]

    labels = {0: "Weak", 1: "Normal", 2: "Strong"}

    return {
        "password": password,
        "strength_level": int(prediction),
        "strength_label": labels[prediction]
    }