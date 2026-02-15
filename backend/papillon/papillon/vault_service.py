"""
HashiCorp Vault Secret Management Service

Bu modül, hassas bilgilerin (DB password, SECRET_KEY, API key'ler vb.)
güvenli bir şekilde HashiCorp Vault üzerinden yönetilmesini sağlar.

Vault erişilebilir değilse .env'ye fallback yapar (sadece development).
Production ortamda VAULT_ENFORCE=True olmalıdır.

Vault Kurulumu (dev mode):
    vault server -dev
    export VAULT_ADDR='http://127.0.0.1:8200'

Secret'ları yüklemek için:
    python manage.py seed_vault
"""

import os
import logging
import environ

logger = logging.getLogger(__name__)

# .env fallback için
env = environ.Env()
_env_loaded = False


def _ensure_env_loaded():
    """Lazy-load .env dosyasını sadece fallback gerektiğinde yükle"""
    global _env_loaded
    if not _env_loaded:
        env_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'
        )
        if os.path.exists(env_path):
            environ.Env.read_env(env_path)
        _env_loaded = True


def _get_vault_client():
    """
    Vault client oluştur. Bağlantı bilgileri environment variable'dan gelir.
    Bu değerler .env'de değil, sistem environment'ında veya container config'inde olmalı.
    """
    try:
        import hvac
    except ImportError:
        logger.warning("hvac kütüphanesi yüklü değil. pip install hvac")
        return None

    vault_addr = os.environ.get('VAULT_ADDR', 'http://127.0.0.1:8200')
    vault_token = os.environ.get('VAULT_TOKEN', None)
    vault_role_id = os.environ.get('VAULT_ROLE_ID', None)
    vault_secret_id = os.environ.get('VAULT_SECRET_ID', None)

    if not vault_token and not vault_role_id:
        logger.debug("Vault token veya AppRole credentials bulunamadı.")
        return None

    try:
        client = hvac.Client(url=vault_addr, token=vault_token)

        # AppRole authentication (production için önerilen)
        if not vault_token and vault_role_id and vault_secret_id:
            auth_response = client.auth.approle.login(
                role_id=vault_role_id,
                secret_id=vault_secret_id
            )
            client.token = auth_response['auth']['client_token']

        if client.is_authenticated():
            logger.info("Vault bağlantısı başarılı.")
            return client
        else:
            logger.warning("Vault authentication başarısız.")
            return None
    except Exception as e:
        logger.warning(f"Vault bağlantı hatası: {e}")
        return None


# ─── Singleton Vault Client ───────────────────────────────────────────
_vault_client = None
_vault_initialized = False


def _get_client():
    """Singleton vault client döndür"""
    global _vault_client, _vault_initialized
    if not _vault_initialized:
        _vault_client = _get_vault_client()
        _vault_initialized = True
    return _vault_client


# ─── Secret Cache (her secret için Vault'a tekrar tekrar gitmeyi önler) ──
_secret_cache = {}


def _read_vault_secret(path, mount_point='secret'):
    """
    Vault KV v2 secret engine'den secret oku.
    Cache kullanarak tekrarlı okumalardan kaçınır.
    """
    cache_key = f"{mount_point}/{path}"
    if cache_key in _secret_cache:
        return _secret_cache[cache_key]

    client = _get_client()
    if not client:
        return None

    try:
        response = client.secrets.kv.v2.read_secret_version(
            path=path,
            mount_point=mount_point
        )
        data = response['data']['data']
        _secret_cache[cache_key] = data
        logger.debug(f"Vault'tan secret okundu: {path}")
        return data
    except Exception as e:
        logger.warning(f"Vault'tan secret okunamadı ({path}): {e}")
        return None


def clear_cache():
    """Secret cache'i temizle (key rotation sonrası kullanılır)"""
    global _secret_cache
    _secret_cache = {}
    logger.info("Vault secret cache temizlendi.")


# ─── Public API ───────────────────────────────────────────────────────

def get_secret(key, default=None, vault_path=None, mount_point='secret'):
    """
    Secret değerini döndür.

    Öncelik sırası:
        1. Vault (vault_path/key)
        2. .env dosyasından fallback
        3. default değer

    Args:
        key: Secret key adı (ör: 'SECRET_KEY', 'DB_PASSWORD')
        default: Fallback değer
        vault_path: Vault'taki path (ör: 'papillon/django', 'papillon/database')
        mount_point: Vault secret engine mount point

    Returns:
        Secret değeri (str)

    Örnek:
        SECRET_KEY = get_secret('SECRET_KEY', vault_path='papillon/django')
        DB_PASSWORD = get_secret('DB_PASSWORD', vault_path='papillon/database')
    """
    # 1) Vault'tan dene
    if vault_path:
        vault_data = _read_vault_secret(vault_path, mount_point)
        if vault_data and key in vault_data:
            return vault_data[key]

    # Enforce modu: Vault zorunluysa ve secret bulunamazsa hata ver
    enforce = os.environ.get('VAULT_ENFORCE', 'false').lower() == 'true'
    if enforce and vault_path:
        raise RuntimeError(
            f"VAULT_ENFORCE=True ama '{key}' Vault'tan okunamadı! "
            f"(path: {vault_path}). Vault çalışıyor mu?"
        )

    # 2) .env fallback (sadece dev ortamda)
    _ensure_env_loaded()
    try:
        value = env(key)
        if value:
            logger.debug(f"'{key}' .env fallback'tan okundu (Vault'ta bulunamadı).")
            return value
    except Exception:
        pass

    # 3) Default
    if default is not None:
        logger.debug(f"'{key}' default değer kullanıldı.")
        return default

    return None


def get_secret_bool(key, default=False, vault_path=None, mount_point='secret'):
    """Boolean secret döndür"""
    value = get_secret(key, default=None, vault_path=vault_path, mount_point=mount_point)
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).lower() in ('true', '1', 'yes', 'on')


def get_secret_int(key, default=0, vault_path=None, mount_point='secret'):
    """Integer secret döndür"""
    value = get_secret(key, default=None, vault_path=vault_path, mount_point=mount_point)
    if value is None:
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


# ─── Vault'a Secret Yazma (seed script için) ─────────────────────────

def write_secret(path, data, mount_point='secret'):
    """
    Vault'a secret yaz.
    Sadece seed_vault management command tarafından kullanılır.
    """
    client = _get_client()
    if not client:
        raise RuntimeError("Vault bağlantısı kurulamadı. VAULT_ADDR ve VAULT_TOKEN kontrol edin.")

    try:
        client.secrets.kv.v2.create_or_update_secret(
            path=path,
            secret=data,
            mount_point=mount_point
        )
        logger.info(f"Secret yazıldı: {mount_point}/{path}")
        return True
    except Exception as e:
        logger.error(f"Secret yazılamadı ({path}): {e}")
        raise


def list_secrets(path='', mount_point='secret'):
    """Vault'taki secret'ları listele"""
    client = _get_client()
    if not client:
        raise RuntimeError("Vault bağlantısı kurulamadı.")

    try:
        response = client.secrets.kv.v2.list_secrets(
            path=path,
            mount_point=mount_point
        )
        return response['data']['keys']
    except Exception as e:
        logger.warning(f"Secret listelenemedi ({path}): {e}")
        return []


def delete_secret(path, mount_point='secret'):
    """Vault'tan secret sil"""
    client = _get_client()
    if not client:
        raise RuntimeError("Vault bağlantısı kurulamadı.")

    try:
        client.secrets.kv.v2.delete_metadata_and_all_versions(
            path=path,
            mount_point=mount_point
        )
        logger.info(f"Secret silindi: {mount_point}/{path}")
        return True
    except Exception as e:
        logger.error(f"Secret silinemedi ({path}): {e}")
        raise


def health_check():
    """
    Vault sağlık kontrolü.
    Returns:
        dict: {'vault_available': bool, 'authenticated': bool, 'url': str}
    """
    vault_addr = os.environ.get('VAULT_ADDR', 'http://127.0.0.1:8200')
    client = _get_client()

    result = {
        'vault_available': False,
        'authenticated': False,
        'url': vault_addr,
        'enforce_mode': os.environ.get('VAULT_ENFORCE', 'false').lower() == 'true'
    }

    if client:
        try:
            health = client.sys.read_health_status(method='GET')
            result['vault_available'] = True
            result['authenticated'] = client.is_authenticated()
            result['initialized'] = health.get('initialized', False)
            result['sealed'] = health.get('sealed', True)
        except Exception:
            pass

    return result
