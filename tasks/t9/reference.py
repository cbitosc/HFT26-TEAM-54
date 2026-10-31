import string

_COMMON = {"password", "123456", "qwerty", "letmein", "admin", "welcome"}
_CHECKS = [
    ("too_short", lambda p: len(p) < 12),
    ("no_upper", lambda p: not any(c in string.ascii_uppercase for c in p)),
    ("no_lower", lambda p: not any(c in string.ascii_lowercase for c in p)),
    ("no_digit", lambda p: not any(c in string.digits for c in p)),
    ("no_symbol", lambda p: not any(c in string.punctuation for c in p)),
    ("has_space", lambda p: any(c.isspace() for c in p)),
    ("common", lambda p: p.lower() in _COMMON or "password" in p.lower()),
]


def validate_password(password):
    return [name for name, broken in _CHECKS if broken(password)]
