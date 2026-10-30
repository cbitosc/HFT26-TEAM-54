# Task 4: filter_by_level

Write a Python module that defines:

```python
def filter_by_level(text: str, min_level: str) -> list:
```

Use only the Python standard library.

`text` is a multi-line log. Split it into lines with `str.splitlines()` (so `\n`, `\r\n` and `\r`
all end a line). Return the MESSAGE of every VALID line whose level is at least as severe as
`min_level`, in the original order.

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
  `ERROR`, `CRITICAL`. `WARNING` means the same level as `WARN`.
- `MESSAGE` is everything after that `]`, with leading and trailing whitespace removed.
  Whitespace inside the message is kept exactly. The message may be empty (then `""` is returned
  for that line).

Invalid and blank lines are skipped silently.

## Severity

`DEBUG` < `INFO` < `WARN` (= `WARNING`) < `ERROR` < `CRITICAL`.

`min_level` follows the same naming rules as a line's level: case-insensitive, surrounding
whitespace ignored, and `WARNING` means `WARN`.

## Return value

A list of message strings (possibly empty). Never raise:
- If `min_level` is not a known level name, return `[]`.
- If `text` or `min_level` is not a `str`, return `[]`.
- Empty `text` returns `[]`.
