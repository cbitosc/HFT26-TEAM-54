import re

_PATTERN = re.compile(r"(?:(\d+)h)?[ \t]*(?:(\d+)m)?[ \t]*(?:(\d+)s)?", re.IGNORECASE)


def _parts(s):
    m = _PATTERN.fullmatch(s)
    if not m or not any(m.groups()):
        return None
    return [int(g or 0) for g in m.groups()]


def parse_duration(text):
    s = text.strip()
    if s.isascii() and s.isdigit():
        return int(s)
    parts = _parts(s)
    if parts is None:
        return None
    hours, minutes, seconds = parts
    return hours * 3600 + minutes * 60 + seconds
