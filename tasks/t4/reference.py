import re

_LINE = re.compile(
    r"[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])[ \t]+"
    r"(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9][ \t]+"
    r"\[[ \t]*([A-Za-z]+)[ \t]*\](.*)",
    re.DOTALL,
)
_RANK = {"DEBUG": 0, "INFO": 1, "WARN": 2, "WARNING": 2, "ERROR": 3, "CRITICAL": 4}


def _parse(line):
    """(rank, message) for a valid line, (-1, None) otherwise."""
    match = _LINE.fullmatch(line.strip())
    if match is None:
        return -1, None
    return _RANK.get(match.group(1).upper(), -1), match.group(2).strip()


def _threshold(min_level):
    if not isinstance(min_level, str):
        return None
    return _RANK.get(min_level.strip().upper())


def filter_by_level(text, min_level):
    threshold = _threshold(min_level)
    if not isinstance(text, str) or threshold is None:
        return []
    return [message for rank, message in map(_parse, text.splitlines()) if rank >= threshold]
