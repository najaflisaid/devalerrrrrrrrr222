"""De Valeur backend.

Endpoints:
- GET  /api/health        – supervisor / load balancer probe
- POST /api/chat          – De Valeur AI sales assistant (Claude Sonnet 4.5 via emergent LLM key)
- POST /api/epoint/create-payment – Server-side Epoint payment-request (matches official WooCommerce plugin spec)
- POST /api/epoint/verify-callback – Verify a redirect/result-url payload signature
"""
import os
import json
import base64
import hashlib
import logging
from typing import List, Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from emergentintegrations.llm.chat import LlmChat, UserMessage

load_dotenv()

logger = logging.getLogger("devaleur")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="DE VALEUR API")

# Open CORS – preview ingress sets the host, frontend uses REACT_APP_BACKEND_URL
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# De Valeur AI – sales assistant chat
# ---------------------------------------------------------------------------

DEVALEUR_PERSONA = """Sən "De Valeur AI" adlı yüksək səviyyəli AI satış və konsultasiya köməkçisisən.
Sən De Valeur saatlar və lüks aksesuarlar mağazasının rəsmi virtual konsultantısan.
Sən ChatGPT, Claude, OpenAI, Anthropic deyilsən — sən sadəcə "De Valeur AI"-san.
Əgər səndən hansı modelə əsaslandığın və ya kimin tərəfindən yaradıldığın soruşulsa, sadəcə deyirsən:
"Mən De Valeur-un öz AI satış konsultantıyam — sizə kömək etmək üçün buradayam."

🎯 ƏSAS MƏQSƏD:
İstifadəçilərə onların ehtiyaclarına, büdcəsinə və zövqünə uyğun ən yaxşı məhsulları tapmaq və satış prosesini ağıllı şəkildə yönləndirmək.

🧠 NECƏ DÜŞÜNÜRSƏN (HƏR CAVABDAN ƏVVƏL DAXİLİ ANALİZ):
Cavab verməzdən ƏVVƏL hər zaman bunları zehnində aydınlaşdır (yazma, sadəcə düşün):
1. MÜŞTƏRİ NƏ İSTƏYİR? — Cins (kişi/qadın/unisex), tip (saat/aksesuar), büdcə, stil, məqsəd (özü/hədiyyə/kolleksiya).
2. HANSI MƏHSULLAR UYĞUNDUR? — Kataloqdan filtrlə: cins düz olsun, qiymət büdcəyə yaxın, stokda olsun, brend/stil müştərinin sözünə uyğun.
3. NIYƏ ONLAR? — Hər tövsiyə üçün 1 cümləlik konkret səbəb olsun.
4. NƏ SORUŞMALIYAM? — Hələ kifayət məlumat yoxdursa, ən vacib 1 sual ver (hamısını birdən yox).

🧭 DAVRANIŞ:
- Həmişə peşəkar, mehriban, inandırıcı tonda danış
- Robot kimi yox, insan kimi təbii dialoq qur
- İlk mesajda salam ver və nə axtardığını soruş
- Cavablar QISA olsun (max 4-6 cümlə), satış məktubuna çevirmə
- "Səbətə əlavə et" və "İndi al" düymələrinə yumşaq yönləndir

📊 MƏLUMAT TOPLAMA (mərhələli, hamısını birdən soruşma):
1. Kim üçündür? (kişi/qadın, özüm/hədiyyə)
2. Hansı tip? (saat, aksesuar)
3. Büdcə? (təxminən)
4. Stil? (klassik, sport, premium, minimalist)

🎯 SATIŞ STRATEGİYASI:
- 1-3 məhsul təklif et, daha çox yox (qarışıqlıq yaratma)
- Hər təklifdə: niyə bu müştəriyə uyğun olduğu qısaca
- Mümkündürsə bir premium (upsell) və ya sərfəli (downsell) alternativ də göstər
- Yalnız KATALOQDA olan və STOKDA olan məhsulları təklif et
- Stokda yoxdursa açıq de və ən yaxın alternativi göstər
- Cins səhv olmasın: müştəri qadın saatı istəyirsə, [kişi] etiketli məhsul TƏKLİF ETMƏ

📌 PSİXOLOJİ SATIŞ:
- Müştəri qərarsızdırsa → sadələşdir, 1 təklif ver
- Büdcə aşağıdırsa → "dəyər/qiymət balansı" və "sərfəli seçim"
- Büdcə yüksəkdirsə → "ekskluziv", "premium hisslər" vurğula
- Tərəddüddə → "BESTSELLER" etiketli məhsulları və "AZ QALIB" olanları önə çıxar (təcili hiss yarat)
- Endirimli məhsullar üçün "-X% endirim" vurğula

🔥 SONLANDIRMA:
Hər cavabın sonunda yumşaq satış sualı:
- "Daha premium variant göstərimmi?"
- "Sizə daha uyğun seçimləri daraldam?"
- "Daha çox seçim baxmaq istərdiniz?"
- "Bunu səbətə əlavə edim?"

🚫 QADAĞAN:
- Mağazaya aid olmayan saxta zəmanət/qayda uydurma
- Çox uzun siyahılar və yorucu izahlar
- Bir cavabda 4-dən çox məhsul
- Kataloqda OLMAYAN məhsul/brend uydurma
- Cinsi səhv olan məhsul təklifi
- Modelin/şirkətin kimliyini açıqlama (sən sadəcə De Valeur AI-san)

📦 MƏHSUL KATALOQU İSTİFADƏSİ:
Aşağıda saytın TAM məhsul kataloqu veriləcək (bütün məhsullar — yüzdən çox ola bilər).
Hər məhsulun: ID, brend, ad, [cins], [kateqoriya], qiymət, etiket (BESTSELLER/AZ QALIB/STOKDA YOX), və əksər hallarda qısa təsviri var.
SADƏCƏ bu siyahıdakı məhsulları təklif et və düzgün cinsə uyğunlaşdır.
Olmayan məhsul ad/brend uydurma.

🔍 MƏHSUL TAPMA STRATEGİYASI:
Müştəri konkret nəsə istəyəndə (məs. "Festina qadın saatı, 300 manat altı") — siyahını ZEHNİNDƏ skan et və ən yaxşı uyğunluqları tap.
Brendinə, cinsinə, qiymət diapazonuna, açar sözə (məs. "klassik", "sport", "qızıl") əsasən axtar.
Müştəri ümumi danışırsa (məs. "hədiyyə üçün nəsə") — sual verərək ehtiyacı dəqiqləşdir, sonra tövsiyə et.

🖼️ MƏHSUL KARTI FORMATI (ÇOX VACİB):
Müştəriyə hər hansı məhsul tövsiyə etdikdə, məhsulun **TAM ID-si** əsasında belə marker yaz:
[[PRODUCT:ID-BURAYA]]

⚠️ ID-NI KATALOQDAN OLDUĞU KİMİ KÖÇÜR — modeli/adı ID kimi yazma!
Kataloqda hər məhsul "ID:abcXYZ123 | brend — model..." formatında verilir. Buradakı `abcXYZ123` HAMISINI köçür.
ID-lər adətən 15-25 simvoldan ibarətdir (məs. `28DTXyVTkXbSeMwO3moQ`). Qısaltma!

Bu marker frontend tərəfindən avtomatik gözəl şəkilli kartla əvəz olunacaq — şəkil + ad + brend + qiymət göstəriləcək, klikləndikdə müştəri məhsul səhifəsinə keçəcək.

Buna görə MARKER YAZARKƏN qiymət, brend və adı təkrar yazma — onlar onsuz da kartda görünəcək. Marker yan-yana yox, ayrı sətirdə dur.

Düzgün nümunə (real Firestore ID ilə):
"Sizə bu variantı tövsiyə edirəm:

[[PRODUCT:28DTXyVTkXbSeMwO3moQ]]

Klassik dizayn, gündəlik istifadə üçün ideal seçim. Hansı haqda daha ətraflı danışım?"

YANLIŞ (model nömrəsini ID kimi yazma):
[[PRODUCT:F20694/6]]   ← BU YANLIŞDIR, modeldir, ID deyil
[[PRODUCT:F20694]]     ← BU DA YANLIŞDIR

DOĞRU (kataloqdakı tam ID-ni köçür):
[[PRODUCT:GsSUXSEOvZxK9pq2gh]]   ← BU DOĞRUDUR

Bir cavabda maks 3 marker. Hər marker ayrı sətirdə.
"""


class ChatProduct(BaseModel):
    id: str
    name: str
    brand: Optional[str] = ""
    category: Optional[str] = ""
    gender: Optional[str] = ""
    price: Optional[float] = None
    salePrice: Optional[float] = None
    stock: Optional[int] = None
    isBestseller: Optional[bool] = False
    description: Optional[str] = ""


class ChatHistoryItem(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatKnowledge(BaseModel):
    aiInstructions: Optional[str] = ""
    companyInfo: Optional[str] = ""
    brandsInfo: Optional[str] = ""
    policiesInfo: Optional[str] = ""
    productsInfo: Optional[str] = ""
    additionalNotes: Optional[str] = ""


class ChatRequest(BaseModel):
    session_id: str = Field(..., min_length=4, max_length=128)
    message: str = Field(..., min_length=1, max_length=2000)
    history: List[ChatHistoryItem] = Field(default_factory=list)
    products: List[ChatProduct] = Field(default_factory=list)
    knowledge: Optional[ChatKnowledge] = None
    language: str = "az"  # "az" | "ru" | "en"


class ChatResponse(BaseModel):
    reply: str


def _format_products(products: List[ChatProduct], limit: int = 500) -> str:
    if not products:
        return "(Hal-hazırda kataloq boşdur — müştərini bizimlə birbaşa əlaqə saxlamağa dəvət et.)"
    rows: List[str] = []
    for p in products[:limit]:
        # Price block
        if p.salePrice and p.price and p.salePrice < p.price:
            disc_pct = round(((p.price - p.salePrice) / p.price) * 100)
            price_str = f"{p.salePrice:.0f}₼ (köhnə {p.price:.0f}₼, -{disc_pct}%)"
        elif p.price is not None:
            price_str = f"{p.price:.0f}₼"
        else:
            price_str = "qiymət yoxdur"
        # Stock & badges
        badges: List[str] = []
        if p.stock is not None:
            if p.stock <= 0:
                badges.append("STOKDA YOX")
            elif p.stock <= 2:
                badges.append("AZ QALIB")
        if p.isBestseller:
            badges.append("BESTSELLER")
        badge_str = " · " + " · ".join(badges) if badges else ""
        # Gender
        gender_str = ""
        if p.gender == "men":
            gender_str = " [kişi]"
        elif p.gender == "women":
            gender_str = " [qadın]"
        elif p.gender == "unisex":
            gender_str = " [unisex]"
        # Category
        category_str = f" [{p.category}]" if p.category else ""
        # Brand prefix
        brand_str = f"{p.brand} — " if p.brand else ""
        # Description preview
        desc_preview = ""
        if p.description and p.description.strip():
            d = p.description.strip().replace("\n", " ")[:120]
            desc_preview = f" / {d}"
        rows.append(
            f"- ID:{p.id} | {brand_str}{p.name}{gender_str}{category_str} | {price_str}{badge_str}{desc_preview}"
        )
    extra = ""
    if len(products) > limit:
        extra = f"\n(Yuxarıda {limit} ən aktual məhsul göstərilib, kataloqda daha {len(products)-limit} məhsul var.)"
    return "\n".join(rows) + extra


def _catalog_summary(products: List[ChatProduct]) -> str:
    """Quick statistics so AI immediately understands the catalog."""
    if not products:
        return ""
    total = len(products)
    in_stock = sum(1 for p in products if (p.stock or 0) > 0)
    brands = sorted({p.brand for p in products if p.brand})
    categories = sorted({p.category for p in products if p.category})
    prices = [p.salePrice or p.price for p in products if (p.salePrice or p.price)]
    price_min = min(prices) if prices else 0
    price_max = max(prices) if prices else 0
    bestsellers = sum(1 for p in products if p.isBestseller)
    parts = [
        f"📊 KATALOQ STATİSTİKASI: {total} məhsul ({in_stock} stokda), {bestsellers} bestseller",
        f"💰 Qiymət diapazonu: {price_min:.0f}₼ – {price_max:.0f}₼",
        f"🏷️ Brendlər ({len(brands)}): " + ", ".join(brands[:20]),
        f"📂 Kateqoriyalar: " + ", ".join(categories[:15]),
    ]
    return "\n".join(parts)


def _format_history(history: List[ChatHistoryItem], limit: int = 8) -> str:
    if not history:
        return "(yeni söhbətdir)"
    recent = history[-limit:]
    lines: List[str] = []
    for h in recent:
        speaker = "Müştəri" if h.role == "user" else "De Valeur AI"
        lines.append(f"{speaker}: {h.content.strip()}")
    return "\n".join(lines)


def _format_knowledge(k: Optional[ChatKnowledge]) -> str:
    if k is None:
        return ""
    sections: List[str] = []
    if k.aiInstructions and k.aiInstructions.strip():
        sections.append(
            "⚡️ ADMIN-İN ƏN PRİORİTET KOMANDALARI (hər şeydən üstündür, MÜTLƏQ ƏMƏL ET):\n"
            + k.aiInstructions.strip()
        )
    if k.companyInfo and k.companyInfo.strip():
        sections.append("🏢 ŞİRKƏT HAQQINDA:\n" + k.companyInfo.strip())
    if k.brandsInfo and k.brandsInfo.strip():
        sections.append("🏷️ BRENDLƏR HAQQINDA:\n" + k.brandsInfo.strip())
    if k.policiesInfo and k.policiesInfo.strip():
        sections.append("🛡️ ZƏMANƏT/ÇATDIRILMA/QAYTARMA:\n" + k.policiesInfo.strip())
    if k.productsInfo and k.productsInfo.strip():
        sections.append("📦 MƏHSULLAR HAQQINDA ƏLAVƏ QEYDLƏR:\n" + k.productsInfo.strip())
    if k.additionalNotes and k.additionalNotes.strip():
        sections.append("📝 ƏLAVƏ KONTEKST/FAQ:\n" + k.additionalNotes.strip())
    if not sections:
        return ""
    return (
        "\n\n📚 ŞİRKƏT BİLİK BAZASI (admin tərəfindən təqdim olunmuş — DİQQƏTLƏ ƏMƏL ET):\n"
        + "\n\n".join(sections)
    )


@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest):
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OpenAI açarı konfiqurasiya edilməyib.")

    lang_directive = {
        "az": "Cavab DİLİ: Azərbaycan dilində (sənin əsas dilin).",
        "ru": "Cavab DİLİ: Rus dilində.",
        "en": "Cavab DİLİ: İngilis dilində.",
    }.get(req.language, "Cavab DİLİ: Müştərinin yazdığı dildə.")

    system_message = (
        DEVALEUR_PERSONA
        + "\n\n"
        + lang_directive
        + _format_knowledge(req.knowledge)
        + "\n\n"
        + _catalog_summary(req.products)
        + "\n\n📦 SAYTDAKI TAM MƏHSUL KATALOQU (real məlumat, hamısı stokdan asılı olmayaraq, ən aktual əvvəldə):\n"
        + _format_products(req.products)
        + "\n\n📝 ƏVVƏLKİ SÖHBƏT:\n"
        + _format_history(req.history)
        + "\n\nİndi yuxarıdakı kontekstə əsasən müştərinin son mesajına: əvvəlcə zehnində nə istədiyini analiz et, sonra qısa, təbii, satış yönümlü cavab ver. Cinsi və büdcəni mütləq yoxla."
    )

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=req.session_id,
            system_message=system_message,
        ).with_model("openai", "gpt-4o-mini")

        user_msg = UserMessage(text=req.message.strip())
        reply = await chat.send_message(user_msg)
        if not isinstance(reply, str):
            reply = str(reply)
        return ChatResponse(reply=reply.strip() or "Bağışlayın, cavab yarana bilmədi.")
    except Exception as e:
        logger.exception("Chat error: %s", e)
        raise HTTPException(status_code=500, detail=f"AI cavab verə bilmədi: {e}")


# ---------------------------------------------------------------------------
# Epoint.az — official payment-request flow
# Matches the official WooCommerce plugin (epoint.az/api/1/request):
#   data      = base64(json_encode(payload))
#   signature = base64(sha1(private_key + data + private_key, raw=True))
# Server-side call avoids browser CORS and keeps the contract identical to
# the official PHP plugin so Epoint always accepts the signature.
# ---------------------------------------------------------------------------

EPOINT_REQUEST_URL = "https://epoint.az/api/1/request"
EPOINT_PAYMENT_REQUEST_URL = "https://epoint.az/api/1/payment-request"
EPOINT_GET_STATUS_URL = "https://epoint.az/api/1/get-status"


def _epoint_sign(private_key: str, data_b64: str) -> str:
    raw = (private_key + data_b64 + private_key).encode("utf-8")
    digest = hashlib.sha1(raw).digest()
    return base64.b64encode(digest).decode("ascii")


def _epoint_build_payload(
    public_key: str,
    private_key: str,
    payload: dict,
) -> tuple[str, str]:
    # IMPORTANT: PHP's json_encode emits compact JSON with no spaces and uses
    # "/" without escaping in this plugin context. Python's json.dumps with
    # separators=(",", ":") matches the PHP output the signature was built on.
    json_str = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    data_b64 = base64.b64encode(json_str.encode("utf-8")).decode("ascii")
    signature = _epoint_sign(private_key, data_b64)
    return data_b64, signature


class EpointCreatePaymentRequest(BaseModel):
    public_key: str = Field(..., min_length=1)
    private_key: str = Field(..., min_length=1)
    amount: float = Field(..., gt=0)
    order_id: str = Field(..., min_length=1, max_length=128)
    currency: str = "AZN"
    language: str = "az"
    description: str = "DE VALEUR sifariş ödənişi"
    success_redirect_url: Optional[str] = None
    error_redirect_url: Optional[str] = None
    result_url: Optional[str] = None
    is_installment: Optional[int] = None


class EpointCreatePaymentResponse(BaseModel):
    status: str
    transaction: Optional[str] = None
    redirect_url: Optional[str] = None
    message: Optional[str] = None


@app.post("/api/epoint/create-payment", response_model=EpointCreatePaymentResponse)
async def epoint_create_payment(req: EpointCreatePaymentRequest):
    if req.language not in ("az", "en", "ru"):
        req.language = "az"

    # Build payload exactly like the official plugin
    payload: dict = {
        "public_key": req.public_key,
        # Send as float (PHP does (float)$total). PHP json_encode of a float
        # like 232.0 produces "232" — match by formatting with %g-like rules.
        # Safest: send as string "232.00" which the plugin's PHP cast accepts
        # and Epoint accepts. We choose the WooCommerce-plugin route: float.
        "amount": float(f"{req.amount:.2f}"),
        "currency": req.currency,
        "language": req.language,
        "order_id": req.order_id,
        "description": req.description or f"Order #{req.order_id}",
    }
    if req.success_redirect_url:
        payload["success_redirect_url"] = req.success_redirect_url
    if req.error_redirect_url:
        payload["error_redirect_url"] = req.error_redirect_url
    if req.result_url:
        payload["result_url"] = req.result_url
    if req.is_installment:
        payload["is_installment"] = int(req.is_installment)

    data_b64, signature = _epoint_build_payload(req.public_key, req.private_key, payload)

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Try the canonical payment-request endpoint first (used by both
            # the official OpenCart and WooCommerce plugins). Fall back to
            # /api/1/request which is the alternative documented endpoint.
            resp = await client.post(
                EPOINT_PAYMENT_REQUEST_URL,
                data={"data": data_b64, "signature": signature},
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            if resp.status_code >= 400 or "<html" in resp.text.lower()[:200]:
                resp = await client.post(
                    EPOINT_REQUEST_URL,
                    data={"data": data_b64, "signature": signature},
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )
    except httpx.HTTPError as e:
        logger.exception("Epoint network error: %s", e)
        raise HTTPException(status_code=502, detail=f"Epoint ilə əlaqə qurulmadı: {e}")

    if resp.status_code >= 400:
        logger.warning("Epoint HTTP %s: %s", resp.status_code, resp.text[:500])
        raise HTTPException(
            status_code=502,
            detail=f"Epoint cavabı uğursuz oldu (HTTP {resp.status_code})",
        )

    try:
        body = resp.json()
    except Exception:
        logger.warning("Epoint non-JSON response: %s", resp.text[:500])
        raise HTTPException(status_code=502, detail="Epoint düzgün cavab qaytarmadı")

    status = (body.get("status") or "").lower()
    if status != "success":
        return EpointCreatePaymentResponse(
            status="error",
            message=body.get("message") or body.get("description") or "Epoint xətası",
        )

    return EpointCreatePaymentResponse(
        status="success",
        transaction=str(body.get("transaction") or ""),
        redirect_url=str(body.get("redirect_url") or ""),
    )


# ---------------------------------------------------------------------------
# Epoint widget URL — for Apple Pay / Google Pay (iframe-based)
# Endpoint: https://epoint.az/api/1/token/widget
# Payload (per official docs): public_key, amount, order_id, description
# ---------------------------------------------------------------------------

EPOINT_WIDGET_URL = "https://epoint.az/api/1/token/widget"


class EpointWidgetRequest(BaseModel):
    public_key: str = Field(..., min_length=1)
    private_key: str = Field(..., min_length=1)
    amount: float = Field(..., gt=0)
    order_id: str = Field(..., min_length=1, max_length=255)
    description: str = "DE VALEUR sifariş"


class EpointWidgetResponse(BaseModel):
    status: str
    widget_url: Optional[str] = None
    message: Optional[str] = None


@app.post("/api/epoint/widget-url", response_model=EpointWidgetResponse)
async def epoint_widget_url(req: EpointWidgetRequest):
    payload = {
        "public_key": req.public_key,
        "amount": float(f"{req.amount:.2f}"),
        "order_id": req.order_id,
        "description": req.description or f"Order #{req.order_id}",
    }
    data_b64, signature = _epoint_build_payload(req.public_key, req.private_key, payload)

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                EPOINT_WIDGET_URL,
                data={"data": data_b64, "signature": signature},
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
    except httpx.HTTPError as e:
        logger.exception("Epoint widget network error: %s", e)
        raise HTTPException(status_code=502, detail=f"Epoint ilə əlaqə qurulmadı: {e}")

    if resp.status_code >= 400:
        logger.warning("Epoint widget HTTP %s: %s", resp.status_code, resp.text[:500])
        raise HTTPException(status_code=502, detail=f"Epoint widget cavabı: HTTP {resp.status_code}")

    try:
        body = resp.json()
    except Exception:
        raise HTTPException(status_code=502, detail="Epoint widget düzgün cavab qaytarmadı")

    status = (body.get("status") or "").lower()
    if status != "success" or not body.get("widget_url"):
        return EpointWidgetResponse(
            status="error",
            message=body.get("message") or body.get("description") or "Widget URL alınmadı",
        )

    return EpointWidgetResponse(status="success", widget_url=str(body.get("widget_url")))


# ---------------------------------------------------------------------------
# Epoint get-status — verify final payment outcome with Epoint server
# Endpoint: https://epoint.az/api/1/get-status
# Used after the user returns from the hosted checkout / widget. Matches the
# OpenCart plugin's `callback()` verification logic.
# ---------------------------------------------------------------------------


class EpointStatusRequest(BaseModel):
    public_key: str = Field(..., min_length=1)
    private_key: str = Field(..., min_length=1)
    transaction: Optional[str] = None
    order_id: Optional[str] = None


class EpointStatusResponse(BaseModel):
    status: str
    payment_status: Optional[str] = None
    transaction: Optional[str] = None
    raw: Optional[dict] = None


@app.post("/api/epoint/get-status", response_model=EpointStatusResponse)
async def epoint_get_status(req: EpointStatusRequest):
    if not req.transaction and not req.order_id:
        raise HTTPException(
            status_code=400, detail="`transaction` və ya `order_id` göstərin"
        )

    payload: dict = {"public_key": req.public_key}
    if req.transaction:
        payload["transaction"] = req.transaction
    if req.order_id:
        payload["order_id"] = req.order_id

    data_b64, signature = _epoint_build_payload(req.public_key, req.private_key, payload)

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                EPOINT_GET_STATUS_URL,
                data={"data": data_b64, "signature": signature},
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
    except httpx.HTTPError as e:
        logger.exception("Epoint get-status error: %s", e)
        raise HTTPException(status_code=502, detail=f"Epoint ilə əlaqə qurulmadı: {e}")

    if resp.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Epoint cavabı: HTTP {resp.status_code}")

    try:
        body = resp.json()
    except Exception:
        raise HTTPException(status_code=502, detail="Epoint düzgün cavab qaytarmadı")

    return EpointStatusResponse(
        status=str(body.get("status") or "unknown"),
        payment_status=str(body.get("payment_status") or body.get("status") or ""),
        transaction=str(body.get("transaction") or req.transaction or ""),
        raw=body,
    )


class EpointVerifyRequest(BaseModel):
    private_key: str = Field(..., min_length=1)
    data: str = Field(..., min_length=1)
    signature: str = Field(..., min_length=1)


class EpointVerifyResponse(BaseModel):
    valid: bool
    payload: Optional[dict] = None


@app.post("/api/epoint/verify-callback", response_model=EpointVerifyResponse)
async def epoint_verify_callback(req: EpointVerifyRequest):
    expected = _epoint_sign(req.private_key, req.data)
    if expected != req.signature:
        return EpointVerifyResponse(valid=False)
    try:
        decoded_json = base64.b64decode(req.data).decode("utf-8")
        payload = json.loads(decoded_json)
        return EpointVerifyResponse(valid=True, payload=payload)
    except Exception:
        return EpointVerifyResponse(valid=False)
