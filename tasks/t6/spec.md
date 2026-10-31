# Task 6: slugify

Write a Python module that defines:

```python
def slugify(title: str) -> str:
```

Use only the Python standard library. Never raise.

Turn a page title into a URL slug, in this order:

1. Normalize with `unicodedata.normalize("NFKD", title)`, then drop every character that is not
   ASCII (so `"Café"` becomes `"Cafe"`; letters from other alphabets disappear).
2. Convert to lowercase.
3. Replace every run of one or more characters that are not `a-z` or `0-9` with a single `-`.
4. Remove `-` from both ends.
5. If the result is longer than 50 characters, keep the first 50 and then remove `-` from the end again.
6. If the result is empty, return `"untitled"`.

Examples: `"Hello World"` -> `"hello-world"`; `"C++ & Rust: a comparison"` -> `"c-rust-a-comparison"`.
