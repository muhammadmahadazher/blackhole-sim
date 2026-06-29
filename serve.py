#!/usr/bin/env python3
"""
Tiny static server for the Black Hole simulation.

Serves this folder with caching DISABLED, so edits always show up on reload
(plain `python -m http.server` lets the browser cache JS/CSS, which can serve
you a stale build). Usage:  python serve.py [port]
"""
import http.server
import os
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, *args):
        pass  # keep the console quiet


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True


with Server(("", PORT), NoCacheHandler) as httpd:
    print(f"Black Hole simulation serving (no-cache) on http://localhost:{PORT}")
    print("Press Ctrl+C to stop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
