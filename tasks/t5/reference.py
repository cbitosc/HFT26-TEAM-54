def _strip_line_end(line):
    if line.endswith("\r\n"):
        return line[:-2]
    if line.endswith("\n"):
        return line[:-1]
    return line


def _read_quoted(s, i):
    out = []
    while i < len(s):
        if s[i] != '"':
            out.append(s[i])
            i += 1
        elif s[i + 1:i + 2] == '"':
            out.append('"')
            i += 2
        else:
            return "".join(out), i + 1
    return None, i


def _skip_blanks(s, i):
    while i < len(s) and s[i] in " \t":
        i += 1
    return i


def _read_quoted_field(s, i):
    value, j = _read_quoted(s, i + 1)
    if value is None:
        return None, j
    j = _skip_blanks(s, j)
    if j < len(s) and s[j] != ",":
        return None, j
    return value, j


def _read_plain_field(s, i):
    end = s.find(",", i)
    end = len(s) if end == -1 else end
    return s[i:end].strip(" \t"), end


def _read_field(s, i):
    j = _skip_blanks(s, i)
    if j < len(s) and s[j] == '"':
        return _read_quoted_field(s, j)
    return _read_plain_field(s, i)


def parse_csv_line(line):
    s = _strip_line_end(line)
    if not s.strip(" \t"):
        return []
    fields, i = [], 0
    while True:
        value, i = _read_field(s, i)
        if value is None:
            return None
        fields.append(value)
        if i >= len(s):
            return fields
        i += 1
