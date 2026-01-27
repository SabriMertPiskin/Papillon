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
```

## For the Backend

### Create Python Virtual Environment
```bash
python -m venv venv
.\venv\Scripts\activate
```

### Install requirements
```bash
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
python .\manage.py runserver
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