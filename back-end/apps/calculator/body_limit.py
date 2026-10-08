"""Bound request memory before JSON parsing, including chunked requests."""

from starlette.responses import JSONResponse


class RequestBodyLimitMiddleware:
    def __init__(self, app, max_bytes: int):
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope.get("method") != "POST":
            return await self.app(scope, receive, send)

        headers = dict(scope.get("headers", []))
        length = headers.get(b"content-length")
        if length is not None:
            try:
                declared_length = int(length)
            except ValueError:
                response = JSONResponse({"detail": "Invalid Content-Length."}, status_code=400)
                return await response(scope, receive, send)
            if declared_length < 0 or declared_length > self.max_bytes:
                response = JSONResponse({"detail": "Request payload is too large."}, status_code=413)
                return await response(scope, receive, send)

        chunks = []
        total = 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            chunk = message.get("body", b"")
            total += len(chunk)
            if total > self.max_bytes:
                response = JSONResponse({"detail": "Request payload is too large."}, status_code=413)
                return await response(scope, receive, send)
            chunks.append(chunk)
            if not message.get("more_body", False):
                break

        body = b"".join(chunks)
        delivered = False

        async def limited_receive():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {"type": "http.request", "body": body, "more_body": False}
            return await receive()

        await self.app(scope, limited_receive, send)
