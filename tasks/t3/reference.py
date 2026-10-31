import re

_LINE = re.compile(
    r"[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])[ \t]+"
    r"(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9][ \t]+"
    r"\[[ \t]*([A-Za-z]+)[ \t]*\](.*)",
    re.DOTALL,
)
_LEVELS = {"DEBUG", "INFO", "WARN", "WARNING", "ERROR", "CRITICAL"}
_FIELD = re.compile(r'([^ \t=]*)=("[^"]*"|[^ \t]*)|[^ \t]+')
_KEY = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")


def _message(line):
    if not isinstance(line, str):
        return None
    match = _LINE.fullmatch(line.strip())
    if match is None or match.group(1).upper() not in _LEVELS:
        return None
    return match.group(2).strip()


def _unquote(value):
    if len(value) >= 2 and value[0] == value[-1] == '"':
        return value[1:-1]
    return value


def _is_key(key):
    return key is not None and _KEY.fullmatch(key) is not None


def extract_fields(line):
    message = _message(line)
    if message is None:
        return None
    pairs = (token.groups() for token in _FIELD.finditer(message))
    return {key.lower(): _unquote(value) for key, value in pairs if _is_key(key)}
