"""ASGI tests for unified backend.app.main:app with JWT auth and PIPA consent gating."""

import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from backend.app.core.config import reset_settings_cache
from backend.app.db.session import reset_db_engine
from backend.app.main import app


class AppMainTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.tmpdir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.tmpdir.name) / "test_app_main.db"
        self.prev_db_url = os.environ.get("DATABASE_URL")
        os.environ["DATABASE_URL"] = f"sqlite:///{self.db_path.as_posix()}"
        reset_settings_cache()
        reset_db_engine()

        self.predictor_patch = patch("backend.app.main.create_predictor")
        self.predictor_cls = self.predictor_patch.start()
        self.addCleanup(self.predictor_patch.stop)
        self.predictor_cls.side_effect = FileNotFoundError("EMOTION_MODEL_DIR이 설정되지 않았습니다.")
        await self.enterAsyncContext(app.router.lifespan_context(app))

        self.access_token = await self._register_consented_user()

    async def asyncTearDown(self) -> None:
        reset_db_engine()
        if self.prev_db_url is None:
            os.environ.pop("DATABASE_URL", None)
        else:
            os.environ["DATABASE_URL"] = self.prev_db_url
        reset_settings_cache()
        self.tmpdir.cleanup()

    async def request(
        self,
        method: str,
        path: str,
        payload: object = None,
        token: str | None = None,
    ) -> tuple[int, bytes]:
        body = json.dumps(payload).encode() if payload is not None else b""
        messages = []
        headers = [(b"content-type", b"application/json")]
        if token:
            headers.append((b"authorization", f"Bearer {token}".encode()))

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
                "headers": headers,
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

    async def _register_consented_user(self) -> str:
        _, policies_bytes = await self.request("GET", "/api/auth/consent-policies")
        policies = json.loads(policies_bytes)
        consents = [
            {"code": p["code"], "version": p["version"], "agreed": True}
            for p in policies
        ]
        status, body = await self.request(
            "POST",
            "/api/auth/register",
            {
                "login_id": "tester01",
                "email": "tester01@example.com",
                "password": "StrongPassword1!",
                "consents": consents,
            },
        )
        self.assertEqual(status, 201)
        return json.loads(body)["access_token"]

    async def test_health_live_and_ready_when_model_missing(self) -> None:
        live_status, live_body = await self.request("GET", "/api/health/live")
        self.assertEqual(live_status, 200)
        self.assertEqual(json.loads(live_body), {"status": "live"})

        ready_status, ready_body = await self.request("GET", "/api/health/ready")
        self.assertEqual(ready_status, 503)
        ready_json = json.loads(ready_body)
        self.assertEqual(ready_json["status"], "not_ready")
        self.assertFalse(ready_json["model_loaded"])
        self.assertTrue(ready_json["database_connected"])

    async def test_api_only_does_not_serve_root_html(self) -> None:
        status, _ = await self.request("GET", "/")
        self.assertEqual(status, 404)

    async def test_analyze_requires_authentication(self) -> None:
        status, _ = await self.request(
            "POST",
            "/api/analyze",
            {"record_id": "r1", "version": 1, "request_id": "req-1", "text": "오늘의 기록"},
        )
        self.assertEqual(status, 401)

    async def test_analyze_returns_503_when_model_not_ready(self) -> None:
        status, content = await self.request(
            "POST",
            "/api/analyze",
            {"record_id": "r1", "version": 1, "request_id": "req-1", "text": "오늘의 기록"},
            token=self.access_token,
        )
        self.assertEqual(status, 503)
        self.assertEqual(json.loads(content)["code"], "MODEL_NOT_READY")

    async def test_analyze_invalid_request_returns_422(self) -> None:
        status, _ = await self.request(
            "POST",
            "/api/analyze",
            {"record_id": "r1", "version": 1, "request_id": "req-1", "text": "   \n "},
            token=self.access_token,
        )
        self.assertEqual(status, 422)

    async def test_invalid_model_output_returns_500_not_422(self) -> None:
        mock_predictor = MagicMock()
        mock_predictor.predict_record.return_value = {
            "model_version": "mock-v1",
            "truncated": False,
            "probabilities": {"pos_1": 0.0},
        }
        app.state.predictor = mock_predictor
        app.state.model_ready = True
        app.state.model_version = "mock-v1"

        status, content = await self.request(
            "POST",
            "/api/analyze",
            {"record_id": "r1", "version": 1, "request_id": "req-1", "text": "오늘의 기록"},
            token=self.access_token,
        )
        self.assertEqual(status, 500)
        self.assertEqual(json.loads(content)["code"], "INVALID_MODEL_OUTPUT")

    async def test_truncated_model_result_returns_unissuable_200(self) -> None:
        mock_predictor = MagicMock()
        mock_predictor.predict_record.return_value = {
            "model_version": "mock-v1",
            "truncated": True,
            "probabilities": None,
        }
        app.state.predictor = mock_predictor
        app.state.model_ready = True
        app.state.model_version = "mock-v1"

        status, content = await self.request(
            "POST",
            "/api/analyze",
            {"record_id": "r1", "version": 2, "request_id": "req-2", "text": "긴 기록"},
            token=self.access_token,
        )
        self.assertEqual(status, 200)
        body = json.loads(content)
        self.assertEqual(body["status"], "error")
        self.assertTrue(body["truncated"])
        self.assertIsNone(body["card_stage"])
        self.assertIsNone(body["card_key"])
        self.assertEqual(body["error_code"], "INPUT_TRUNCATED")

    async def test_valid_9_emotion_prediction_returns_evaluated_card(self) -> None:
        probs = {
            "pos_1": 0.05,
            "pos_2": 0.5,
            "pos_3": 0.05,
            "neg_1": 0.1,
            "neg_2": 0.1,
            "neg_3": 0.05,
            "neu_1": 0.05,
            "neu_2": 0.05,
            "neu_3": 0.05,
        }
        mock_predictor = MagicMock()
        mock_predictor.predict_record.return_value = {
            "model_version": "mock-3plus9-v1",
            "truncated": False,
            "probabilities": probs,
        }
        app.state.predictor = mock_predictor
        app.state.model_ready = True
        app.state.model_version = "mock-3plus9-v1"

        status, content = await self.request(
            "POST",
            "/api/analyze",
            {"record_id": "r-valid", "version": 1, "request_id": "req-valid", "text": "오늘의 기록"},
            token=self.access_token,
        )
        self.assertEqual(status, 200)
        body = json.loads(content)
        self.assertEqual(body["status"], "valid")
        self.assertEqual(body["dominant_emotion"], "pos_2")
        self.assertEqual(body["dominant_ratio"], 0.5)
        self.assertEqual(body["ties"], ["pos_2"])
        self.assertEqual(body["card_stage"], 2)
        self.assertEqual(body["card_key"], "pos_2:2")
        self.assertEqual(body["card_policy_version"], "card-stage-strict-gt-v1")
        self.assertNotIn("text", body)
