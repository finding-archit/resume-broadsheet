"""Request body size limit for the upload endpoint.

Starlette parses the whole multipart body before the route runs, so the
per-file check in the route cannot stop a client from streaming hundreds of
megabytes. This pure-ASGI middleware rejects oversized bodies early:

* a declared ``Content-Length`` above the limit is answered with 413 before
  any body is read;
* without a ``Content-Length`` (chunked uploads) the received bytes are
  counted, and the request is aborted with 413 as soon as the limit is passed.
"""

import json

PAYLOAD_TOO_LARGE = 413


class _BodyTooLarge(Exception):
    pass


class RequestSizeLimitMiddleware:
    def __init__(self, app, max_body_bytes: int, paths: tuple = ("/api/analyze",)):
        self.app = app
        self.max_body_bytes = max_body_bytes
        self.paths = frozenset(paths)

    @property
    def detail(self) -> str:
        limit_mb = self.max_body_bytes / (1024 * 1024)
        return f"The request is too large (limit {limit_mb:g} MB including form fields)."

    async def _reject(self, send) -> None:
        body = json.dumps({"detail": self.detail}).encode()
        await send(
            {
                "type": "http.response.start",
                "status": PAYLOAD_TOO_LARGE,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode()),
                    (b"connection", b"close"),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope.get("path") not in self.paths:
            await self.app(scope, receive, send)
            return

        for name, value in scope.get("headers", []):
            if name == b"content-length":
                try:
                    declared = int(value)
                except ValueError:
                    break
                if declared > self.max_body_bytes:
                    await self._reject(send)
                    return
                break

        received = 0
        exceeded = False
        response_started = False

        async def limited_receive():
            nonlocal received, exceeded
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_body_bytes:
                    exceeded = True
                    raise _BodyTooLarge()
            return message

        async def guarded_send(message):
            nonlocal response_started
            # Once the limit is hit, the app's own error response (FastAPI turns
            # body-reading errors into 400) is replaced by our 413.
            if exceeded:
                return
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, limited_receive, guarded_send)
        except Exception:
            # _BodyTooLarge may arrive wrapped (e.g. in an ExceptionGroup).
            if not exceeded:
                raise
        if exceeded and not response_started:
            await self._reject(send)
