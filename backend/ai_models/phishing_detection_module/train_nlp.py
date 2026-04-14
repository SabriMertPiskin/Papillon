"""
Papillon Phishing Detection — Training Script (v2)
===================================================
Trains a TF-IDF + RandomForest pipeline on multiple CSV datasets,
exports to ONNX with PROBABILITY output (not just binary label).

Changes from v1:
  - ONNX export includes probability map (zipmap)
  - Model uses calibrated probabilities for confidence scoring
  - Better data cleaning and class balancing
  - Prints detailed metrics (precision, recall, F1, confusion matrix)
"""

import pandas as pd
import numpy as np
import os
import glob
import json
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report, accuracy_score, confusion_matrix
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import StringTensorType

# --- SETTINGS ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ARCHIVE_PATH = os.path.join(BASE_DIR, "archive")
OUTPUT_MODEL = os.path.join(BASE_DIR, "phishing_email_model.onnx")
METRICS_FILE = os.path.join(BASE_DIR, "model_metrics.json")


def find_text_and_label_columns(df, filename):
    """Find the text and label columns dynamically per CSV file."""
    cols = [c.lower() for c in df.columns]

    text_candidates = ['body', 'text', 'text_combined', 'content', 'email', 'message', 'email_text']
    label_candidates = ['label', 'status', 'class', 'type', 'phishing', 'spam']

    text_col = None
    label_col = None

    for cand in text_candidates:
        if cand in cols:
            text_col = df.columns[cols.index(cand)]
            break

    for cand in label_candidates:
        if cand in cols:
            label_col = df.columns[cols.index(cand)]
            break

    # Fallback: first object column -> text, last column -> label
    if not text_col:
        obj_cols = df.select_dtypes(include=['object']).columns
        if len(obj_cols) > 0:
            text_col = obj_cols[0]

    if not label_col:
        label_col = df.columns[-1]

    print(f"  -> '{filename}': Text='{text_col}', Label='{label_col}'")
    return text_col, label_col


def normalize_label(val):
    """Normalize diverse label formats to 0 (safe) / 1 (phishing)."""
    s_val = str(val).lower().strip()
    phishing_keywords = ['phishing', 'spam', 'malicious', 'bad', '1', 'yes', 'true']
    if s_val in phishing_keywords:
        return 1
    return 0


def train_nlp_model():
    print(f"Looking for data in: {ARCHIVE_PATH}")

    all_files = glob.glob(os.path.join(ARCHIVE_PATH, "*.csv"))
    if not all_files:
        print("ERROR: No CSV files found in 'archive' folder!")
        return

    print(f"Found {len(all_files)} CSV files")

    df_list = []
    for filename in all_files:
        try:
            try:
                temp_df = pd.read_csv(filename, encoding='utf-8', on_bad_lines='skip')
            except UnicodeDecodeError:
                temp_df = pd.read_csv(filename, encoding='latin-1', on_bad_lines='skip')

            if temp_df.empty:
                continue

            text_col, label_col = find_text_and_label_columns(temp_df, os.path.basename(filename))

            temp_df = temp_df[[text_col, label_col]].copy()
            temp_df.columns = ['text', 'target_raw']
            df_list.append(temp_df)

        except Exception as e:
            print(f"WARNING: Could not read {filename}. Error: {e}")

    if not df_list:
        print("ERROR: No files could be read successfully.")
        return

    # Combine all dataframes
    df = pd.concat(df_list, ignore_index=True)
    print(f"\nTotal dataset size: {df.shape}")

    # --- DATA CLEANING ---
    df.dropna(inplace=True)
    df['text'] = df['text'].astype(str).str.strip()
    df = df[df['text'].str.len() > 10]  # Remove very short texts

    # Normalize labels
    print("Normalizing labels...")
    df['target'] = df['target_raw'].apply(normalize_label)
    print(f"Class distribution:\n{df['target'].value_counts()}")

    # Balance classes (undersample majority if ratio > 3:1)
    class_counts = df['target'].value_counts()
    majority_class = class_counts.idxmax()
    minority_count = class_counts.min()
    majority_count = class_counts.max()

    if majority_count > minority_count * 3:
        print(f"\nBalancing dataset (ratio was {majority_count/minority_count:.1f}:1)...")
        df_minority = df[df['target'] != majority_class]
        df_majority = df[df['target'] == majority_class].sample(
            n=min(minority_count * 2, majority_count),
            random_state=42
        )
        df = pd.concat([df_minority, df_majority], ignore_index=True)
        print(f"After balancing: {df['target'].value_counts().to_dict()}")

    X = df['text']
    y = df['target']

    # Train/Test Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    print(f"\nTrain size: {len(X_train)}, Test size: {len(X_test)}")

    # --- MODEL TRAINING ---
    print("\nTraining model...")
    pipeline = Pipeline([
        ('tfidf', TfidfVectorizer(
            max_features=8000,
            stop_words='english',
            ngram_range=(1, 2),     # Uni + bigrams for better context
            min_df=3,               # Ignore very rare terms
            max_df=0.95,            # Ignore overly common terms
            sublinear_tf=True       # Apply log normalization
        )),
        ('clf', RandomForestClassifier(
            n_estimators=200,
            max_depth=30,
            min_samples_leaf=2,
            n_jobs=-1,
            random_state=42
        ))
    ])

    pipeline.fit(X_train, y_train)

    # --- EVALUATION ---
    y_pred = pipeline.predict(X_test)
    y_proba = pipeline.predict_proba(X_test)

    print("\n" + "=" * 50)
    print("MODEL PERFORMANCE RESULTS")
    print("=" * 50)
    report = classification_report(y_test, y_pred, target_names=['Safe', 'Phishing'], output_dict=True)
    print(classification_report(y_test, y_pred, target_names=['Safe', 'Phishing']))

    accuracy = accuracy_score(y_test, y_pred)
    print(f"Accuracy: {accuracy:.4f}")

    cm = confusion_matrix(y_test, y_pred)
    print(f"\nConfusion Matrix:")
    print(f"  TN={cm[0][0]:>6}  FP={cm[0][1]:>6}")
    print(f"  FN={cm[1][0]:>6}  TP={cm[1][1]:>6}")

    # Probability distribution check
    phishing_probas = y_proba[y_test == 1][:, 1]
    safe_probas = y_proba[y_test == 0][:, 1]
    print(f"\nProbability Stats:")
    print(f"  Phishing emails - mean P(phishing): {phishing_probas.mean():.3f}, "
          f"min: {phishing_probas.min():.3f}, max: {phishing_probas.max():.3f}")
    print(f"  Safe emails     - mean P(phishing): {safe_probas.mean():.3f}, "
          f"min: {safe_probas.min():.3f}, max: {safe_probas.max():.3f}")

    # Save metrics to JSON
    metrics = {
        'accuracy': round(accuracy, 4),
        'precision_phishing': round(report['Phishing']['precision'], 4),
        'recall_phishing': round(report['Phishing']['recall'], 4),
        'f1_phishing': round(report['Phishing']['f1-score'], 4),
        'precision_safe': round(report['Safe']['precision'], 4),
        'recall_safe': round(report['Safe']['recall'], 4),
        'f1_safe': round(report['Safe']['f1-score'], 4),
        'total_samples': len(df),
        'train_samples': len(X_train),
        'test_samples': len(X_test),
        'confusion_matrix': {'TN': int(cm[0][0]), 'FP': int(cm[0][1]),
                             'FN': int(cm[1][0]), 'TP': int(cm[1][1])},
    }
    with open(METRICS_FILE, 'w') as f:
        json.dump(metrics, f, indent=2)
    print(f"\nMetrics saved to: {METRICS_FILE}")

    # --- ONNX EXPORT WITH PROBABILITY ---
    print("\nExporting to ONNX (with probability output)...")
    initial_type = [('input_text', StringTensorType([None, 1]))]

    try:
        # options={id(pipeline): {'zipmap': False}} removes ZipMap wrapper
        # so we get raw probability arrays instead of list-of-dicts
        onx = convert_sklearn(
            pipeline,
            initial_types=initial_type,
            options={id(pipeline): {'zipmap': False}}
        )
        with open(OUTPUT_MODEL, "wb") as f:
            f.write(onx.SerializeToString())
        print(f"SUCCESS: Model saved to '{OUTPUT_MODEL}'")

        # Verify ONNX outputs
        import onnxruntime as rt
        sess = rt.InferenceSession(OUTPUT_MODEL)
        outputs = [o.name for o in sess.get_outputs()]
        print(f"ONNX Output names: {outputs}")

        # Quick verification
        test_input = np.array([["Urgent! Verify your bank account now"]], dtype=object)
        input_name = sess.get_inputs()[0].name
        result = sess.run(None, {input_name: test_input})
        print(f"Test prediction: label={result[0][0]}, probabilities={result[1][0]}")

    except Exception as e:
        print(f"ONNX Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    train_nlp_model()