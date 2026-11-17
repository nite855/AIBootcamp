"""Tests for JWT authentication, refresh rotation, Korean PIPA consents, Consent Gate, and withdrawal."""

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from backend.app.core.config import reset_settings_cache
from backend.app.db.models import ConsentPolicy, UserConsentLog
from backend.app.db.session import get_session_factory, reset_db_engine
from backend.app.main import app
from backend.tests.asgi_helper import AsgiTestSession


class AuthAndConsentTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.tmpdir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.tmpdir.name) / "auth_consent.db"
        self.prev_db_url = os.environ.get("DATABASE_URL")
        os.environ["DATABASE_URL"] = f"sqlite:///{self.db_path.as_posix()}"
        reset_settings_cache()
        reset_db_engine()

        self.predictor_patch = patch("backend.app.main.create_predictor")
        self.predictor_mock = self.predictor_patch.start()
        self.addCleanup(self.predictor_patch.stop)
        self.predictor_mock.side_effect = FileNotFoundError("no model")
        await self.enterAsyncContext(app.router.lifespan_context(app))
        self.client = AsgiTestSession(app)

    async def asyncTearDown(self) -> None:
        reset_db_engine()
        if self.prev_db_url is None:
            os.environ.pop("DATABASE_URL", None)
        else:
            os.environ["DATABASE_URL"] = self.prev_db_url
        reset_settings_cache()
        self.tmpdir.cleanup()

    async def _policies(self) -> list[dict]:
        resp = await self.client.request("GET", "/api/auth/consent-policies")
        self.assertEqual(resp.status_code, 200)
        return resp.json()

    async def _consents_payload(
        self, *, omit_code: str | None = None, optional_agreed: bool = False
    ) -> list[dict]:
        items = []
        for p in await self._policies():
            if p["code"] == omit_code:
                continue
            agreed = optional_agreed if not p["is_required"] else True
            items.append({"code": p["code"], "version": p["version"], "agreed": agreed})
        return items

    async def test_register_requires_separated_mandatory_and_sensitive_consents(self) -> None:
        for idx, missing_code in enumerate(
            ("AGE_14_PLUS", "PRIVACY_COLLECTION", "SENSITIVE_EMOTION_PROCESSING")
        ):
            with self.subTest(missing=missing_code):
                resp = await self.client.request(
                    "POST",
                    "/api/auth/register",
                    json_body={
                        "login_id": f"user_req_{idx}",
                        "email": f"req_{idx}@example.com",
                        "password": "Password123!",
                        "consents": await self._consents_payload(omit_code=missing_code),
                    },
                )
                self.assertEqual(resp.status_code, 422)
                self.assertIn(missing_code, resp.json()["missing_required_codes"])

                unagreed = [
                    {**item, "agreed": False} if item["code"] == missing_code else item
                    for item in await self._consents_payload()
                ]
                resp_false = await self.client.request(
                    "POST",
                    "/api/auth/register",
                    json_body={
                        "login_id": f"user_false_{idx}",
                        "email": f"false_{idx}@example.com",
                        "password": "Password123!",
                        "consents": unagreed,
                    },
                )
                self.assertEqual(resp_false.status_code, 422)
                self.assertIn(missing_code, resp_false.json()["missing_required_codes"])

        ok_resp = await self.client.request(
            "POST",
            "/api/auth/register",
            json_body={
                "login_id": "alice01",
                "email": "Alice01@Example.com",
                "password": "Password123!",
                "consents": await self._consents_payload(optional_agreed=False),
            },
        )
        self.assertEqual(ok_resp.status_code, 201)
        body = ok_resp.json()
        self.assertFalse(body["consent_required"])
        self.assertEqual(body["user"]["email"], "alice01@example.com")
        self.assertIn("moment_refresh_token", ok_resp.cookies)

        dup_resp = await self.client.request(
            "POST",
            "/api/auth/register",
            json_body={
                "login_id": "alice01",
                "email": "other@example.com",
                "password": "Password123!",
                "consents": await self._consents_payload(),
            },
        )
        self.assertEqual(dup_resp.status_code, 409)

    async def test_login_refresh_rotation_and_logout(self) -> None:
        reg = await self.client.request(
            "POST",
            "/api/auth/register",
            json_body={
                "login_id": "bob01",
                "email": "bob01@example.com",
                "password": "Password123!",
                "consents": await self._consents_payload(),
            },
        )
        self.assertEqual(reg.status_code, 201)
        await self.client.request("POST", "/api/auth/logout")

        login = await self.client.request(
            "POST",
            "/api/auth/login",
            json_body={"login_id": "bob01", "password": "Password123!"},
        )
        self.assertEqual(login.status_code, 200)
        old_refresh_cookie = login.cookies.get("moment_refresh_token")
        self.assertTrue(old_refresh_cookie)

        refreshed = await self.client.request("POST", "/api/auth/refresh")
        self.assertEqual(refreshed.status_code, 200)
        new_refresh_cookie = refreshed.cookies.get("moment_refresh_token")
        self.assertTrue(new_refresh_cookie)
        self.assertNotEqual(old_refresh_cookie, new_refresh_cookie)

        # Replay of rotated old refresh token must fail
        self.client.cookies["moment_refresh_token"] = old_refresh_cookie
        reused = await self.client.request("POST", "/api/auth/refresh")
        self.assertEqual(reused.status_code, 401)

        # Restore new refresh cookie and verify logout revokes it
        self.client.cookies["moment_refresh_token"] = new_refresh_cookie
        logout = await self.client.request("POST", "/api/auth/logout")
        self.assertEqual(logout.status_code, 200)
        after_logout = await self.client.request("POST", "/api/auth/refresh")
        self.assertEqual(after_logout.status_code, 401)

    async def test_consent_version_bump_triggers_login_gate_and_blocks_protected_api(self) -> None:
        reg = await self.client.request(
            "POST",
            "/api/auth/register",
            json_body={
                "login_id": "carol01",
                "email": "carol01@example.com",
                "password": "Password123!",
                "consents": await self._consents_payload(),
            },
        )
        self.assertEqual(reg.status_code, 201)

        with get_session_factory()() as db:
            db.add(
                ConsentPolicy(
                    code="SENSITIVE_EMOTION_PROCESSING",
                    version=2,
                    title="[필수] 민감정보 처리 및 활용 동의 (v2)",
                    summary="개정된 민감정보 처리 동의",
                    purpose="감정 분석 및 저장",
                    items="대화 원문, 감정 분포, 카드",
                    retention_period="탈퇴 시까지",
                    refusal_notice="미동의 시 서비스 이용 불가",
                    is_required=True,
                    is_sensitive=True,
                    is_active=True,
                    display_order=3,
                )
            )
            db.commit()

        login = await self.client.request(
            "POST",
            "/api/auth/login",
            json_body={"login_id": "carol01", "password": "Password123!"},
        )
        self.assertEqual(login.status_code, 200)
        login_body = login.json()
        self.assertTrue(login_body["consent_required"])
        self.assertEqual(login_body["missing_required_codes"], ["SENSITIVE_EMOTION_PROCESSING"])

        gate_headers = {"Authorization": f"Bearer {login_body['access_token']}"}
        blocked = await self.client.request("GET", "/api/records", headers=gate_headers)
        self.assertEqual(blocked.status_code, 403)

        reconsent = await self.client.request(
            "PUT",
            "/api/auth/consents",
            headers=gate_headers,
            json_body={
                "consents": [
                    {"code": "SENSITIVE_EMOTION_PROCESSING", "version": 2, "agreed": True}
                ]
            },
        )
        self.assertEqual(reconsent.status_code, 200)
        re_body = reconsent.json()
        self.assertFalse(re_body["consent_required"])

        allowed = await self.client.request(
            "GET",
            "/api/records",
            headers={"Authorization": f"Bearer {re_body['access_token']}"},
        )
        self.assertEqual(allowed.status_code, 200)

    async def test_optional_revocation_and_account_withdrawal(self) -> None:
        reg = await self.client.request(
            "POST",
            "/api/auth/register",
            json_body={
                "login_id": "dave01",
                "email": "dave01@example.com",
                "password": "Password123!",
                "consents": await self._consents_payload(optional_agreed=True),
            },
        )
        self.assertEqual(reg.status_code, 201)
        headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

        revoke_opt = await self.client.request(
            "PUT",
            "/api/auth/consents",
            headers=headers,
            json_body={
                "consents": [
                    {"code": "OPTIONAL_SERVICE_IMPROVEMENT", "version": 1, "agreed": False}
                ]
            },
        )
        self.assertEqual(revoke_opt.status_code, 200)
        opt_item = next(
            c for c in revoke_opt.json()["consents"] if c["code"] == "OPTIONAL_SERVICE_IMPROVEMENT"
        )
        self.assertFalse(opt_item["agreed"])

        revoke_mand = await self.client.request(
            "PUT",
            "/api/auth/consents",
            headers=headers,
            json_body={
                "consents": [
                    {"code": "SENSITIVE_EMOTION_PROCESSING", "version": 1, "agreed": False}
                ]
            },
        )
        self.assertEqual(revoke_mand.status_code, 422)

        withdraw = await self.client.request(
            "POST",
            "/api/auth/withdraw",
            headers=headers,
            json_body={"password": "Password123!", "confirm_withdrawal": True},
        )
        self.assertEqual(withdraw.status_code, 200)

        login_after = await self.client.request(
            "POST",
            "/api/auth/login",
            json_body={"login_id": "dave01", "password": "Password123!"},
        )
        self.assertEqual(login_after.status_code, 401)

        with get_session_factory()() as db:
            logs = db.query(UserConsentLog).filter(UserConsentLog.action == "WITHDRAWN").all()
            self.assertGreaterEqual(len(logs), 1)
            self.assertIsNone(logs[0].user_id)
