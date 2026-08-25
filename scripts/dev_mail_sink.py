#!/usr/bin/env python3
"""
Local-only SMTP inbox for development.

Listens on the same ports as Mailpit so the backend SMTP settings do not change:

    SMTP  127.0.0.1:1025
    Inbox http://127.0.0.1:8025

Prefer Mailpit when Docker is available:

    docker compose -f docker-compose.dev.yml up -d

This script is a fallback when Docker is not installed. It never sends mail
to the public internet.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import threading
from datetime import datetime, timezone
from email import message_from_bytes
from email.policy import default as email_policy
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from socketserver import StreamRequestHandler, ThreadingTCPServer

MESSAGES: list[dict] = []
LOCK = threading.Lock()
MAX_MESSAGES = 200


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")


class SmtpSinkHandler(StreamRequestHandler):
    def _send(self, code: str, text: str) -> None:
        self.wfile.write(f"{code} {text}\r\n".encode("ascii"))
        self.wfile.flush()

    def handle(self) -> None:
        self._send("220", "happiness-exchange-dev-sink")
        mail_from = ""
        rcpt_to: list[str] = []
        while True:
            line = self.rfile.readline()
            if not line:
                return
            command = line.decode("utf-8", errors="replace").strip()
            upper = command.upper()
            if upper.startswith("HELO") or upper.startswith("EHLO"):
                self._send("250", "hello")
            elif upper.startswith("MAIL FROM:"):
                mail_from = command.split(":", 1)[1].strip()
                rcpt_to = []
                self._send("250", "ok")
            elif upper.startswith("RCPT TO:"):
                rcpt_to.append(command.split(":", 1)[1].strip())
                self._send("250", "ok")
            elif upper == "DATA":
                self._send("354", "end with <CR><LF>.<CR><LF>")
                chunks: list[bytes] = []
                while True:
                    data_line = self.rfile.readline()
                    if not data_line:
                        return
                    if data_line.rstrip(b"\r\n") == b".":
                        break
                    if data_line.startswith(b"."):
                        data_line = data_line[1:]
                    chunks.append(data_line)
                self._store(mail_from, rcpt_to, b"".join(chunks))
                self._send("250", "queued")
            elif upper == "RSET":
                mail_from = ""
                rcpt_to = []
                self._send("250", "ok")
            elif upper == "NOOP":
                self._send("250", "ok")
            elif upper == "QUIT":
                self._send("221", "bye")
                return
            else:
                self._send("250", "ok")

    def _store(self, mail_from: str, rcpt_to: list[str], raw: bytes) -> None:
        parsed = message_from_bytes(raw, policy=email_policy)
        body_text = parsed.get_body(preferencelist=("plain", "html"))
        body = ""
        if body_text is not None:
            try:
                body = body_text.get_content()
            except Exception:
                body = raw.decode("utf-8", errors="replace")
        record = {
            "id": None,
            "received_at": _now(),
            "from": str(parsed.get("From") or mail_from),
            "to": str(parsed.get("To") or ", ".join(rcpt_to)),
            "subject": str(parsed.get("Subject") or "(no subject)"),
            "body": body,
        }
        with LOCK:
            MESSAGES.insert(0, record)
            record["id"] = len(MESSAGES)
            del MESSAGES[MAX_MESSAGES:]
        print(f"[mail-sink] {record['subject']} -> {record['to']}")


def _inbox_html() -> bytes:
    with LOCK:
        snapshot = list(MESSAGES)
    rows = []
    for message in snapshot:
        body = html.escape(message["body"])
        # Keep verification links clickable in the local inbox.
        body = re.sub(
            r"(https?://[^\s<]+)",
            r'<a href="\1">\1</a>',
            body,
        )
        rows.append(
            "<article class='msg'>"
            f"<h2>{html.escape(message['subject'])}</h2>"
            f"<p class='meta'>{html.escape(message['received_at'])} · "
            f"from {html.escape(message['from'])} · to {html.escape(message['to'])}</p>"
            f"<pre>{body}</pre>"
            "</article>"
        )
    empty = "<p>No messages yet. Sign up with DEV_BYPASS_EMAIL_VERIFICATION=false.</p>"
    page = f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Local email inbox</title>
  <style>
    body {{ font-family: sans-serif; margin: 24px; background: #f7f4ef; color: #1f1f1f; }}
    h1 {{ color: #7340d2; }}
    .msg {{ background: white; padding: 16px; margin-bottom: 16px; border-radius: 8px; }}
    .meta {{ color: #68766d; font-size: 13px; }}
    pre {{ white-space: pre-wrap; }}
  </style>
</head>
<body>
  <h1>Local email inbox</h1>
  <p>SMTP 127.0.0.1:1025 · refresh to see new verification emails. Local development only.</p>
  {''.join(rows) or empty}
</body>
</html>
"""
    return page.encode("utf-8")


class InboxHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):  # noqa: A003
        return

    def do_GET(self):  # noqa: N802
        if self.path.rstrip("/") == "/api/messages":
            with LOCK:
                payload = json.dumps(MESSAGES).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(payload)
            return
        body = _inbox_html()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    parser = argparse.ArgumentParser(description="Local SMTP inbox for development.")
    parser.add_argument("--smtp-host", default="127.0.0.1")
    parser.add_argument("--smtp-port", type=int, default=1025)
    parser.add_argument("--http-host", default="127.0.0.1")
    parser.add_argument("--http-port", type=int, default=8025)
    args = parser.parse_args()

    ThreadingTCPServer.allow_reuse_address = True
    smtp_server = ThreadingTCPServer((args.smtp_host, args.smtp_port), SmtpSinkHandler)
    http_server = ThreadingHTTPServer((args.http_host, args.http_port), InboxHandler)

    print("Local development mail sink (does not send real email)", flush=True)
    print(f"  SMTP  {args.smtp_host}:{args.smtp_port}", flush=True)
    print(f"  Inbox http://{args.http_host}:{args.http_port}", flush=True)
    print("Ctrl+C to stop.", flush=True)

    smtp_thread = threading.Thread(target=smtp_server.serve_forever, daemon=True)
    smtp_thread.start()
    try:
        http_server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping local mail sink.")
    finally:
        http_server.server_close()
        smtp_server.shutdown()
        smtp_server.server_close()


if __name__ == "__main__":
    main()
