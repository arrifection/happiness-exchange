import re


def normalize_whatsapp_number(value: str) -> str:
    """Trim and strip common formatting while keeping a leading +."""
    cleaned = value.strip()
    cleaned = re.sub(r"[\s\-()]", "", cleaned)
    return cleaned


def validate_whatsapp_number(value: str) -> str:
    """Normalize and validate WhatsApp numbers (10–15 digits, optional leading +)."""
    normalized = normalize_whatsapp_number(value)
    if not normalized:
        raise ValueError("WhatsApp number is required.")
    digits = normalized[1:] if normalized.startswith("+") else normalized
    if not digits.isdigit():
        raise ValueError("WhatsApp number must contain only digits (optional leading +).")
    if len(digits) < 10 or len(digits) > 15:
        raise ValueError("WhatsApp number must be 10–15 digits after normalization.")
    return normalized
