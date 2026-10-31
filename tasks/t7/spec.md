# Task 7: parse_duration

Write a Python module that defines:

```python
def parse_duration(text: str) -> int | None:
```

Use only the Python standard library. Never raise.

Convert a human duration into a number of seconds.

1. Remove leading and trailing whitespace (what `str.strip()` removes).
2. If what remains is only ASCII digits (for example `"45"`), it is a number of seconds.
3. Otherwise it must be one to three parts `<number><unit>`, where `<number>` is one or more ASCII
   digits and `<unit>` is `h` (hours), `m` (minutes) or `s` (seconds), case-insensitive.
   - Units appear at most once each and in the order h, then m, then s.
   - Parts may be separated by spaces or tabs, but there is no space between a number and its unit.
4. Return the total number of seconds (h = 3600, m = 60, s = 1).
5. Return `None` for anything else: empty text, unknown units, wrong order, repeated units,
   signs, decimals or other characters.

Examples: `"1h30m"` -> `5400`; `"1h 30m 15s"` -> `5415`; `"30m1h"` -> `None`.
