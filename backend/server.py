"""
FastAPI backend for DE VALEUR.
Provides Epoint.az payment gateway integration:
  - POST /api/epoint/create   -> creates a signed payment request, returns Epoint redirect URL
  - POST /api/epoint/verify   -> verifies signed payload from redirect (success/error pages)
  - POST /api/epoint/result   -> webhook callback from Epoint (server-to-server). Updates
                                  Firestore order document via REST API.
"""
import base64
import hashlib
import json
import logging
import os
from typing import Optional

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("epoint")

app = FastAPI(title="DE VALEUR API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

EPOINT_PUBLIC_KEY = os.environ.get("EPOINT_PUBLIC_KEY", "")
EPOINT_PRIVATE_KEY = os.environ.get("EPOINT_PRIVATE_KEY", "")
EPOINT_SUCCESS_URL = os.environ.get("EPOINT_SUCCESS_URL", "")
EPOINT_ERROR_URL = os.environ.get("EPOINT_ERROR_URL", "")
EPOINT_RESULT_URL = os.environ.get("EPOINT_RESULT_URL", "")
EPOINT_API_URL = "https://epoint.az/api/1/request"
EPOINT_CHECKOUT_URL = "https://epoint.az/api/1/checkout"

FIREBASE_PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID", "")
FIREBASE_API_KEY = os.environ.get("FIREBASE_API_KEY", "")
FIRESTORE_BASE = (
    f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}"
    f"/databases/(default)/documents"
)


def _sign(json_str: str) -> str:
    """Epoint signature: base64( sha1( private_key + base64_data + private_key ) )"""
    payload = base64.b64encode(json_str.encode("utf-8")).decode("utf-8")
    raw = f"{EPOINT_PRIVATE_KEY}{payload}{EPOINT_PRIVATE_KEY}".encode("utf-8")
    digest = hashlib.sha1(raw).digest()
    return base64.b64encode(digest).decode("utf-8"), payload


def _verify(data_b64: str, signature: str) -> Optional[dict]:
    """Verify Epoint signed payload. Returns decoded JSON dict or None."""
    if not EPOINT_PRIVATE_KEY:
        logger.warning("EPOINT_PRIVATE_KEY not configured - skipping signature verify")
        try:
            return json.loads(base64.b64decode(data_b64).decode("utf-8"))
        except Exception as exc:  # noqa: BLE001
            logger.error("Failed to decode payload: %s", exc)
            return None
    raw = f"{EPOINT_PRIVATE_KEY}{data_b64}{EPOINT_PRIVATE_KEY}".encode("utf-8")
    expected = base64.b64encode(hashlib.sha1(raw).digest()).decode("utf-8")
    if expected != signature:
        logger.warning("Epoint signature mismatch: expected=%s got=%s", expected, signature)
        return None
    try:
        return json.loads(base64.b64decode(data_b64).decode("utf-8"))
    except Exception as exc:  # noqa: BLE001
        logger.error("Failed to decode payload: %s", exc)
        return None


def _firestore_patch_order(order_id: str, fields: dict) -> bool:
    """Update a customer_orders document via Firestore REST API.
    Security rules allow open writes, so api key is sufficient.
    """
    if not FIREBASE_PROJECT_ID:
        logger.warning("FIREBASE_PROJECT_ID not configured - cannot update order %s", order_id)
        return False
    fields_payload = {}
    for key, value in fields.items():
        if isinstance(value, bool):
            fields_payload[key] = {"booleanValue": value}
        elif isinstance(value, int):
            fields_payload[key] = {"integerValue": str(value)}
        elif isinstance(value, float):
            fields_payload[key] = {"doubleValue": value}
        elif value is None:
            fields_payload[key] = {"nullValue": None}
        else:
            fields_payload[key] = {"stringValue": str(value)}
    url = (
        f"{FIRESTORE_BASE}/customer_orders/{order_id}"
        f"?key={FIREBASE_API_KEY}"
        + "".join(f"&updateMask.fieldPaths={k}" for k in fields.keys())
    )
    try:
        response = requests.patch(url, json={"fields": fields_payload}, timeout=10)
        if response.status_code >= 400:
            logger.error("Firestore patch failed %s: %s", response.status_code, response.text)
            return False
        return True
    except Exception as exc:  # noqa: BLE001
        logger.error("Firestore patch exception: %s", exc)
        return False


class CreatePaymentRequest(BaseModel):
    order_id: str = Field(..., description="Internal order ID")
    amount: float = Field(..., gt=0)
    currency: str = "AZN"
    language: str = "az"
    description: str = "DE VALEUR sifariş ödənişi"


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "epoint_configured": bool(EPOINT_PUBLIC_KEY and EPOINT_PRIVATE_KEY),
    }


@app.post("/api/epoint/create")
async def create_payment(payload: CreatePaymentRequest):
    if not EPOINT_PUBLIC_KEY or not EPOINT_PRIVATE_KEY:
        raise HTTPException(
            status_code=503,
            detail=(
                "Epoint açarları konfiqurasiya edilməyib. Backend .env faylına "
                "EPOINT_PUBLIC_KEY və EPOINT_PRIVATE_KEY əlavə edin."
            ),
        )
    data = {
        "public_key": EPOINT_PUBLIC_KEY,
        "amount": f"{payload.amount:.2f}",
        "currency": payload.currency,
        "language": payload.language,
        "order_id": payload.order_id,
        "description": payload.description,
        "success_redirect_url": EPOINT_SUCCESS_URL,
        "error_redirect_url": EPOINT_ERROR_URL,
        "result_url": EPOINT_RESULT_URL,
    }
    json_str = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    signature, data_b64 = _sign(json_str)

    try:
        response = requests.post(
            EPOINT_API_URL,
            data={"data": data_b64, "signature": signature},
            timeout=15,
        )
        result = response.json()
    except Exception as exc:  # noqa: BLE001
        logger.error("Epoint request failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Epoint ilə əlaqə xətası: {exc}")

    if result.get("status") != "success" or not result.get("redirect_url"):
        logger.error("Epoint create error: %s", result)
        raise HTTPException(
            status_code=502,
            detail=result.get("message") or "Epoint ödənişi başladıla bilmədi",
        )

    return {
        "redirect_url": result["redirect_url"],
        "transaction": result.get("transaction"),
    }


@app.post("/api/epoint/verify")
async def verify_payment(request: Request):
    """Verify a redirect-back payload (data+signature from query/body)."""
    body = {}
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        body = await request.json()
    else:
        form = await request.form()
        body = dict(form)
    data_b64 = body.get("data") or request.query_params.get("data")
    signature = body.get("signature") or request.query_params.get("signature")
    if not data_b64 or not signature:
        raise HTTPException(status_code=400, detail="data və ya signature yoxdur")
    decoded = _verify(data_b64, signature)
    if decoded is None:
        raise HTTPException(status_code=400, detail="İmza doğrulanmadı")
    return {
        "verified": True,
        "order_id": decoded.get("order_id"),
        "status": decoded.get("status"),
        "code": decoded.get("code"),
        "amount": decoded.get("amount"),
        "transaction": decoded.get("transaction"),
        "raw": decoded,
    }


@app.post("/api/epoint/result")
async def epoint_result(data: str = Form(...), signature: str = Form(...)):
    """Server-to-server callback from Epoint after payment.
    Updates Firestore order document with final status.
    """
    decoded = _verify(data, signature)
    if decoded is None:
        logger.error("Result callback signature invalid")
        raise HTTPException(status_code=400, detail="İmza doğrulanmadı")

    order_id = decoded.get("order_id")
    epoint_status = decoded.get("status")  # success | failed
    logger.info("Epoint result for order %s: %s", order_id, epoint_status)

    if not order_id:
        return {"ok": False, "reason": "no order_id"}

    fields = {
        "paymentStatus": epoint_status or "unknown",
        "epointTransaction": decoded.get("transaction") or "",
        "epointCode": decoded.get("code") or "",
    }
    if epoint_status == "success":
        fields["status"] = "preparing"
        fields["paidAt"] = "now"
    else:
        fields["status"] = "payment_failed"

    _firestore_patch_order(order_id, fields)
    return {"ok": True}
