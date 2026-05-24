import os
import logging
from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger(__name__)

# Fallback key ONLY for local development to prevent breaking the app if ENCRYPTION_KEY is not set.
# DO NOT use this fallback in production!
FALLBACK_KEY = b'eG0_B1a5PzL0uHn_R6ZpWvV8I4sKq_C2FjE7N9Y0X3M='

def get_fernet_instance():
    key_str = os.getenv("ENCRYPTION_KEY")
    if not key_str:
        logger.warning(
            "CRITICAL WARNING: ENCRYPTION_KEY environment variable is not set! "
            "Falling back to insecure default key for local development. "
            "DO NOT run this in production."
        )
        return Fernet(FALLBACK_KEY)
    
    try:
        return Fernet(key_str.encode("utf-8"))
    except ValueError as e:
        logger.error(f"Invalid ENCRYPTION_KEY format. Must be a URL-safe base64-encoded 32-byte key: {e}")
        # Fall back gracefully so the server doesn't crash during development
        return Fernet(FALLBACK_KEY)

def encrypt_text(plaintext: str) -> str:
    """Encrypts plaintext string and returns a base64 string representation."""
    if not plaintext:
        return ""
    f = get_fernet_instance()
    try:
        encrypted_bytes = f.encrypt(plaintext.encode("utf-8"))
        return encrypted_bytes.decode("utf-8")
    except Exception as e:
        logger.error(f"Encryption failed: {e}")
        return ""

def decrypt_text(ciphertext: str) -> str:
    """Decrypts a base64 string back into plaintext string."""
    if not ciphertext:
        return ""
    f = get_fernet_instance()
    try:
        decrypted_bytes = f.decrypt(ciphertext.encode("utf-8"))
        return decrypted_bytes.decode("utf-8")
    except InvalidToken:
        logger.error("Decryption failed: Invalid token or incorrect ENCRYPTION_KEY.")
        return "[Error: Could not decrypt address. Key mismatch or corrupted data.]"
    except Exception as e:
        logger.error(f"Decryption failed: {e}")
        return "[Error: Decryption failure.]"
