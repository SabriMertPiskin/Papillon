from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json
import base64
import os
import hashlib
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.backends import default_backend

@csrf_exempt
@require_http_methods(["POST"])
def encrypt_text(request):
    """Encrypt/hash text using various algorithms"""
    try:
        data = json.loads(request.body)
        plaintext = data.get('text', '')
        algorithm = data.get('algorithm', 'AES-256-GCM')
        
        if not plaintext:
            return JsonResponse({
                'success': False,
                'detail': 'Text is required'
            }, status=400)
        
        if algorithm == 'AES-256-GCM':
            # AES-256-GCM encryption
            key = AESGCM.generate_key(bit_length=256)
            nonce = os.urandom(12)
            
            aesgcm = AESGCM(key)
            ciphertext = aesgcm.encrypt(nonce, plaintext.encode('utf-8'), None)
            
            encrypted_data = {
                'ciphertext': base64.b64encode(ciphertext).decode('utf-8'),
                'key': base64.b64encode(key).decode('utf-8'),
                'nonce': base64.b64encode(nonce).decode('utf-8')
            }
            
            return JsonResponse({
                'success': True,
                'algorithm': 'AES-256-GCM',
                'encrypted': encrypted_data,
                'note': 'Key ve nonce şifre çözmek için gereklidir. Güvenli saklayın!'
            }, status=200)
        
        elif algorithm == 'RSA-2048':
            # RSA-2048 encryption
            private_key = rsa.generate_private_key(
                public_exponent=65537,
                key_size=2048,
                backend=default_backend()
            )
            public_key = private_key.public_key()
            
            ciphertext = public_key.encrypt(
                plaintext.encode('utf-8'),
                padding.OAEP(
                    mgf=padding.MGF1(algorithm=hashes.SHA256()),
                    algorithm=hashes.SHA256(),
                    label=None
                )
            )
            
            private_pem = private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption()
            )
            
            public_pem = public_key.public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo
            )
            
            encrypted_data = {
                'ciphertext': base64.b64encode(ciphertext).decode('utf-8'),
                'private_key': private_pem.decode('utf-8'),
                'public_key': public_pem.decode('utf-8')
            }
            
            return JsonResponse({
                'success': True,
                'algorithm': 'RSA-2048',
                'encrypted': encrypted_data,
                'note': 'Private key şifre çözmek için gereklidir. GÜVENLİ SAKLAYIN!'
            }, status=200)
        
        elif algorithm == 'MD5':
            # MD5 hash (deprecated, for reference only)
            hash_result = hashlib.md5(plaintext.encode('utf-8')).hexdigest()
            
            return JsonResponse({
                'success': True,
                'algorithm': 'MD5',
                'encrypted': {'hash': hash_result},
                'note': 'MD5 deprecated! Sadece referans için. Gerçek kullanımda SHA-256+ kullanın.'
            }, status=200)
        
        elif algorithm == 'SHA-1':
            # SHA-1 hash (deprecated)
            hash_result = hashlib.sha1(plaintext.encode('utf-8')).hexdigest()
            
            return JsonResponse({
                'success': True,
                'algorithm': 'SHA-1',
                'encrypted': {'hash': hash_result},
                'note': 'SHA-1 deprecated! Sadece referans için. Gerçek kullanımda SHA-256+ kullanın.'
            }, status=200)
        
        elif algorithm == 'SHA-256':
            # SHA-256 hash (güvenli)
            hash_result = hashlib.sha256(plaintext.encode('utf-8')).hexdigest()
            
            return JsonResponse({
                'success': True,
                'algorithm': 'SHA-256',
                'encrypted': {'hash': hash_result},
                'note': 'SHA-256 güvenlidir. Passwordlar için bcrypt kullanın!'
            }, status=200)
        
        elif algorithm == 'SHA-512':
            # SHA-512 hash (güvenli)
            hash_result = hashlib.sha512(plaintext.encode('utf-8')).hexdigest()
            
            return JsonResponse({
                'success': True,
                'algorithm': 'SHA-512',
                'encrypted': {'hash': hash_result},
                'note': 'SHA-512 güvenlidir. Passwordlar için bcrypt kullanın!'
            }, status=200)
        
        elif algorithm == 'Base64':
            # Base64 encoding (not encryption!)
            encoded = base64.b64encode(plaintext.encode('utf-8')).decode('utf-8')
            
            return JsonResponse({
                'success': True,
                'algorithm': 'Base64',
                'encrypted': {'encoded': encoded},
                'note': 'Base64 şifreleme değildir! Sadece encoding. Gizlilik için kullanmayın!'
            }, status=200)
        
        else:
            return JsonResponse({
                'success': False,
                'detail': 'Unsupported algorithm'
            }, status=400)
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'detail': 'Invalid JSON'
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'detail': str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def decrypt_text(request):
    """Decrypt/decode text using various algorithms"""
    try:
        data = json.loads(request.body)
        ciphertext = data.get('ciphertext', '')
        algorithm = data.get('algorithm', 'AES-256-GCM')
        
        if not ciphertext:
            return JsonResponse({
                'success': False,
                'detail': 'Ciphertext is required'
            }, status=400)
        
        if algorithm == 'AES-256-GCM':
            # AES-256-GCM decryption
            key_b64 = data.get('key', '')
            nonce_b64 = data.get('nonce', '')
            
            if not key_b64 or not nonce_b64:
                return JsonResponse({
                    'success': False,
                    'detail': 'Key and nonce are required for AES-256-GCM'
                }, status=400)
            
            try:
                key = base64.b64decode(key_b64)
                nonce = base64.b64decode(nonce_b64)
                ciphertext_bytes = base64.b64decode(ciphertext)
                
                aesgcm = AESGCM(key)
                plaintext = aesgcm.decrypt(nonce, ciphertext_bytes, None)
                
                return JsonResponse({
                    'success': True,
                    'algorithm': 'AES-256-GCM',
                    'decrypted': plaintext.decode('utf-8'),
                    'note': 'Şifre başarıyla çözüldü!'
                }, status=200)
            except Exception as e:
                return JsonResponse({
                    'success': False,
                    'detail': f'AES Decryption failed: {str(e)}'
                }, status=400)
        
        elif algorithm == 'RSA-2048':
            # RSA-2048 decryption
            private_key_pem = data.get('private_key', '')
            
            if not private_key_pem:
                return JsonResponse({
                    'success': False,
                    'detail': 'Private key is required for RSA-2048'
                }, status=400)
            
            try:
                private_key = serialization.load_pem_private_key(
                    private_key_pem.encode('utf-8'),
                    password=None,
                    backend=default_backend()
                )
                
                ciphertext_bytes = base64.b64decode(ciphertext)
                plaintext = private_key.decrypt(
                    ciphertext_bytes,
                    padding.OAEP(
                        mgf=padding.MGF1(algorithm=hashes.SHA256()),
                        algorithm=hashes.SHA256(),
                        label=None
                    )
                )
                
                return JsonResponse({
                    'success': True,
                    'algorithm': 'RSA-2048',
                    'decrypted': plaintext.decode('utf-8'),
                    'note': 'Şifre başarıyla çözüldü!'
                }, status=200)
            except Exception as e:
                return JsonResponse({
                    'success': False,
                    'detail': f'RSA Decryption failed: {str(e)}'
                }, status=400)
        
        elif algorithm == 'Base64':
            # Base64 decoding
            try:
                decoded = base64.b64decode(ciphertext).decode('utf-8')
                
                return JsonResponse({
                    'success': True,
                    'algorithm': 'Base64',
                    'decrypted': decoded,
                    'note': 'Base64 başarıyla decode edildi!'
                }, status=200)
            except Exception as e:
                return JsonResponse({
                    'success': False,
                    'detail': f'Base64 Decoding failed: {str(e)}'
                }, status=400)
        
        elif algorithm in ['MD5', 'SHA-1', 'SHA-256', 'SHA-512']:
            # Hash functions cannot be decrypted (one-way functions)
            return JsonResponse({
                'success': False,
                'detail': f'{algorithm} one-way hash fonksiyonudur. Decrypt edilemez!'
            }, status=400)
        
        else:
            return JsonResponse({
                'success': False,
                'detail': 'Unsupported algorithm'
            }, status=400)
    
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'detail': 'Invalid JSON'
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'detail': str(e)
        }, status=500)