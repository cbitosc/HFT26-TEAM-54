def _luhn_ok(digits):
    total = 0
    for i, ch in enumerate(reversed(digits)):
        d = int(ch)
        if i % 2 == 1:
            d = d * 2 - 9 if d > 4 else d * 2
        total += d
    return total % 10 == 0


def _valid_digits(text):
    digits = text.strip().replace(" ", "").replace("-", "")
    ok = digits.isascii() and digits.isdigit() and 13 <= len(digits) <= 19
    return digits if ok and _luhn_ok(digits) else None


def mask_card_number(text):
    digits = _valid_digits(text)
    if digits is None:
        return None
    masked = "*" * (len(digits) - 4) + digits[-4:]
    return " ".join(masked[i:i + 4] for i in range(0, len(masked), 4))
