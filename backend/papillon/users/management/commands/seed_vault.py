"""
Django Management Command: seed_vault

Vault'u projenin ihtiyaç duyduğu secret'larla doldurur.
Mevcut .env dosyasından okuyarak veya interaktif giriş ile Vault'a yazar.

Kullanım:
    # .env'den oku ve Vault'a yaz
    python manage.py seed_vault

    # İnteraktif mod (her secret'ı tek tek sorar)
    python manage.py seed_vault --interactive

    # Sadece belirli bir path için
    python manage.py seed_vault --path papillon/database

    # Vault sağlık kontrolü
    python manage.py seed_vault --health-check

    # Mevcut secret'ları listele
    python manage.py seed_vault --list
"""

from django.core.management.base import BaseCommand, CommandError
import os
import environ
import getpass


class Command(BaseCommand):
    help = 'Vault\'u projenin secret\'larıyla doldurur (.env\'den veya interaktif)'

    # Vault path -> secret key'leri eşleştirmesi
    VAULT_SCHEMA = {
        'papillon/django': {
            'keys': ['SECRET_KEY', 'DEBUG'],
            'description': 'Django core ayarları',
        },
        'papillon/database': {
            'keys': ['DB_ENGINE', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_HOST', 'DB_PORT'],
            'description': 'Veritabanı bağlantı bilgileri',
        },
        'papillon/outlook': {
            'keys': ['OUTLOOK_CLIENT_ID', 'OUTLOOK_CLIENT_SECRET', 'OUTLOOK_TENANT_ID'],
            'description': 'Microsoft Outlook OAuth bilgileri',
        },
        'papillon/encryption': {
            'keys': ['ENCRYPTION_KEY'],
            'description': 'Genel şifreleme anahtarı',
        },
    }

    def add_arguments(self, parser):
        parser.add_argument(
            '--interactive', '-i',
            action='store_true',
            help='Her secret\'ı interaktif olarak sor',
        )
        parser.add_argument(
            '--path', '-p',
            type=str,
            default=None,
            help='Sadece belirli bir Vault path için seed yap (ör: papillon/database)',
        )
        parser.add_argument(
            '--health-check',
            action='store_true',
            help='Vault sağlık kontrolü yap',
        )
        parser.add_argument(
            '--list', '-l',
            action='store_true',
            help='Vault\'taki mevcut secret\'ları listele',
        )
        parser.add_argument(
            '--env-file',
            type=str,
            default=None,
            help='.env dosyasının yolu (varsayılan: papillon/.env)',
        )

    def handle(self, *args, **options):
        from papillon.vault_service import (
            write_secret, list_secrets, health_check, _get_client
        )

        # ─── Health check ────────────────────────────────────────
        if options['health_check']:
            self._health_check(health_check)
            return

        # ─── List ────────────────────────────────────────────────
        if options['list']:
            self._list_secrets(list_secrets)
            return

        # ─── Vault bağlantı kontrolü ────────────────────────────
        client = _get_client()
        if not client:
            raise CommandError(
                "Vault'a bağlanılamadı!\n"
                "  1) Vault çalışıyor mu?  →  vault server -dev\n"
                "  2) VAULT_ADDR set mi?   →  set VAULT_ADDR=http://127.0.0.1:8200\n"
                "  3) VAULT_TOKEN set mi?   →  set VAULT_TOKEN=<root-token>\n"
            )

        self.stdout.write(self.style.SUCCESS("✓ Vault bağlantısı başarılı.\n"))

        # ─── .env dosyasını yükle ────────────────────────────────
        env_data = {}
        if not options['interactive']:
            env_data = self._load_env(options.get('env_file'))

        # ─── Seed işlemi ─────────────────────────────────────────
        paths_to_seed = self.VAULT_SCHEMA
        if options['path']:
            if options['path'] not in self.VAULT_SCHEMA:
                raise CommandError(
                    f"Bilinmeyen path: {options['path']}\n"
                    f"Geçerli path'ler: {', '.join(self.VAULT_SCHEMA.keys())}"
                )
            paths_to_seed = {options['path']: self.VAULT_SCHEMA[options['path']]}

        total_written = 0
        for vault_path, schema in paths_to_seed.items():
            self.stdout.write(f"\n{'='*50}")
            self.stdout.write(f"  {vault_path} - {schema['description']}")
            self.stdout.write(f"{'='*50}")

            secret_data = {}
            for key in schema['keys']:
                if options['interactive']:
                    # İnteraktif mod
                    is_sensitive = any(w in key.upper() for w in ['PASSWORD', 'SECRET', 'KEY', 'TOKEN'])
                    if is_sensitive:
                        value = getpass.getpass(f"  {key}: ")
                    else:
                        value = input(f"  {key}: ")
                else:
                    # .env'den oku
                    value = env_data.get(key, '')

                if value:
                    secret_data[key] = value
                    display = '****' if any(w in key.upper() for w in ['PASSWORD', 'SECRET', 'KEY', 'TOKEN']) else value
                    self.stdout.write(f"  {key} = {display}")
                else:
                    self.stdout.write(self.style.WARNING(f"  {key} = (boş/atlandı)"))

            if secret_data:
                try:
                    write_secret(vault_path, secret_data)
                    total_written += len(secret_data)
                    self.stdout.write(self.style.SUCCESS(
                        f"  → {len(secret_data)} secret Vault'a yazıldı: {vault_path}"
                    ))
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"  → HATA: {e}"))
            else:
                self.stdout.write(self.style.WARNING(f"  → Hiç secret bulunamadı, atlandı."))

        self.stdout.write(f"\n{'='*50}")
        self.stdout.write(self.style.SUCCESS(
            f"Toplam {total_written} secret Vault'a yazıldı."
        ))
        self.stdout.write(
            "\nArtık .env'deki hassas bilgileri kaldırabilirsiniz.\n"
            "Vault secret'ları kontrol etmek için:\n"
            "  python manage.py seed_vault --list\n"
        )

    def _load_env(self, env_file_path=None):
        """Parse .env dosyasını ve key-value dict döndür"""
        if not env_file_path:
            from django.conf import settings
            env_file_path = os.path.join(settings.BASE_DIR, '.env')
            env_file_path = os.path.normpath(env_file_path)

        if not os.path.exists(env_file_path):
            self.stdout.write(self.style.WARNING(
                f".env dosyası bulunamadı: {env_file_path}\n"
                "İnteraktif mod kullanın: python manage.py seed_vault --interactive"
            ))
            return {}

        self.stdout.write(f".env dosyasından okunuyor: {env_file_path}")

        data = {}
        with open(env_file_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                if '=' in line:
                    key, value = line.split('=', 1)
                    data[key.strip()] = value.strip()

        self.stdout.write(f"  {len(data)} anahtar okundu.\n")
        return data

    def _health_check(self, health_check_fn):
        """Vault sağlık durumunu göster"""
        result = health_check_fn()

        self.stdout.write(f"\n{'='*40}")
        self.stdout.write("  Vault Sağlık Kontrolü")
        self.stdout.write(f"{'='*40}")
        self.stdout.write(f"  URL:            {result['url']}")

        if result['vault_available']:
            self.stdout.write(self.style.SUCCESS("  Durum:          Erişilebilir ✓"))
        else:
            self.stdout.write(self.style.ERROR("  Durum:          Erişilemez ✗"))

        if result['authenticated']:
            self.stdout.write(self.style.SUCCESS("  Auth:           Kimlik doğrulandı ✓"))
        else:
            self.stdout.write(self.style.ERROR("  Auth:           Kimlik doğrulanamadı ✗"))

        if result.get('sealed'):
            self.stdout.write(self.style.ERROR("  Sealed:         Evet (unseal gerekli)"))
        elif result['vault_available']:
            self.stdout.write(self.style.SUCCESS("  Sealed:         Hayır ✓"))

        enforce = result.get('enforce_mode', False)
        mode = "ZORUNLU (production)" if enforce else "İsteğe bağlı (.env fallback aktif)"
        self.stdout.write(f"  Enforce Mode:   {mode}")
        self.stdout.write(f"{'='*40}\n")

    def _list_secrets(self, list_secrets_fn):
        """Vault'taki tüm secret'ları listele"""
        self.stdout.write(f"\n{'='*40}")
        self.stdout.write("  Vault Secret Listesi")
        self.stdout.write(f"{'='*40}")

        try:
            # papillon/ altındaki tüm path'leri listele
            keys = list_secrets_fn(path='papillon')
            if keys:
                for key in keys:
                    self.stdout.write(f"  📁 papillon/{key}")
            else:
                self.stdout.write(self.style.WARNING("  Henüz hiç secret yok."))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"  Listeleme hatası: {e}"))

        self.stdout.write(f"{'='*40}\n")
