# Task 1: parse_log_line

Write a Python module that defines:

```python
def parse_log_line(line: str) -> dict | None:
```

Use only the Python standard library.

## Log line format

First remove leading and trailing whitespace from the line (exactly what `str.strip()` removes,
including spaces, tabs, `\r` and `\n`). The remaining text is a valid log line only if it has
this shape:

```
DATE <ws> TIME <ws> [LEVEL] MESSAGE
```

- `<ws>` is one or more spaces and/or tab characters.
- `DATE` is `YYYY-MM-DD`: exactly 4, 2 and 2 ASCII digits. The month must be 01-12 and the day 01-31
  (no further calendar checks).
- `TIME` is `HH:MM:SS`: exactly 2 ASCII digits each. Hours 00-23, minutes 00-59, seconds 00-59.
- `[LEVEL]` is an opening `[`, optional spaces/tabs, the level name, optional spaces/tabs, and the
  first closing `]`.
  - The level name is case-insensitive and must be one of: `DEBUG`, `INFO`, `WARN`, `WARNING`,
    `ERROR`, `CRITICAL`.
  - The level is returned in UPPERCASE. `WARNING` (in any case) is returned as `WARN`.
  - Any other level name makes the line invalid.
- `MESSAGE` is everything after that closing `]`, with leading and trailing whitespace removed.
  Whitespace inside the message is kept exactly as it is. The message may contain any characters,
  including `[`, `]`, `=` and non-ASCII (unicode) text. The message may be empty.

## Return value

For a valid line return a dict with exactly these four string keys:

```python
{"date": "YYYY-MM-DD", "time": "HH:MM:SS", "level": "INFO", "message": "..."}
```

Return `None` (never raise) when:
- the line is empty or contains only whitespace,
- any part is missing or in the wrong order,
- the date or time is malformed or out of range,
- the level name is not one of the allowed names,
- the input is not a `str`.
