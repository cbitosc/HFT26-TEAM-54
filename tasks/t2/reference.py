import re

_LINE = re.compile(
    r"[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])[ \t]+"
    r"(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9][ \t]+"
    r"\[[ \t]*([A-Za-z]+)[ \t]*\].*",
    re.DOTALL,
)
_LEVELS = {"DEBUG", "INFO", "WARN", "ERROR", "CRITICAL"}


def _level(line):
    match = _LINE.fullmatch(line.strip())
    if match is None:
        return None
    level = match.group(1).upper()
    level = "WARN" if level == "WARNING" else level
    return level if level in _LEVELS else None


def count_levels(text):
    if not isinstance(text, str):
        return {}
    counts = {}
    for line in text.splitlines():
        level = _level(line)
        if level is not None:
            counts[level] = counts.get(level, 0) + 1
    return counts
