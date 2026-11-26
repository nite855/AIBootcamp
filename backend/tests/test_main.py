import json
import tempfile
import unittest
from contextlib import chdir
from pathlib import Path
from unittest.mock import patch

from backend.main import app


class MainTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.predictor_patch = patch("backend.main.EmotionPredictor")
        self.predictor = self.predictor_patch.start().return_value
        self.addCleanup(self.predictor_patch.stop)
        self.predictor.predict.return_value = {
            "emotion": "기쁨",
            "confidence": 1.0,
            "probabilities": {"기쁨": 1.0},
            "input_tokens": 4,
            "truncated": False,
        }
        await self.enterAsyncContext(app.router.lifespan_context(app))

    async def request(
        self, method: str, path: str, payload: object = None
    ) -> tuple[int, bytes]:
        """Exercise the ASGI app without an HTTP client dependency or model weights."""
        body = json.dumps(payload).encode() if payload is not None else b""
        messages = []

        async def receive() -> dict:
            return {"type": "http.request", "body": body, "more_body": False}

        async def send(message: dict) -> None:
            messages.append(message)

        await app(
            {
                "type": "http",
                "asgi": {"version": "3.0", "spec_version": "2.3"},
                "http_version": "1.1",
                "method": method,
                "scheme": "http",
                "path": path,
                "raw_path": path.encode(),
                "query_string": b"",
                "root_path": "",
                "headers": [(b"content-type", b"application/json")],
                "client": ("127.0.0.1", 1234),
                "server": ("testserver", 80),
            },
            receive,
            send,
        )
        status = next(
            message["status"]
            for message in messages
            if message["type"] == "http.response.start"
        )
        content = b"".join(
            message.get("body", b"")
            for message in messages
            if message["type"] == "http.response.body"
        )
        return status, content

    async def test_root_serves_main_frontend_from_another_working_directory(self) -> None:
        frontend = Path(__file__).resolve().parents[2] / "frontend" / "index.html"
        with tempfile.TemporaryDirectory() as directory, chdir(directory):
            status, content = await self.request("GET", "/")
        self.assertEqual(status, 200)
        self.assertEqual(content, frontend.read_bytes())
        self.predictor.predict.assert_not_called()

    async def test_analysis_preserves_lines_and_response_contract(self) -> None:
        status, content = await self.request(
            "POST", "/api/analyze", {"text": " 오늘은 행복해 \n\n내일도 기대돼 "}
        )
        self.assertEqual(status, 200)
        response = json.loads(content)
        self.assertEqual(response["lines"], ["오늘은 행복해", "내일도 기대돼"])
        self.assertEqual(
            response["predictions"], [self.predictor.predict.return_value] * 2
        )
        self.assertEqual(self.predictor.predict.call_count, 2)

    async def test_empty_text_returns_422_without_inference(self) -> None:
        status, content = await self.request("POST", "/api/analyze", {"text": " \n "})
        self.assertEqual(status, 422)
        self.assertEqual(json.loads(content)["detail"], "분석할 문장을 입력하세요.")
        self.predictor.predict.assert_not_called()

    async def test_missing_text_returns_422(self) -> None:
        status, _ = await self.request("POST", "/api/analyze", {})
        self.assertEqual(status, 422)
        self.predictor.predict.assert_not_called()

    async def test_prediction_validation_failure_returns_422(self) -> None:
        self.predictor.predict.side_effect = ValueError("invalid input")
        status, content = await self.request("POST", "/api/analyze", {"text": "기록"})
        self.assertEqual(status, 422)
        self.assertEqual(json.loads(content)["detail"], "invalid input")
