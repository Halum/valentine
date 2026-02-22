#!/usr/bin/env python3
"""Lightweight dev server with API routes for the admin panel."""

import http.server
import json
import os
import sys
import tempfile
import urllib.parse
import re
from datetime import datetime, timezone


def parse_multipart(body, boundary):
    """Parse multipart/form-data body manually (cgi module removed in 3.13)."""
    parts = {}
    boundary = boundary.encode() if isinstance(boundary, str) else boundary
    chunks = body.split(b'--' + boundary)
    for chunk in chunks:
        chunk = chunk.strip()
        if not chunk or chunk == b'--':
            continue
        if b'\r\n\r\n' in chunk:
            header_block, data = chunk.split(b'\r\n\r\n', 1)
        elif b'\n\n' in chunk:
            header_block, data = chunk.split(b'\n\n', 1)
        else:
            continue
        # Strip trailing \r\n-- from data
        if data.endswith(b'\r\n'):
            data = data[:-2]
        headers_str = header_block.decode('utf-8', errors='replace')
        name = None
        filename = None
        for line in headers_str.split('\n'):
            line = line.strip()
            if line.lower().startswith('content-disposition:'):
                for param in line.split(';'):
                    param = param.strip()
                    if param.startswith('name='):
                        name = param.split('=', 1)[1].strip('"')
                    elif param.startswith('filename='):
                        filename = param.split('=', 1)[1].strip('"')
        if name:
            parts[name] = {'data': data, 'filename': filename}
    return parts

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data.json")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp"}


def sanitize_filename(name):
    """Strip path components and dangerous characters."""
    name = os.path.basename(name)
    name = re.sub(r'[^\w.\-]', '_', name)
    if not name or name.startswith('.'):
        name = 'upload' + name
    return name


class Handler(http.server.SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    # ---- routing ----

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/list-photos":
            self._list_photos(parsed.query)
        elif parsed.path == "/api/logs":
            self._get_logs(parsed.query)
        else:
            super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/save-json":
            self._save_json()
        elif parsed.path == "/api/upload-photo":
            self._upload_photo()
        elif parsed.path == "/api/log":
            self._log_event()
        else:
            self._json_response(404, {"error": "Not found"})

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/delete-photo":
            self._delete_photo(parsed.query)
        else:
            self._json_response(404, {"error": "Not found"})

    # ---- helpers ----

    def _json_response(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        return self.rfile.read(length)

    # ---- API handlers ----

    def _save_json(self):
        try:
            raw = self._read_body()
            data = json.loads(raw)
        except (json.JSONDecodeError, ValueError) as e:
            self._json_response(400, {"error": f"Invalid JSON: {e}"})
            return

        # Atomic write
        fd, tmp = tempfile.mkstemp(dir=BASE_DIR, suffix=".tmp")
        try:
            with os.fdopen(fd, "w") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
                f.write("\n")
            os.replace(tmp, DATA_FILE)
        except Exception as e:
            os.unlink(tmp)
            self._json_response(500, {"error": str(e)})
            return

        self._json_response(200, {"ok": True})

    def _upload_photo(self):
        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type:
            self._json_response(400, {"error": "Expected multipart/form-data"})
            return

        # Extract boundary from content-type header
        boundary = None
        for part in content_type.split(';'):
            part = part.strip()
            if part.startswith('boundary='):
                boundary = part.split('=', 1)[1].strip('"')
        if not boundary:
            self._json_response(400, {"error": "No boundary in content-type"})
            return

        body = self._read_body()
        parts = parse_multipart(body, boundary)

        if 'file' not in parts:
            self._json_response(400, {"error": "No file field"})
            return

        file_data = parts['file']['data']
        orig_filename = parts['file'].get('filename') or 'upload.jpg'
        level = parts.get('level', {}).get('data', b'level2').decode()
        filename = parts.get('filename', {}).get('data', b'').decode() or orig_filename

        level = sanitize_filename(level)
        filename = sanitize_filename(filename)

        dest_dir = os.path.join(BASE_DIR, "photos", level)
        os.makedirs(dest_dir, exist_ok=True)

        dest = os.path.join(dest_dir, filename)
        # Ensure dest is within photos dir
        if not os.path.abspath(dest).startswith(os.path.abspath(os.path.join(BASE_DIR, "photos"))):
            self._json_response(400, {"error": "Invalid path"})
            return

        with open(dest, "wb") as f:
            f.write(file_data)

        self._json_response(200, {"ok": True, "path": f"photos/{level}/{filename}"})

    def _delete_photo(self, query):
        params = urllib.parse.parse_qs(query)
        level = params.get("level", [""])[0]
        file = params.get("file", [""])[0]
        if not level or not file:
            self._json_response(400, {"error": "level and file required"})
            return

        level = sanitize_filename(level)
        file = sanitize_filename(file)
        path = os.path.join(BASE_DIR, "photos", level, file)

        if not os.path.abspath(path).startswith(os.path.abspath(os.path.join(BASE_DIR, "photos"))):
            self._json_response(400, {"error": "Invalid path"})
            return

        if not os.path.isfile(path):
            self._json_response(404, {"error": "File not found"})
            return

        os.remove(path)
        self._json_response(200, {"ok": True})

    def _log_event(self):
        try:
            raw = self._read_body()
            entry = json.loads(raw)
        except (json.JSONDecodeError, ValueError):
            self._json_response(400, {"error": "Invalid JSON"})
            return

        entry['ts'] = datetime.now(timezone.utc).isoformat()
        entry['ip'] = self.headers.get('X-Forwarded-For', self.client_address[0])

        log_dir = os.path.join(BASE_DIR, 'logs')
        os.makedirs(log_dir, exist_ok=True)

        log_file = os.path.join(log_dir, 'analytics.jsonl')
        with open(log_file, 'a') as f:
            f.write(json.dumps(entry, ensure_ascii=False) + '\n')

        self._json_response(200, {"ok": True})

    def _get_logs(self, query):
        params = urllib.parse.parse_qs(query)
        limit = int(params.get('limit', ['100'])[0])

        log_file = os.path.join(BASE_DIR, 'logs', 'analytics.jsonl')
        if not os.path.isfile(log_file):
            self._json_response(200, [])
            return

        with open(log_file, 'r') as f:
            lines = f.readlines()

        # Return last N entries in reverse chronological order
        entries = []
        for line in lines[-limit:]:
            line = line.strip()
            if line:
                try:
                    entries.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
        entries.reverse()
        self._json_response(200, entries)

    def _list_photos(self, query):
        params = urllib.parse.parse_qs(query)
        level = params.get("level", [""])[0]
        if not level:
            self._json_response(400, {"error": "level required"})
            return

        level = sanitize_filename(level)
        photo_dir = os.path.join(BASE_DIR, "photos", level)

        if not os.path.isdir(photo_dir):
            self._json_response(200, [])
            return

        files = [
            f for f in sorted(os.listdir(photo_dir))
            if os.path.splitext(f)[1].lower() in IMAGE_EXTS
        ]
        self._json_response(200, files)


if __name__ == "__main__":
    server = http.server.HTTPServer(("", PORT), Handler)
    print(f"Serving on http://localhost:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.server_close()
