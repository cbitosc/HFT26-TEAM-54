# Task 9: validate_password

Write a Python module that defines:

```python
def validate_password(password: str) -> list:
```

Use only the Python standard library. Never raise.

Return the names of the strength rules the password BREAKS, in exactly this order
(an empty list means the password is strong):

1. `"too_short"`: fewer than 12 characters.
2. `"no_upper"`: no ASCII uppercase letter `A-Z`.
3. `"no_lower"`: no ASCII lowercase letter `a-z`.
4. `"no_digit"`: no ASCII digit `0-9`.
5. `"no_symbol"`: no character from `string.punctuation`.
6. `"has_space"`: contains any whitespace character (what `str.isspace()` accepts).
7. `"common"`: the password, lowercased, is one of `password`, `123456`, `qwerty`, `letmein`,
   `admin`, `welcome`, or it contains `password` anywhere (lowercased).

Examples: `"Tr0ub4dor&3xyz"` -> `[]`; `"abc"` -> `["too_short", "no_upper", "no_digit", "no_symbol"]`.
