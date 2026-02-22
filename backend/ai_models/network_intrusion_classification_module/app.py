#uvicorn app:app --reload
#http://127.0.0.1:8000/docs
from fastapi import FastAPI
from pydantic import BaseModel
import joblib
import numpy as np

app = FastAPI(title="Intrusion Detection API")

model = joblib.load("xgb_model.pkl")
scaler = joblib.load("scaler.pkl")
label_encoder = joblib.load("label_encoder.pkl")

class NetworkPacket(BaseModel):
    features: list[float]

@app.get("/")
def home():
    return {"message": "Intrusion Detection API is running"}

@app.post("/predict")
def predict(packet: NetworkPacket):
    data = np.array(packet.features).reshape(1, -1)
    data_scaled = scaler.transform(data)

    prediction = model.predict(data_scaled)
    label = label_encoder.inverse_transform(prediction)

    return {
        "prediction": label[0]
    }
    
'''example json
{
  "features": [
    443,
    208,
    4,
    46,
    0,
    46,
    0,
    11.5,
    23.0,
    0,
    0,
    221153.8462,
    19230.76923,
    69.333333,
    4,
    69.333333,
    4,
    0,
    0.0,
    0,
    0,
    0,
    0,
    0,
    0.0,
    0,
    423.2,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    306,
    -1,
    32,
    0.0,
    0.0,
    0,
    0.0
  ]
}
''' 