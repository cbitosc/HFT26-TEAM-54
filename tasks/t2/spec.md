# Task 2: count_levels

Write a Python module that defines:

```python
def count_levels(text: str) -> dict:
```

Use only the Python standard library.

`text` is a multi-line log. Split it into lines with `str.splitlines()` (so `\n`, `\r\n` and `\r`
all end a line). Count how many VALID log lines there are for each level.

## Valid log line

First remove leading and trailing whitespace from the line (exactly what `str.strip()` removes).
The remaining text is valid only if it has this shape:

```
DATE <ws> TIME <ws> [LEVEL] MESSAGE
```

- `<ws>` is one or more spaces and/or tab characters.
- `DATE` is `YYYY-MM-DD`: exactly 4, 2 and 2 ASCII digits; month 01-12, day 01-31.
- `TIME` is `HH:MM:SS`: exactly 2 ASCII digits each; hours 00-23, minutes 00-59, seconds 00-59.
- `[LEVEL]` is `[`, optional spaces/tabs, the level name, optional spaces/tabs, and the first `]`.
  The level name is case-insensitive and must be one of `DEBUG`, `INFO`, `WARN`, `WARNING`,
  `ERROR`, `CRITICAL`. `WARNING` counts as `WARN`.
- `MESSAGE` is everything after that `]`; it may be empty and may contain any characters.

## Return value

A dict mapping the UPPERCASE level name (`DEBUG`, `INFO`, `WARN`, `ERROR`, `CRITICAL`) to the
number of valid lines with that level. Only include levels that occur at least once.

- Blank lines and invalid lines are skipped silently (never raise).
- Empty `text` returns `{}`.
- If `text` is not a `str`, return `{}`.
