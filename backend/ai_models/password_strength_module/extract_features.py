# %%
import pandas as pd
import numpy as np
import re
import math
from datasets import load_dataset
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report

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


# %%
dataset = load_dataset("RanveerChaudhary/password_strength_dataset")
df = dataset["train"].to_pandas()
print(df.head())

# %%
feature_list = df['password'].apply(extract_features) #returns dict list
features_df = pd.DataFrame(feature_list.tolist())

print(feature_list.head())


# %%
X = features_df
y = df["strength"]   

from sklearn.model_selection import train_test_split

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

model = RandomForestClassifier(n_estimators=300, random_state=42)
model.fit(X_train, y_train)



# %%
from sklearn.metrics import classification_report, confusion_matrix

y_pred = model.predict(X_test)

print(classification_report(y_test, y_pred))
print(confusion_matrix(y_test, y_pred))


# %%
def predict_password_strength(password):
    features = pd.DataFrame([extract_features(password)])
    prediction = model.predict(features)[0]
    probs = model.predict_proba(features)[0]
    return prediction, probs

test_pw = "Fs2mt9rNyYYB8zXE9EoR5a11MyC5Txp4JnfKS57QBqsXO41f81gfBCrUYRcPYx4EjdqNwV2QPVz6t1a18WU"
pred, prob = predict_password_strength(test_pw)

print("Tahmin:", pred)
print("Olasılıklar:", prob)


# %%
import joblib

joblib.dump(model, "password_strength_model.pkl")
print("Model kaydedildi")



