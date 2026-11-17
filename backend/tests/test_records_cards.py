"""Tests for account-isolated diary records, 100-record limit, card unlocks, and 2-step card deletion."""

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from backend.app.core.config import reset_settings_cache
from backend.app.db.session import reset_db_engine
from backend.app.main import app
from backend.tests.asgi_helper import AsgiTestSession


class RecordsAndCardsTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.tmpdir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.tmpdir.name) / "records_cards.db"
        self.prev_db_url = os.environ.get("DATABASE_URL")
        os.environ["DATABASE_URL"] = f"sqlite:///{self.db_path.as_posix()}"
        reset_settings_cache()
        reset_db_engine()

        self.predictor_patch = patch("backend.app.main.create_predictor")
        self.predictor_cls = self.predictor_patch.start()
        self.addCleanup(self.predictor_patch.stop)
        self.mock_predictor = MagicMock()
        self.mock_predictor.model_version = "test-9class-v1"
        self.mock_predictor.predict_record.return_value = {
            "model_version": "test-9class-v1",
            "truncated": False,
            "probabilities": {
                "pos_1": 0.72,
                "pos_2": 0.04,
                "pos_3": 0.04,
                "neg_1": 0.04,
                "neg_2": 0.04,
                "neg_3": 0.03,
                "neu_1": 0.03,
                "neu_2": 0.03,
                "neu_3": 0.03,
            },
        }
        self.predictor_cls.return_value = self.mock_predictor

        await self.enterAsyncContext(app.router.lifespan_context(app))
        self.client = AsgiTestSession(app)
        self.user_a_headers = await self._register("usera", "usera@example.com")
        self.user_b_headers = await self._register("userb", "userb@example.com")

    async def asyncTearDown(self) -> None:
        reset_db_engine()
        if self.prev_db_url is None:
            os.environ.pop("DATABASE_URL", None)
        else:
            os.environ["DATABASE_URL"] = self.prev_db_url
        reset_settings_cache()
        self.tmpdir.cleanup()

    async def _register(self, login_id: str, email: str) -> dict[str, str]:
        policies = (await self.client.request("GET", "/api/auth/consent-policies")).json()
        consents = [{"code": p["code"], "version": p["version"], "agreed": True} for p in policies]
        resp = await self.client.request(
            "POST",
            "/api/auth/register",
            json_body={
                "login_id": login_id,
                "email": email,
                "password": "Password123!",
                "consents": consents,
            },
        )
        self.assertEqual(resp.status_code, 201)
        return {"Authorization": f"Bearer {resp.json()['access_token']}"}

    async def test_account_isolation_and_record_analysis_card_lifecycle(self) -> None:
        create = await self.client.request(
            "POST",
            "/api/records",
            headers=self.user_a_headers,
            json_body={
                "record_id": "rec-a-1",
                "text": "햇살이 따뜻해서 기분이 아주 좋았다.",
                "record_date": "2026-11-17",
            },
        )
        self.assertEqual(create.status_code, 201)
        self.assertEqual(create.json()["analysis"]["status"], "pending")

        # User B cannot see or mutate User A's record
        list_b = await self.client.request("GET", "/api/records", headers=self.user_b_headers)
        self.assertEqual(list_b.status_code, 200)
        self.assertEqual(list_b.json()["total_count"], 0)
        del_b = await self.client.request(
            "DELETE",
            "/api/records/rec-a-1?confirm_card_deletion=true",
            headers=self.user_b_headers,
        )
        self.assertEqual(del_b.status_code, 404)

        # Analyze User A's record -> unlocks pos_1:3 in collected_cards
        analyze = await self.client.request(
            "POST",
            "/api/analyze",
            headers=self.user_a_headers,
            json_body={
                "record_id": "rec-a-1",
                "version": 1,
                "request_id": "req-1",
                "text": "햇살이 따뜻해서 기분이 아주 좋았다.",
            },
        )
        self.assertEqual(analyze.status_code, 200)
        self.assertEqual(analyze.json()["card_key"], "pos_1:3")

        cards = (await self.client.request("GET", "/api/cards", headers=self.user_a_headers)).json()
        self.assertEqual(cards["unlocked_count"], 1)
        self.assertEqual(cards["cards"][0]["card_key"], "pos_1:3")
        self.assertEqual(cards["cards"][0]["collect_count"], 1)

        # Check delete impact & 2-step deletion enforcement
        impact = (
            await self.client.request(
                "GET",
                "/api/records/rec-a-1/delete-impact",
                headers=self.user_a_headers,
            )
        ).json()
        self.assertTrue(impact["has_card_unlock"])
        self.assertTrue(impact["will_relock_card"])
        self.assertEqual(impact["card_key"], "pos_1:3")

        unconfirmed_del = await self.client.request(
            "DELETE",
            "/api/records/rec-a-1",
            headers=self.user_a_headers,
        )
        self.assertEqual(unconfirmed_del.status_code, 409)
        self.assertEqual(unconfirmed_del.json()["code"], "CARD_UNLOCK_CONFIRM_REQUIRED")

        confirmed_del = await self.client.request(
            "DELETE",
            "/api/records/rec-a-1?confirm_card_deletion=true",
            headers=self.user_a_headers,
        )
        self.assertEqual(confirmed_del.status_code, 200)
        self.assertTrue(confirmed_del.json()["deleted_card_unlock"])
        self.assertEqual(confirmed_del.json()["relocked_card_key"], "pos_1:3")

        cards_after = (
            await self.client.request("GET", "/api/cards", headers=self.user_a_headers)
        ).json()
        self.assertEqual(cards_after["unlocked_count"], 0)

    async def test_max_100_records_per_account_and_import(self) -> None:
        entries = [
            {
                "record_id": f"imp-{i}",
                "text": f"기록 내용 {i}",
                "record_date": "2026-11-17",
                "favorite": i % 2 == 0,
            }
            for i in range(100)
        ]
        imp = await self.client.request(
            "POST",
            "/api/records/import",
            headers=self.user_a_headers,
            json_body={"entries": entries},
        )
        self.assertEqual(imp.status_code, 200)
        self.assertEqual(imp.json()["added"], 100)
        self.assertEqual(imp.json()["max_records"], 100)

        overflow = await self.client.request(
            "POST",
            "/api/records",
            headers=self.user_a_headers,
            json_body={
                "record_id": "rec-101",
                "text": "101번째 기록",
                "record_date": "2026-11-17",
            },
        )
        self.assertEqual(overflow.status_code, 409)
        self.assertEqual(overflow.json()["code"], "MAX_RECORDS_REACHED")
