#!/bin/sh
set -eu

DIR="${1:-.}"
OUT="$(pwd)/kinwall-plugin.zip"

cd "$DIR"

[ -f kinwall-plugin.json ] || { echo "No kinwall-plugin.json found" >&2; exit 1; }

entry=$(sed -n 's/.*"entry"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' kinwall-plugin.json)
[ -f "${entry:-index.html}" ] || { echo "Entry page missing" >&2; exit 1; }

python3 - "$OUT" <<'PY'
import json
import sys
import zipfile
from pathlib import Path

output = Path(sys.argv[1])
manifest = json.loads(Path("kinwall-plugin.json").read_text())
if len(manifest.get("description", "").strip()) > 300:
    raise SystemExit("Manifest description exceeds 300 characters")

excluded_dirs = {"dev", "scripts", "node_modules"}
excluded_files = {"LICENSE", "guesses.txt", "answers.txt", "kinwall-plugin.zip"}

with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(Path(".").rglob("*")):
        if not path.is_file():
            continue
        relative = path.relative_to(".")
        if any(part.startswith(".") or part in excluded_dirs for part in relative.parts):
            continue
        if path.name in excluded_files or path.suffix == ".md":
            continue
        archive.write(path, relative.as_posix())

with zipfile.ZipFile(output) as archive:
    print("Package contents:")
    for name in archive.namelist():
        print("  " + name)
    print(f"\nBuilt {output.name} ({output.stat().st_size} bytes)")
PY

size=$(wc -c < "$OUT" | tr -d ' ')
[ "$size" -le 5242880 ] || { echo "Package exceeds 5 MB" >&2; exit 1; }
