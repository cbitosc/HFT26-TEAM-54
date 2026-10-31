# Task 3: extract_fields

Write a Python module that defines:

```python
def extract_fields(line: str) -> dict | None:
```

Use only the Python standard library.

`line` is one log line. If it is a valid log line (rules below), return the `key=value` fields
found in its MESSAGE. Otherwise return `None` (never raise).

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
  `ERROR`, `CRITICAL`.
- `MESSAGE` is everything after that `]`, with leading and trailing whitespace removed. It may be empty.

Return `None` for an empty/whitespace-only line, an invalid line, or a non-`str` input.

## Fields in the MESSAGE

Scan the MESSAGE from left to right. It is a sequence of tokens separated by one or more
spaces/tabs. A token is a field if it has the form `key=value`:

- `key` starts with an ASCII letter or `_`, followed by ASCII letters, digits or `_`.
  Keys are returned in lowercase.
- The key ends at the FIRST `=`. Everything after it is the value, so a value may itself contain `=`.
- If the value starts with a double quote `"`, the value runs to the next `"` and may contain
  spaces and tabs. The surrounding quotes are removed. (There are no escape sequences.)
- Otherwise the value runs until the next space/tab. A value may be empty (`key=`).
- Values are always returned as strings, unchanged (no case change, no number conversion).
- Tokens that are not fields (plain words, or a token whose key is not a valid key) are ignored.
- If the same key appears more than once (case-insensitively), the LAST value wins.

Return a dict `{key: value}`. A valid line with no fields returns `{}`.
