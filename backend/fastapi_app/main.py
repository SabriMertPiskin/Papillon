from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(
    title="Papillon FastAPI Bridge",
    version="0.1.0",
    description="Minimal FastAPI service to demonstrate async-friendly API usage in Papillon.",
)


class PasswordRequest(BaseModel):
    password: str = Field(min_length=1, max_length=256)


@app.get("/health")
def health_check() -> dict:
    return {"ok": True, "service": "fastapi", "message": "Papillon FastAPI is running"}


@app.post("/password-strength/predict")
def predict_password_strength(payload: PasswordRequest) -> dict:
    password = payload.password

    score = 0
    if len(password) >= 8:
        score += 1
    if len(password) >= 12:
        score += 1
    if any(c.isupper() for c in password):
        score += 1
    if any(c.islower() for c in password):
        score += 1
    if any(c.isdigit() for c in password):
        score += 1
    if any(not c.isalnum() for c in password):
        score += 1

    if score >= 5:
        label = "Strong"
        suggestions = ["Use a password manager", "Rotate password periodically"]
    elif score >= 3:
        label = "Normal"
        suggestions = ["Increase length to 12+", "Add symbols and mixed case"]
    else:
        label = "Weak"
        suggestions = ["Use at least 12 chars", "Add uppercase, numbers and symbols"]

    return {
        "success": True,
        "prediction": label,
        "suggestions": suggestions,
        "source": "fastapi",
    }
