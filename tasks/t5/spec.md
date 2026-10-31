# Task 5: parse_csv_line

Write a Python module that defines:

```python
def parse_csv_line(line: str) -> list | None:
```

Use only the Python standard library (but do NOT use the `csv` module). Never raise.

Split one line of CSV text into its fields.

1. First remove one trailing line ending, if present: `"\r\n"` or `"\n"`.
2. If what remains is empty or contains only spaces and tabs, return `[]`.
3. Fields are separated by commas `,`. A line with N commas has N + 1 fields.
4. An **unquoted** field is returned with leading and trailing spaces and tabs removed. It may be empty.
5. A **quoted** field starts (after optional spaces/tabs) with a double quote `"` and ends at the
   matching closing `"`. Inside it, commas are ordinary characters and two double quotes `""`
   stand for one `"`. The text inside the quotes is returned exactly (spaces kept).
   After the closing quote only spaces/tabs may follow before the next comma or the end of the line.
6. Return `None` if the line is malformed: a quoted field is never closed, or something other than
   spaces/tabs follows a closing quote.

Examples: `'x,"hello, world",y'` -> `["x", "hello, world", "y"]`; `'a,,c'` -> `["a", "", "c"]`.
