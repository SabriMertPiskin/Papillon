import pandas as pd
import numpy as np
import os
import glob  # <--- YENİ: Dosyaları bulmak için gerekli
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report, accuracy_score
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import StringTensorType

# --- AYARLAR ---
# 'archive' klasörünün script ile aynı yerde olduğunu varsayıyoruz
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ARCHIVE_PATH = os.path.join(BASE_DIR, "archive")

def find_text_and_label_columns(df, filename):
    """
    Her dosya için doğru sütunları bulmaya çalışır.
    """
    cols = [c.lower() for c in df.columns]
    
    # Olası sütun isimleri
    text_candidates = ['text', 'body', 'content', 'email', 'message', 'email_text']
    label_candidates = ['label', 'status', 'class', 'type', 'phishing', 'spam']
    
    text_col = None
    label_col = None
    
    # Text sütununu bul
    for cand in text_candidates:
        if cand in cols:
            text_col = df.columns[cols.index(cand)]
            break
            
    # Label sütununu bul
    for cand in label_candidates:
        if cand in cols:
            label_col = df.columns[cols.index(cand)]
            break
            
    # Bulamazsa en olasıları seç (Object -> Text, Int -> Label)
    if not text_col:
        obj_cols = df.select_dtypes(include=['object']).columns
        if len(obj_cols) > 0:
            text_col = obj_cols[0]
            
    if not label_col:
         # Genelde son sütun etikettir
        label_col = df.columns[-1]

    print(f"  -> '{filename}' için seçilen sütunlar: Text='{text_col}', Label='{label_col}'")
    return text_col, label_col

def train_nlp_model():
    print(f"Veri aranıyor: {ARCHIVE_PATH}")
    
    # Klasördeki TÜM .csv dosyalarını bul
    all_files = glob.glob(os.path.join(ARCHIVE_PATH, "*.csv"))
    
    if not all_files:
        print("HATA: 'archive' klasöründe hiç CSV dosyası bulunamadı!")
        return

    print(f"Bulunan dosya sayısı: {len(all_files)}")
    
    df_list = []
    
    # Her dosyayı tek tek oku ve standartlaştır
    for filename in all_files:
        try:
            # Okurken encoding hatası olursa diye önlem
            try:
                temp_df = pd.read_csv(filename, encoding='utf-8')
            except UnicodeDecodeError:
                temp_df = pd.read_csv(filename, encoding='latin-1')
                
            # Dosya boşsa atla
            if temp_df.empty:
                continue

            # Sütunları belirle
            text_col, label_col = find_text_and_label_columns(temp_df, os.path.basename(filename))
            
            # Sadece ihtiyacımız olan sütunları al ve isimlendir
            temp_df = temp_df[[text_col, label_col]].copy()
            temp_df.columns = ['text', 'target_raw'] # Standart isimler veriyoruz
            
            df_list.append(temp_df)
            
        except Exception as e:
            print(f"UYARI: {filename} dosyası okunamadı. Hata: {e}")

    if not df_list:
        print("HATA: Hiçbir dosya başarıyla okunamadı.")
        return

    # Tüm parçaları tek bir DataFrame'de birleştir
    df = pd.concat(df_list, ignore_index=True)
    print(f"\nTOPLAM Veri Seti Boyutu: {df.shape}")

    # --- VERİ TEMİZLEME VE ETİKETLEME ---
    df.dropna(inplace=True)
    
    # Target (Etiket) İşleme
    # Burası önemli: Farklı dosyalarda farklı etiketler olabilir (0/1, "safe"/"phishing")
    # Hepsini 0 ve 1'e çevireceğiz.
    
    print("Etiketler normalize ediliyor...")
    # Phishing olduğunu düşündüğümüz kelimeler
    phishing_keywords = ['phishing', 'spam', 'malicious', 'bad', '1']
    
    def normalize_label(val):
        s_val = str(val).lower().strip()
        if s_val in phishing_keywords or s_val == '1':
            return 1
        return 0

    df['target'] = df['target_raw'].apply(normalize_label)
    
    print(f"Sınıf Dağılımı:\n{df['target'].value_counts()}")

    X = df['text'].astype(str)
    y = df['target']

    # Train/Test Split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # --- MODEL EĞİTİMİ (PIPELINE) ---
    print("\nModel eğitiliyor...")
    pipeline = Pipeline([
        ('tfidf', TfidfVectorizer(max_features=5000, stop_words='english')),
        ('clf', RandomForestClassifier(n_estimators=100, max_depth=20, n_jobs=-1, random_state=42))
    ])

    pipeline.fit(X_train, y_train)

    # Test Sonuçları
    y_pred = pipeline.predict(X_test)
    print("\n--- SONUÇLAR ---")
    print(classification_report(y_test, y_pred))
    print(f"Accuracy: {accuracy_score(y_test, y_pred):.4f}")

    # --- ONNX EXPORT ---
    print("\nONNX Export işlemi...")
    initial_type = [('input_text', StringTensorType([None, 1]))]
    
    try:
        onx = convert_sklearn(pipeline, initial_types=initial_type)
        output_path = "phishing_email_model.onnx"
        with open(output_path, "wb") as f:
            f.write(onx.SerializeToString())
        print(f"BAŞARILI: Model '{output_path}' olarak kaydedildi.")
    except Exception as e:
        print(f"ONNX Hatası: {e}")

if __name__ == "__main__":
    train_nlp_model()