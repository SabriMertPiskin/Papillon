# Setup

## For the Database

Install MySQL for the project. Do not forget to save your username and password for the environment file in the backend.
Add MySQL to path for executing commands such as 'mysql -u root -p'.


### Create User and DB 
```bash
# Open Windows Powershell and run:
mysql -u root -p

# After logging in with your password, run:
CREATE DATABASE papillon CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'papillon'@'localhost' IDENTIFIED BY 'YOUR_MYSQL_PASSWORD';
GRANT ALL PRIVILEGES ON papillon.* TO 'papillon'@'localhost';
FLUSH PRIVILEGES;

# Connect to DB
SHOW DATABASES;
USE papillon;
SHOW TABLES;
```

## For the Backend

### Create Python Virtual Environment
```bash
# After clonning the repo, get to path:
cd backend

# Install Virtual Environment
python -m venv venv
.\venv\Scripts\activate

# Install requirements
pip install -r requirements.txt
```

### Change the environtment file according to the .env.example
```env
DEBUG=True
SECRET_KEY=django-insecure-papillon-secret-key-2025
DB_ENGINE=django.db.backends.mysql
DB_NAME=papillon
DB_USER=db_user
DB_PASSWORD=db_password
DB_HOST=127.0.0.1
DB_PORT=3306
```

### Migrate and Run Server
```bash
cd papillon 

python .\manage.py migrate
python .\manage.py makemigrations
python .\manage.py runserver # For running backend with KMS vault, check the "For the KMS Vault" section!!
```

Do not forget to check MySQL Workbench that Papillon Database has been created or not.

### Verify DB <-> Backend Connection
```bash
# Open Python shell
python .\manage.py shell
```

```python
# Run the scripts and see the results:
from django.db import connection
cursor = connection.cursor()
cursor.execute("SELECT DATABASE();")
print(cursor.fetchone())  # papillon yazacak

cursor.execute("SHOW TABLES;")
print(cursor.fetchall())  # Tüm tabloları listeler
```

#### Faster way!
```bash
python manage.py dbshell
# Connects to MySQL shell to run SQL scripts.
```

---

## For the KMS Vault

### Install Vault for Windows

```powershell
winget install Hashicorp.Vault

# Verify with 'vault version'
```

### Start Vault Server (Development Mode)

```powershell
# Run below in different terminal
vault server -dev
```

Output will be:
```
==> Vault server configuration:
             Api Address: http://127.0.0.1:8200
                     ...
Unseal Key: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Root Token: hvs.XXXXXXXXXXXXXXXXXXXXXXXXX
```

**Copy the Root Token**, you will need it after.

Vault runs on this terminal, don't kill it.

---

### Set Environment Variable's

Create a new terminal, then:

```powershell
$env:VAULT_ADDR = "http://127.0.0.1:8200"
$env:VAULT_TOKEN = "hvs.XXXXXXXXXXXXXXXXXXXXXXXXX"  # Copied token from vault terminal output
```

**Important:** These variables are only valid for this terminal session. You will need to set them again each time you open a new terminal.

### Move secrets from .env to Vault

```powershell
cd path/to/backend/papillon
python manage.py seed_vault
```

Output should look like:
```
✓ Vault bağlantısı başarılı.

.env dosyasından okunuyor: ...\papillon\.env
  8 anahtar okundu.

==================================================
  papillon/django - Django core ayarları
==================================================
  SECRET_KEY = ****
  DEBUG = True
  → 2 secret Vault'a yazıldı: papillon/django

==================================================
  papillon/database - Veritabanı bağlantı bilgileri
==================================================
  DB_ENGINE = django.db.backends.mysql
  DB_NAME = papillon
  DB_USER = root
  DB_PASSWORD = ****
  DB_HOST = 127.0.0.1
  DB_PORT = 3306
  → 6 secret Vault'a yazıldı: papillon/database

==================================================
Toplam 8 secret Vault'a yazıldı.
```

### Run backend with Vault

**Aynı terminalde** (`VAULT_ADDR` and `VAULT_TOKEN` which are set):
```powershell
python manage.py runserver
```


### Virutal Box Kurulum
Virtual Box icin:
https://www.virtualbox.org/wiki/Downloads

Kali iso icin: 
https://www.kali.org/get-kali/#kali-installer-images

Windows kurulmasi kontrol:
& "C:\Program Files\Oracle\VirtualBox\VBoxManage.exe" list vms

Projede manuel test: 
http://localhost:5001/start-vm

Agent icin kurulmasi gereken makine ismi: django-kali
Agent Path:
Papillon\backend\ai_models\agent.py
Lokalde onceden calistirilacak