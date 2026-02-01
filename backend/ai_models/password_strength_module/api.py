#uvicorn api:app --reload
import joblib
import pandas as pd
from fastapi import FastAPI
from pydantic import BaseModel
from extract_features import extract_features

# FastAPI uygulaması
app = FastAPI(title="Password Strength AI")

# Modeli yükle
model = joblib.load("password_strength_model.pkl")

# Kullanıcıdan gelecek veri formatı
class PasswordInput(BaseModel):
    password: str

# Ana endpoint
@app.post("/predict")
def predict_strength(data: PasswordInput):
    features = pd.DataFrame([extract_features(data.password)])
    prediction = model.predict(features)[0]

    labels = {0: "Weak", 1: "Normal", 2: "Strong"}

    return {
        "password": data.password,
        "strength_level": int(prediction),
        "strength_label": labels[prediction]
    }
