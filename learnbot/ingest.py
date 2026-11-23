"""Split a folder of markdown files into searchable chunks -> library.json.

usage: python3 ingest.py PATH_TO_LIBRARY
"""
import json, os, re, sys

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "library.json")
MAX = 1200  # chars per chunk


def chunks(path, root):
    text = open(path, encoding="utf-8", errors="ignore").read()
    rel = os.path.relpath(path, root)
    title, buf, head = rel, [], rel
    out = []

    def flush():
        body = "\n".join(buf).strip()
        for i in range(0, len(body), MAX):
            piece = body[i:i + MAX].strip()
            if len(piece) > 80 and not re.search(r'cross-ref|see also|further reading|references', head, re.I):
                out.append({"src": rel, "head": head, "text": piece})

    for line in text.splitlines():
        m = re.match(r"#{1,3}\s+(.*)", line)
        if m:
            flush(); buf = []; head = m.group(1).strip()
        else:
            buf.append(line)
    flush()
    return out


def main():
    root = sys.argv[1]
    allc = []
    for d, _, files in os.walk(root):
        for f in sorted(files):
            if f.endswith(".md"):
                allc += chunks(os.path.join(d, f), root)
    json.dump(allc, open(OUT, "w"))
    print(f"{len(allc)} chunks -> {OUT}")


if __name__ == "__main__":
    main()
