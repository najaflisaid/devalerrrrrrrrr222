"""
AI Inbox backend tests
Covers:
- Meta webhook verification (WhatsApp + Instagram GET)
- Webhook payload acceptance (WhatsApp + Instagram POST)
- Admin auth (X-Admin-Secret)
- Admin config GET/POST (POST expected 503 since Firebase not ready)
- Admin conversations list (returns [] when Firebase not ready)
- Admin AI test endpoint (calls real Emergent LLM)
"""
import os
import json
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://category-organizer-6.preview.emergentagent.com").rstrip("/")
ADMIN_SECRET = "devaleur-admin-2026"
META_VERIFY_TOKEN = "devaleur-meta-2026"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# =====================================================================
# WhatsApp webhook verification (GET)
# =====================================================================
class TestWhatsAppWebhookVerify:
    def test_verify_success(self, s):
        r = s.get(
            f"{BASE_URL}/api/webhooks/whatsapp",
            params={
                "hub.mode": "subscribe",
                "hub.verify_token": META_VERIFY_TOKEN,
                "hub.challenge": "CHAL-WA-123",
            },
            timeout=20,
        )
        assert r.status_code == 200, r.text
        assert r.text == "CHAL-WA-123"

    def test_verify_wrong_token(self, s):
        r = s.get(
            f"{BASE_URL}/api/webhooks/whatsapp",
            params={
                "hub.mode": "subscribe",
                "hub.verify_token": "wrong-token",
                "hub.challenge": "X",
            },
            timeout=20,
        )
        assert r.status_code == 403

    def test_verify_missing_params(self, s):
        r = s.get(f"{BASE_URL}/api/webhooks/whatsapp", timeout=20)
        assert r.status_code == 403


# =====================================================================
# Instagram webhook verification (GET)
# =====================================================================
class TestInstagramWebhookVerify:
    def test_verify_success(self, s):
        r = s.get(
            f"{BASE_URL}/api/webhooks/instagram",
            params={
                "hub.mode": "subscribe",
                "hub.verify_token": META_VERIFY_TOKEN,
                "hub.challenge": "CHAL-IG-456",
            },
            timeout=20,
        )
        assert r.status_code == 200, r.text
        assert r.text == "CHAL-IG-456"

    def test_verify_wrong_token(self, s):
        r = s.get(
            f"{BASE_URL}/api/webhooks/instagram",
            params={
                "hub.mode": "subscribe",
                "hub.verify_token": "nope",
                "hub.challenge": "X",
            },
            timeout=20,
        )
        assert r.status_code == 403


# =====================================================================
# Webhook POST payload handling (Meta-style; META_APP_SECRET empty)
# =====================================================================
class TestWhatsAppWebhookReceive:
    def test_valid_payload_returns_ok(self, s):
        payload = {
            "object": "whatsapp_business_account",
            "entry": [{
                "id": "ENTRY1",
                "changes": [{
                    "field": "messages",
                    "value": {
                        "messaging_product": "whatsapp",
                        "metadata": {"phone_number_id": "PNID"},
                        "contacts": [{"wa_id": "994501234567", "profile": {"name": "Test"}}],
                        "messages": [{
                            "id": "wamid.TEST_MSG_1",
                            "from": "994501234567",
                            "timestamp": "1700000000",
                            "type": "text",
                            "text": {"body": "Salam"},
                        }],
                    },
                }],
            }],
        }
        r = s.post(f"{BASE_URL}/api/webhooks/whatsapp", data=json.dumps(payload), timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("status") == "ok"

    def test_non_wa_object_ignored(self, s):
        r = s.post(f"{BASE_URL}/api/webhooks/whatsapp", data=json.dumps({"object": "page"}), timeout=20)
        assert r.status_code == 200
        assert r.json().get("status") == "ignored"

    def test_empty_body_does_not_crash(self, s):
        r = s.post(f"{BASE_URL}/api/webhooks/whatsapp", data="", timeout=20)
        assert r.status_code in (200,)
        assert r.json().get("status") in ("ignored", "ok")


class TestInstagramWebhookReceive:
    def test_valid_instagram_payload(self, s):
        payload = {
            "object": "instagram",
            "entry": [{
                "id": "IG_PAGE",
                "time": 1700000000,
                "messaging": [{
                    "sender": {"id": "IGSID_111"},
                    "recipient": {"id": "PAGE_ID"},
                    "timestamp": 1700000000,
                    "message": {"mid": "m_test_ig_1", "text": "Salam"},
                }],
            }],
        }
        r = s.post(f"{BASE_URL}/api/webhooks/instagram", data=json.dumps(payload), timeout=20)
        assert r.status_code == 200, r.text
        assert r.json().get("status") == "ok"

    def test_page_object_accepted(self, s):
        payload = {"object": "page", "entry": []}
        r = s.post(f"{BASE_URL}/api/webhooks/instagram", data=json.dumps(payload), timeout=20)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"

    def test_non_ig_object_ignored(self, s):
        r = s.post(f"{BASE_URL}/api/webhooks/instagram",
                  data=json.dumps({"object": "whatsapp_business_account"}), timeout=20)
        assert r.status_code == 200
        assert r.json().get("status") == "ignored"


# =====================================================================
# Admin auth (X-Admin-Secret)
# =====================================================================
class TestAdminAuth:
    def test_config_no_secret_401(self, s):
        r = requests.get(f"{BASE_URL}/api/admin/ai-inbox/config", timeout=20)
        assert r.status_code == 401

    def test_config_wrong_secret_401(self, s):
        r = requests.get(
            f"{BASE_URL}/api/admin/ai-inbox/config",
            headers={"X-Admin-Secret": "wrong"},
            timeout=20,
        )
        assert r.status_code == 401

    def test_conversations_no_secret_401(self, s):
        r = requests.get(f"{BASE_URL}/api/admin/ai-inbox/conversations", timeout=20)
        assert r.status_code == 401

    def test_test_no_secret_401(self, s):
        r = requests.post(f"{BASE_URL}/api/admin/ai-inbox/test", json={"text": "x"}, timeout=20)
        assert r.status_code == 401


# =====================================================================
# Admin GET config
# =====================================================================
class TestAdminGetConfig:
    def test_get_config_returns_public_shape(self, s):
        r = requests.get(
            f"{BASE_URL}/api/admin/ai-inbox/config",
            headers={"X-Admin-Secret": ADMIN_SECRET},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        for key in [
            "global_enabled", "wa_enabled", "ig_enabled",
            "provider", "model", "allowed_models", "persona",
            "webhook_urls", "firebase_ready",
        ]:
            assert key in data, f"missing key {key}"
        # allowed_models structure
        am = data["allowed_models"]
        assert "openai" in am and isinstance(am["openai"], list) and len(am["openai"]) > 0
        assert "anthropic" in am and isinstance(am["anthropic"], list)
        assert "gemini" in am and isinstance(am["gemini"], list)
        # webhook urls
        wh = data["webhook_urls"]
        assert "whatsapp" in wh and wh["whatsapp"].endswith("/api/webhooks/whatsapp")
        assert "instagram" in wh and wh["instagram"].endswith("/api/webhooks/instagram")
        # Az persona default
        assert isinstance(data["persona"], str) and len(data["persona"]) > 20
        # Booleans
        assert isinstance(data["global_enabled"], bool)
        assert isinstance(data["firebase_ready"], bool)


# =====================================================================
# Admin POST config - Firebase not ready -> 503 expected
# =====================================================================
class TestAdminPostConfig:
    def test_post_config_returns_503_when_firebase_not_ready(self, s):
        r = requests.post(
            f"{BASE_URL}/api/admin/ai-inbox/config",
            headers={"X-Admin-Secret": ADMIN_SECRET, "Content-Type": "application/json"},
            data=json.dumps({"global_enabled": True}),
            timeout=20,
        )
        # If firebase happens to be ready, it returns 200 — acceptable.
        assert r.status_code in (503, 200), r.text
        if r.status_code == 503:
            assert "Firebase" in r.text or "firebase" in r.text.lower()


# =====================================================================
# Admin GET conversations (should return [] when no firebase, no crash)
# =====================================================================
class TestAdminConversations:
    def test_conversations_list(self, s):
        r = requests.get(
            f"{BASE_URL}/api/admin/ai-inbox/conversations",
            headers={"X-Admin-Secret": ADMIN_SECRET},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)


# =====================================================================
# Admin AI test endpoint (real LLM via Emergent)
# =====================================================================
class TestAdminAiTest:
    def test_ai_test_generates_reply(self, s):
        r = requests.post(
            f"{BASE_URL}/api/admin/ai-inbox/test",
            headers={"X-Admin-Secret": ADMIN_SECRET, "Content-Type": "application/json"},
            data=json.dumps({"text": "Salam, qadın saatları var?"}),
            timeout=90,
        )
        assert r.status_code == 200, f"AI test failed: {r.status_code} {r.text}"
        data = r.json()
        assert data.get("ok") is True
        reply = data.get("reply", "")
        assert isinstance(reply, str) and len(reply.strip()) > 0, f"Empty reply: {data}"
        # Soft assertion: persona/brand reference (non-fatal)
        lowered = reply.lower()
        soft_match = any(k in lowered for k in ["valeur", "saat", "saatlar", "salam", "məhsul", "mehsul"])
        assert soft_match, f"Reply does not look Azerbaijani/persona-aware: {reply!r}"
