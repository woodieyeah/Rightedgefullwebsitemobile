#!/usr/bin/env python3
"""Decode the navigation log that the CI probe wrote to localStorage.

WebKit stores localStorage values as UTF-16LE inside localstorage.sqlite3.
A plain `sqlite3 ... "SELECT value ..."` stops at the first NUL byte, so a
JSON array came back as a bare "[" -- two bytes -- which looks exactly like
an empty result and silently turned a real failure into "nothing recorded".

Reading hex(value) and decoding here is lossless.

Usage: decode_navlog.py <hexfile>   (prints JSON to stdout)
"""
import binascii
import json
import pathlib
import sys


def main() -> int:
    if len(sys.argv) < 2:
        print("[]")
        return 0
    path = pathlib.Path(sys.argv[1])
    if not path.exists():
        print("[]")
        return 0
    raw = path.read_text().strip()
    if not raw:
        print("[]")
        return 0
    try:
        blob = binascii.unhexlify(raw)
    except binascii.Error:
        print("[]")
        return 0

    for encoding in ("utf-16-le", "utf-8", "utf-16-be"):
        try:
            text = blob.decode(encoding).replace("\x00", "").strip()
        except (UnicodeDecodeError, LookupError):
            continue
        if not text.startswith("["):
            continue
        try:
            json.loads(text)
        except ValueError:
            continue
        print(text)
        return 0

    print("[]")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
