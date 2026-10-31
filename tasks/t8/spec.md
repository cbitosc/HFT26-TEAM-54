# Task 8: mask_card_number

Write a Python module that defines:

```python
def mask_card_number(text: str) -> str | None:
```

Use only the Python standard library. Never raise.

Validate a payment card number and return a masked version that is safe to show on a receipt.

1. Remove leading and trailing whitespace (what `str.strip()` removes).
2. Remove every space and hyphen `-`. What remains must be only ASCII digits, 13 to 19 of them.
3. The number must pass the Luhn checksum: starting from the rightmost digit and moving left,
   double every second digit; if a doubled digit is greater than 9, subtract 9; the sum of all
   digits must be divisible by 10.
4. Replace every digit except the last 4 with `*`, then split the result into groups of 4
   characters starting from the LEFT, joined by single spaces (the last group may be shorter).
5. Return `None` if any rule fails.

Examples: `"4111 1111 1111 1111"` -> `"**** **** **** 1111"`;
`"378282246310005"` -> `"**** **** ***0 005"`.
