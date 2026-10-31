import re
import unicodedata


def slugify(title):
    text = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    slug = slug[:50].rstrip("-")
    return slug or "untitled"
