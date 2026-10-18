"""Explicit, pinned model installation. No business data or audio is downloaded."""
import hashlib
import json
import sys
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
if sys.argv[1:] not in ([], ['--model', 'base']):
    raise ValueError('Use no argument for Tiny, or --model base.')
MODEL = 'base' if sys.argv[1:] else 'tiny'
LOCK = json.loads((ROOT / ('models/speech-base-source.json' if MODEL == 'base' else 'models/speech-source.json')).read_text(encoding="utf-8"))
TARGET = ROOT / ('models/speech/whisper-' + MODEL)


def valid(data, item):
    if len(data) != item["size"]:
        return False
    if "sha256" in item:
        return hashlib.sha256(data).hexdigest() == item["sha256"]
    return hashlib.sha1(f"blob {len(data)}\0".encode() + data).hexdigest() == item["gitBlobSha1"]


def main():
    TARGET.mkdir(parents=True, exist_ok=True)
    manifest = {"repository": LOCK["repository"], "revision": LOCK["revision"], "license": LOCK["license"], "files": []}
    for item in LOCK["files"]:
        filename = TARGET / item["name"]
        data = filename.read_bytes() if filename.exists() else b""
        if not valid(data, item):
            print("Downloading pinned " + item["name"], flush=True)
            url = f'https://huggingface.co/{LOCK["repository"]}/resolve/{LOCK["revision"]}/{item["name"]}'
            with urllib.request.urlopen(url, timeout=90) as response:
                data = response.read(item["size"] + 1)
            if not valid(data, item):
                raise ValueError("Source checksum mismatch: " + item["name"])
            temporary = filename.with_suffix(filename.suffix + ".part")
            temporary.write_bytes(data)
            temporary.replace(filename)
        manifest["files"].append({"name": item["name"], "size": len(data), "sha256": hashlib.sha256(data).hexdigest()})
    (TARGET / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print("Pinned model verified. Run npm run voice:check to check CPU inference.")


if __name__ == "__main__":
    main()
