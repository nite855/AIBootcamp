"""Minimal dependency-free ASGI test client with cookie jar support for FastAPI tests."""

from http.cookies import SimpleCookie
import json
from typing import Any
from urllib.parse import urlsplit


class AsgiResponse:
    def __init__(self, status_code: int, headers: list[tuple[bytes, bytes]], body: bytes) -> None:
        self.status_code = status_code
        self.raw_headers = headers
        self.body = body
        self.cookies: dict[str, str] = {}
        for key, value in headers:
            if key.lower() == b"set-cookie":
                parsed = SimpleCookie()
                parsed.load(value.decode("latin-1"))
                for name, morsel in parsed.items():
                    self.cookies[name] = morsel.value

    def json(self) -> Any:
        return json.loads(self.body.decode("utf-8"))


class AsgiTestSession:
    def __init__(self, app: Any) -> None:
        self.app = app
        self.cookies: dict[str, str] = {}

    async def request(
        self,
        method: str,
        url: str,
        *,
        json_body: Any = None,
        headers: dict[str, str] | None = None,
    ) -> AsgiResponse:
        split = urlsplit(url)
        body_bytes = json.dumps(json_body).encode("utf-8") if json_body is not None else b""

        req_headers: list[tuple[bytes, bytes]] = [(b"content-type", b"application/json")]
        if headers:
            for k, v in headers.items():
                req_headers.append((k.lower().encode("latin-1"), v.encode("latin-1")))
        if self.cookies:
            cookie_header = "; ".join(f"{k}={v}" for k, v in self.cookies.items() if v)
            if cookie_header:
                req_headers.append((b"cookie", cookie_header.encode("latin-1")))

        messages: list[dict[str, Any]] = []

        async def receive() -> dict[str, Any]:
            return {"type": "http.request", "body": body_bytes, "more_body": False}

        async def send(message: dict[str, Any]) -> None:
            messages.append(message)

        await self.app(
            {
                "type": "http",
                "asgi": {"version": "3.0", "spec_version": "2.3"},
                "http_version": "1.1",
                "method": method.upper(),
                "scheme": "http",
                "path": split.path,
                "raw_path": split.path.encode("latin-1"),
                "query_string": split.query.encode("latin-1"),
                "root_path": "",
                "headers": req_headers,
                "client": ("127.0.0.1", 1234),
                "server": ("testserver", 80),
            },
            receive,
            send,
        )

        status_code = next(
            msg["status"] for msg in messages if msg["type"] == "http.response.start"
        )
        resp_headers = next(
            msg.get("headers", [])
            for msg in messages
            if msg["type"] == "http.response.start"
        )
        content = b"".join(
            msg.get("body", b"") for msg in messages if msg["type"] == "http.response.body"
        )

        response = AsgiResponse(status_code, resp_headers, content)
        for key, value in resp_headers:
            if key.lower() == b"set-cookie":
                parsed = SimpleCookie()
                parsed.load(value.decode("latin-1"))
                for name, morsel in parsed.items():
                    if morsel["max-age"] == "0" or morsel.value == "":
                        self.cookies.pop(name, None)
                    else:
                        self.cookies[name] = morsel.value
        return response
