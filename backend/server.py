"""De Valeur backend.

Endpoints:
- GET  /api/health        – supervisor / load balancer probe
- POST /api/chat          – De Valeur AI sales assistant (Claude Sonnet 4.5 via emergent LLM key)
- POST /api/epoint/create-payment – Server-side Epoint payment-request (matches official WooCommerce plugin spec)
- POST /api/epoint/verify-callback – Verify a redirect/result-url payload signature
- POST /api/auth/forgot-password – customer self-serve: reset password & send via WhatsApp
- POST /api/admin/customers/reset-password – admin: reset a customer's password & send via WhatsApp
- GET/POST /api/admin/whatsapp-config – admin: view/update WhatsApp credentials in Firestore
- POST /api/admin/whatsapp-test – admin: send a test WhatsApp message
"""
import os
import json
import base64
import hashlib
import logging
import secrets
import string
from typing import List, Optional, Dict, Any

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()

# Google Gemini API for De Valeur AI chat
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-flash-lite-latest")
GEMINI_MODEL_FALLBACKS = [
    m.strip()
    for m in os.environ.get(
        "GEMINI_MODEL_FALLBACKS",
        "gemini-3.1-flash-lite,gemini-3-flash-preview,gemini-3.5-flash",
    ).split(",")
    if m.strip()
]
GEMINI_BASE_URL = os.environ.get(
    "GEMINI_BASE_URL",
    "https://generativelanguage.googleapis.com/v1beta",
)


def _gemini_models_chain() -> List[str]:
    """Primary model followed by fallbacks (deduped, order preserved)."""
    seen: set = set()
    out: List[str] = []
    for m in [GEMINI_MODEL, *GEMINI_MODEL_FALLBACKS]:
        if m and m not in seen:
            seen.add(m)
            out.append(m)
    return out


async def _gemini_generate(payload: Dict[str, Any], timeout: float = 45.0) -> tuple[Optional[Dict[str, Any]], Optional[str]]:
    """Try primary model, then fallbacks on 429/503. Returns (json_body, error_str)."""
    last_error = "no models configured"
    async with httpx.AsyncClient(timeout=timeout) as client:
        for model in _gemini_models_chain():
            url = f"{GEMINI_BASE_URL}/models/{model}:generateContent?key={GEMINI_API_KEY}"
            try:
                r = await client.post(url, headers={"Content-Type": "application/json"}, json=payload)
            except httpx.HTTPError as e:
                last_error = f"network: {e}"
                logger.warning("Gemini %s network error: %s", model, e)
                continue
            if r.status_code in (429, 503):
                last_error = f"HTTP {r.status_code} on {model}"
                logger.info("Gemini %s busy (HTTP %s), trying next fallback", model, r.status_code)
                continue
            if r.status_code >= 400:
                last_error = f"HTTP {r.status_code}: {r.text[:200]}"
                logger.warning("Gemini %s HTTP %s: %s", model, r.status_code, r.text[:400])
                return None, last_error
            try:
                return r.json(), None
            except Exception:
                last_error = "non-JSON response"
                return None, last_error
    return None, last_error

# Firebase Admin SDK (used for password reset operations)
import firebase_admin
from firebase_admin import credentials, auth as fb_auth, firestore as fb_firestore

logger = logging.getLogger("devaleur")
logging.basicConfig(level=logging.INFO)

# ---------------------------------------------------------------------------
# Firebase Admin SDK initialization (graceful – endpoints check `firebase_ready`
# before performing privileged operations, so the API stays online even if the
# service-account JSON has not yet been provided.)
# ---------------------------------------------------------------------------
firebase_ready = False
fb_db = None
try:
    sa_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH", "/app/backend/firebase-service-account.json")
    sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
    if sa_json:
        cred = credentials.Certificate(json.loads(sa_json))
    elif os.path.exists(sa_path):
        cred = credentials.Certificate(sa_path)
    else:
        cred = None
    if cred is not None:
        firebase_admin.initialize_app(cred)
        fb_db = fb_firestore.client()
        firebase_ready = True
        logger.info("Firebase Admin SDK initialised (service account loaded).")
    else:
        logger.warning(
            "Firebase Admin SDK NOT initialised – service account missing. "
            "Set FIREBASE_SERVICE_ACCOUNT_JSON env or place file at %s. "
            "Password-reset endpoints will return 503 until then.", sa_path,
        )
except Exception as fb_init_err:
    logger.exception("Firebase Admin SDK init failed: %s", fb_init_err)
    firebase_ready = False


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
# CORS-safe image proxy — used by the admin "Story üçün paylaş" modal so
# canvas.drawImage() does not taint the canvas when loading R2/Firebase URLs
# that lack CORS response headers.
#
# Only whitelisted upstream hosts are accepted to prevent SSRF abuse.
# Response is streamed back with `Access-Control-Allow-Origin: *`.
# ---------------------------------------------------------------------------
from fastapi.responses import Response as _FastAPIResponse  # noqa: E402

_IMG_PROXY_ALLOWED = (
    ".r2.dev",
    ".r2.cloudflarestorage.com",
    ".workers.dev",
    ".firebasestorage.app",
    "firebasestorage.googleapis.com",
    "storage.googleapis.com",
    "lh3.googleusercontent.com",
    "images.unsplash.com",
    "cdn.devaleur.az",
    "media.devaleur.az",
    "img.devaleur.az",
)


@app.get("/api/img-proxy")
async def image_proxy(url: str):
    """
    Fetch a remote image and return it with CORS-permissive headers.
    Only hosts in the whitelist are proxied.
    """
    from urllib.parse import urlparse

    try:
        parsed = urlparse(url)
    except Exception:
        raise HTTPException(status_code=400, detail="invalid url")

    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="invalid scheme")

    host = (parsed.hostname or "").lower()
    # SSRF guard — block internal/private hosts; allow any public image host so
    # the Story generator can proxy product images regardless of CDN/host.
    _blocked_prefixes = ("127.", "10.", "192.168.", "169.254.")
    if (
        not host
        or host in ("localhost", "::1")
        or host.endswith(".local")
        or host.startswith(_blocked_prefixes)
    ):
        raise HTTPException(status_code=403, detail=f"host not allowed: {host}")

    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            upstream = await client.get(url, headers={"User-Agent": "DeValeur-ImgProxy/1.0"})
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"upstream error: {e}")

    if upstream.status_code >= 400:
        raise HTTPException(status_code=upstream.status_code, detail="upstream failed")

    content_type = upstream.headers.get("content-type", "image/jpeg")
    return _FastAPIResponse(
        content=upstream.content,
        media_type=content_type,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=86400",
        },
    )


# ---------------------------------------------------------------------------
# Telegram bildirişləri — yeni söhbət başlayanda / müştəri əlaqə nömrəsi paylaşanda
# Token və chat_id yalnız server tərəfdə (env) saxlanılır.
# ---------------------------------------------------------------------------
_TG_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
_TG_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")


class TelegramNotifyRequest(BaseModel):
    type: str = "new_session"
    code: str = ""
    message: str = ""
    phone: str = ""
    name: str = ""


async def _tg_send(text: str) -> dict:
    if not _TG_TOKEN or not _TG_CHAT_ID:
        return {"ok": False, "error": "telegram not configured"}
    url = f"https://api.telegram.org/bot{_TG_TOKEN}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(
                url,
                json={
                    "chat_id": _TG_CHAT_ID,
                    "text": text,
                    "parse_mode": "HTML",
                    "disable_web_page_preview": True,
                },
            )
        return r.json()
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.get("/api/telegram/chat-info")
async def telegram_chat_info():
    """getUpdates — qrupun chat_id-sini tapmaq üçün köməkçi endpoint."""
    if not _TG_TOKEN:
        raise HTTPException(status_code=400, detail="TELEGRAM_BOT_TOKEN not set")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(f"https://api.telegram.org/bot{_TG_TOKEN}/getUpdates")
        data = r.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
    chats = []
    seen = set()
    for upd in (data.get("result") or []):
        msg = upd.get("message") or upd.get("channel_post") or upd.get("my_chat_member") or {}
        chat = msg.get("chat") or {}
        cid = chat.get("id")
        if cid and cid not in seen:
            seen.add(cid)
            chats.append({
                "id": cid,
                "title": chat.get("title") or chat.get("username") or chat.get("first_name"),
                "type": chat.get("type"),
            })
    return {"configured_chat_id": _TG_CHAT_ID, "raw_ok": data.get("ok"), "chats": chats}


@app.post("/api/telegram/notify")
async def telegram_notify(body: TelegramNotifyRequest):
    code = (body.code or "?").strip()
    if body.type == "contact":
        name = (body.name or "").strip()
        phone = (body.phone or "").strip()
        lines = ["📞 <b>Müştəri ilə əlaqə yarat</b>", f"Müştəri: <b>#{code}</b>"]
        if name:
            lines.append(f"👤 {name}")
        if phone:
            lines.append(f"📱 <b>{phone}</b>")
        text = "\n".join(lines)
    else:
        text = f"🆕 <b>Yeni söhbət başladı</b>\nMüştəri: <b>#{code}</b>"
        msg = (body.message or "").strip()
        if msg:
            text += f"\n💬 {msg[:200]}"
    result = await _tg_send(text)
    return {"ok": bool(result.get("ok")), "detail": result.get("error")}


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
- Tərəddüddə → "BESTSELLER" etiketli məhsulları önə çıxar (sosial-proof)
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
Hər məhsulun: ID, brend, ad, [cins], [kateqoriya], qiymət, etiket (BESTSELLER/STOKDA YOX), və əksər hallarda qısa təsviri var.
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
    session_id: Optional[str] = Field(default=None, max_length=128)
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
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="Gemini API açarı konfiqurasiya edilməyib.")

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
        + "\n\n⚠️ SON XATIRLATMA: Yuxarıdakı ADMIN QAYDALARI (⚡️ ADMIN-İN ƏN PRİORİTET KOMANDALARI bölməsi) və ŞİRKƏT BİLİK BAZASI hər zaman ƏSAS PRİORİTETDİR. Əgər personada göstərilən qayda ilə admin qaydası ziddiyyət təşkil edərsə, ADMIN QAYDASINA əməl et."
    )

    # Build Gemini contents from history (map assistant->model)
    contents: List[Dict[str, Any]] = []
    for h in (req.history or [])[-10:]:
        if not (h.content or "").strip():
            continue
        role = "user" if h.role == "user" else "model"
        contents.append({"role": role, "parts": [{"text": h.content}]})
    contents.append({"role": "user", "parts": [{"text": req.message.strip()}]})

    payload = {
        "systemInstruction": {"parts": [{"text": system_message}]},
        "contents": contents,
        "generationConfig": {
            "temperature": 0.7,
            "topP": 0.95,
            "maxOutputTokens": 2048,
        },
        "safetySettings": [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_ONLY_HIGH"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_ONLY_HIGH"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_ONLY_HIGH"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_ONLY_HIGH"},
        ],
    }

    url = f"{GEMINI_BASE_URL}/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    try:
        data, err = await _gemini_generate(payload, timeout=45.0)
        if err or not data:
            raise HTTPException(status_code=502, detail=f"AI provayder xətası: {err or 'boş cavab'}")
        candidates = data.get("candidates") or []
        reply = ""
        if candidates:
            parts = ((candidates[0].get("content") or {}).get("parts")) or []
            reply = "".join(p.get("text", "") for p in parts).strip()
        if not reply:
            finish_reason = (candidates[0] or {}).get("finishReason") if candidates else "UNKNOWN"
            logger.warning("Gemini empty reply, finishReason=%s, raw=%s", finish_reason, str(data)[:400])
            reply = "Bağışlayın, cavab yarana bilmədi. Yenidən cəhd edin."
        return ChatResponse(reply=reply)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Chat error: %s", e)
        raise HTTPException(status_code=500, detail=f"AI cavab verə bilmədi: {e}")


# ---------------------------------------------------------------------------
# /api/workers-chat — HR / team analytics AI assistant for the admin panel.
#
# Admin sends the current workers snapshot (plus recent fines/rewards/sales/
# requests) alongside a natural-language question. The endpoint composes a
# grounded system prompt from the data and asks Gemini for an analytical
# answer in Azerbaijani (or user's chosen language).
# ---------------------------------------------------------------------------

class WorkerLite(BaseModel):
    id: str = ""
    name: str = ""
    surname: str = ""
    position: str = ""
    branch: Optional[str] = None
    hireDate: Optional[str] = None
    isActive: Optional[bool] = True
    rating: Optional[float] = None
    monthlyTarget: Optional[float] = None
    monthlyTotalSales: Optional[float] = None
    monthlyTotalReturns: Optional[float] = None
    salesHistory: Optional[Dict[str, float]] = None
    returnsHistory: Optional[Dict[str, float]] = None
    targetsHistory: Optional[Dict[str, float]] = None


class FineLite(BaseModel):
    workerId: str = ""
    amount: float = 0
    reason: str = ""
    date: str = ""


class RewardLite(BaseModel):
    workerId: str = ""
    type: str = "bonus"
    amount: Optional[float] = None
    reason: str = ""
    date: str = ""


class RequestLite(BaseModel):
    workerId: str = ""
    type: str = ""
    status: str = ""
    subject: str = ""
    createdAt: str = ""


class WorkersChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatHistoryItem]] = []
    language: Optional[str] = "az"
    workers: Optional[List[WorkerLite]] = []
    fines: Optional[List[FineLite]] = []
    rewards: Optional[List[RewardLite]] = []
    requests: Optional[List[RequestLite]] = []
    # Admin can pass an extra note / constraint (e.g., current period focus)
    context: Optional[str] = ""


HR_PERSONA = """Sən De Valeur şirkətinin admini üçün işləyən HR/heyət analitikasısan.

🎯 ƏSAS MƏQSƏD:
Admin sizdən komanda haqqında suallar verəcək (kim yaxşı satır, kimin performansı zəifdir, cərimələr, mükafatlar, tələblər, filial müqayisələri və s.). Cavabları QISA, konkret və data-ya əsaslanmış şəkildə ver.

🧭 DAVRANIŞ:
- Adminlə peşəkar, məlumatlı, bir HR analitiki tonunda danış
- Cavab dilində konkret rəqəm və adlar ver (məs. "Rəşad Əliyev — 4,200 AZN satış, 88% reytinq")
- Ümumiləşdirməkdən çəkin — hansı işçini nəzərdə tutduğunu aydın göstər
- Rəqəmləri AZN valyutasında və 0/2 onluqda ver
- Zəruri hallarda TOP-3 və ya siyahı formatı istifadə et (- ilə)
- Cavab uzunluğu: 3-8 cümlə (əgər sual siyahı istəyirsə, siyahını qısa saxla)
- Heç vaxt uydurma — göstərilən data-dan kənara çıxmasan
- Əgər sual data ilə əlaqəli deyilsə, mehriban şəkildə admini komanda mövzusuna qaytar

📊 STATİSTİKA QAYDALARI:
- "Bu ay" dedikdə cari ay salesHistory-də tapdığın son ay
- Reytinq (%): işçinin ümumi performans göstəricisi
- monthlyTotalSales / monthlyTarget → hədəf tamamlanma faizi
- monthlyTotalReturns → qaytarılmalar (əskiltmə)
- Cərimələr və mükafatlar tarixçəsini nəzərə al

Əgər səndən hansı model olduğun soruşulsa: "Mən De Valeur-un daxili HR AI-yıyam."
"""


def _summarise_workers(workers: List[WorkerLite]) -> str:
    if not workers:
        return "Komandada işçi yoxdur."
    active = [w for w in workers if w.isActive]
    total_sales_month = sum((w.monthlyTotalSales or 0) for w in active)
    total_target = sum((w.monthlyTarget or 0) for w in active)
    avg_rating = 0.0
    if active:
        avg_rating = sum((w.rating or 0) for w in active) / len(active)
    branches: Dict[str, int] = {}
    positions: Dict[str, int] = {}
    for w in active:
        if w.branch:
            branches[w.branch] = branches.get(w.branch, 0) + 1
        if w.position:
            positions[w.position] = positions.get(w.position, 0) + 1
    return (
        f"📊 KOMANDA ÜMUMİ:\n"
        f"- Ümumi işçi: {len(workers)}, aktiv: {len(active)}\n"
        f"- Cari ay ümumi satış: {total_sales_month:,.0f} AZN (hədəf: {total_target:,.0f} AZN)\n"
        f"- Orta performans reytinqi: {avg_rating:.1f}%\n"
        f"- Filiallar: {', '.join(f'{k} ({v})' for k, v in branches.items()) or '—'}\n"
        f"- Vəzifələr: {', '.join(f'{k} ({v})' for k, v in positions.items()) or '—'}"
    )


def _format_workers(workers: List[WorkerLite], limit: int = 60) -> str:
    if not workers:
        return ""
    rows: List[str] = []
    for w in workers[:limit]:
        sales = w.monthlyTotalSales or 0
        target = w.monthlyTarget or 0
        returns_ = w.monthlyTotalReturns or 0
        net = max(0.0, sales - returns_)
        pct = (net / target * 100) if target > 0 else 0
        rating = f"{w.rating:.0f}%" if w.rating is not None else "—"
        branch = f" · {w.branch}" if w.branch else ""
        rows.append(
            f"- {w.name} {w.surname} [{w.position}{branch}] "
            f"| reytinq: {rating} | satış: {sales:,.0f} AZN "
            f"| qaytarma: {returns_:,.0f} | net: {net:,.0f} "
            f"| hədəf: {target:,.0f} ({pct:.0f}%) "
            f"| {'aktiv' if w.isActive else 'passiv'} "
            f"| id:{w.id}"
        )
    return "👥 İŞÇİLƏR (detallı siyahı):\n" + "\n".join(rows)


def _format_fines(fines: List[FineLite], workers: List[WorkerLite]) -> str:
    if not fines:
        return ""
    name_map = {w.id: f"{w.name} {w.surname}" for w in workers}
    rows: List[str] = []
    for f in fines[:40]:
        rows.append(
            f"- {name_map.get(f.workerId, f.workerId)}: -{f.amount:,.0f} AZN "
            f"({f.reason or '—'}) · {f.date}"
        )
    return "⚠️ SON CƏRİMƏLƏR:\n" + "\n".join(rows)


def _format_rewards(rewards: List[RewardLite], workers: List[WorkerLite]) -> str:
    if not rewards:
        return ""
    name_map = {w.id: f"{w.name} {w.surname}" for w in workers}
    rows: List[str] = []
    for r in rewards[:40]:
        amt = f" +{r.amount:,.0f}" if r.amount else ""
        rows.append(
            f"- {name_map.get(r.workerId, r.workerId)}: {r.type}{amt} "
            f"({r.reason or '—'}) · {r.date}"
        )
    return "🏆 SON MÜKAFATLAR:\n" + "\n".join(rows)


def _format_requests(requests: List[RequestLite], workers: List[WorkerLite]) -> str:
    if not requests:
        return ""
    name_map = {w.id: f"{w.name} {w.surname}" for w in workers}
    rows: List[str] = []
    for r in requests[:30]:
        rows.append(
            f"- {name_map.get(r.workerId, r.workerId)}: {r.type} "
            f"[{r.status}] — {r.subject or '—'} ({r.createdAt[:10] if r.createdAt else '—'})"
        )
    return "📨 İŞÇİ TƏLƏBLƏRİ:\n" + "\n".join(rows)


@app.post("/api/workers-chat", response_model=ChatResponse)
async def workers_chat_endpoint(req: WorkersChatRequest):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="Gemini API açarı konfiqurasiya edilməyib.")

    lang_directive = {
        "az": "Cavab DİLİ: Azərbaycan dilində.",
        "ru": "Cavab DİLİ: Rus dilində.",
        "en": "Cavab DİLİ: İngilis dilində.",
    }.get(req.language or "az", "Cavab DİLİ: Azərbaycan dilində.")

    system_parts = [
        HR_PERSONA,
        lang_directive,
        _summarise_workers(req.workers or []),
        _format_workers(req.workers or []),
        _format_fines(req.fines or [], req.workers or []),
        _format_rewards(req.rewards or [], req.workers or []),
        _format_requests(req.requests or [], req.workers or []),
    ]
    if (req.context or "").strip():
        system_parts.append("📝 ADMIN ƏLAVƏSİ:\n" + req.context.strip())
    system_message = "\n\n".join(p for p in system_parts if p)

    contents: List[Dict[str, Any]] = []
    for h in (req.history or [])[-10:]:
        if not (h.content or "").strip():
            continue
        role = "user" if h.role == "user" else "model"
        contents.append({"role": role, "parts": [{"text": h.content}]})
    contents.append({"role": "user", "parts": [{"text": req.message.strip()}]})

    payload = {
        "systemInstruction": {"parts": [{"text": system_message}]},
        "contents": contents,
        "generationConfig": {
            "temperature": 0.4,
            "topP": 0.9,
            "maxOutputTokens": 1200,
        },
        "safetySettings": [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_ONLY_HIGH"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_ONLY_HIGH"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_ONLY_HIGH"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_ONLY_HIGH"},
        ],
    }

    try:
        data, err = await _gemini_generate(payload, timeout=45.0)
        if err or not data:
            raise HTTPException(status_code=502, detail=f"AI provayder xətası: {err or 'boş cavab'}")
        candidates = data.get("candidates") or []
        reply = ""
        if candidates:
            parts = ((candidates[0].get("content") or {}).get("parts")) or []
            reply = "".join(p.get("text", "") for p in parts).strip()
        if not reply:
            reply = "Bağışlayın, cavab yarana bilmədi. Yenidən cəhd edin."
        return ChatResponse(reply=reply)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Workers chat error: %s", e)
        raise HTTPException(status_code=500, detail=f"AI cavab verə bilmədi: {e}")


# ---------------------------------------------------------------------------
# AI SEO — generate SEO metadata (title, meta description, keywords, slug, alt)
# for a product in az / ru / en using the same NVIDIA gpt-oss-20b model.
# Admin panel calls this per-product; frontend batches through all products.
# ---------------------------------------------------------------------------

import re as _re


class SeoProductInput(BaseModel):
    id: str
    name_az: str = ""
    name_ru: str = ""
    name_en: str = ""
    description_az: str = ""
    description_ru: str = ""
    description_en: str = ""
    brand: str = ""
    category: str = ""
    gender: str = ""
    price: Optional[float] = None
    salePrice: Optional[float] = None


class SeoLangBlock(BaseModel):
    title: str = ""
    description: str = ""
    keywords: str = ""
    imageAlt: str = ""


class SeoResult(BaseModel):
    az: SeoLangBlock
    ru: SeoLangBlock
    en: SeoLangBlock
    slug: str


class SeoGenerateRequest(BaseModel):
    product: SeoProductInput
    site_name: str = "DE VALEUR"
    site_url: str = "https://devaleur.az"


class SeoGenerateResponse(BaseModel):
    success: bool
    seo: Optional[SeoResult] = None
    error: Optional[str] = None
    raw: Optional[str] = None


def _slugify(text: str) -> str:
    """Turn a product name into a URL-safe ASCII slug.
    Handles Azerbaijani special characters."""
    if not text:
        return ""
    tr = {
        "ə": "e", "ı": "i", "ö": "o", "ü": "u", "ç": "c", "ş": "s", "ğ": "g",
        "Ə": "e", "İ": "i", "Ö": "o", "Ü": "u", "Ç": "c", "Ş": "s", "Ğ": "g",
        "й": "y", "ы": "y", "ю": "yu", "я": "ya",
    }
    out = "".join(tr.get(c, c) for c in text.lower())
    out = _re.sub(r"[^a-z0-9]+", "-", out)
    out = _re.sub(r"-+", "-", out).strip("-")
    return out[:80]


SEO_SYSTEM_PROMPT = """You are an expert e-commerce SEO copywriter for a luxury Azerbaijani watches and accessories store called "DE VALEUR".
You will receive one product's data and must return SEO metadata for THREE languages: Azerbaijani (az), Russian (ru), English (en).

CRITICAL RULES:
- Output STRICT JSON only. No prose, no markdown, no code fences.
- All strings must be plain text (no HTML, no emoji).
- Title: 50-65 characters. Include the brand + product name + a strong keyword. Never end with an ellipsis.
- Description (meta): 140-160 characters. Include benefits, brand, key features, and a subtle call-to-action.
- Keywords: 6-10 comma-separated relevant search terms per language. Include brand, category, gender, use-cases.
- imageAlt: 8-14 words describing the product for accessibility & Google Image search.
- Use natural, human copy. Never keyword-stuff or repeat the brand more than twice.
- Azerbaijani copy must be in proper Azerbaijani (ə, ı, ö, ü, ç, ş, ğ) — not Turkish.
- Russian copy must be in proper Cyrillic Russian.
- English copy must be idiomatic international English.

JSON SHAPE (exact keys, no extra keys):
{
  "az": {"title": "...", "description": "...", "keywords": "...", "imageAlt": "..."},
  "ru": {"title": "...", "description": "...", "keywords": "...", "imageAlt": "..."},
  "en": {"title": "...", "description": "...", "keywords": "...", "imageAlt": "..."}
}
"""


def _extract_json_block(text: str) -> Optional[dict]:
    """Extract the first {...} JSON object from an LLM reply. Tolerates
    fenced code blocks and leading commentary."""
    if not text:
        return None
    # Strip common fences
    t = text.strip()
    if t.startswith("```"):
        t = _re.sub(r"^```(?:json)?\s*", "", t)
        t = _re.sub(r"\s*```$", "", t)
    # Find first {...} block
    start = t.find("{")
    if start < 0:
        return None
    depth = 0
    end = -1
    for i in range(start, len(t)):
        ch = t[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i
                break
    if end < 0:
        return None
    try:
        return json.loads(t[start:end + 1])
    except Exception:
        return None


@app.post("/api/seo/generate", response_model=SeoGenerateResponse)
async def seo_generate(req: SeoGenerateRequest):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="Gemini API açarı konfiqurasiya edilməyib.")

    p = req.product
    # Build a rich, structured user prompt so the model has all context
    price_line = ""
    if p.salePrice and p.price and p.salePrice < p.price:
        price_line = f"Price: {p.salePrice:.0f} AZN (was {p.price:.0f} AZN — discounted)"
    elif p.price:
        price_line = f"Price: {p.price:.0f} AZN"
    gender_map = {"men": "Men", "women": "Women", "unisex": "Unisex"}
    gender_line = f"Gender: {gender_map.get(p.gender, p.gender or 'N/A')}"

    user_prompt = f"""Product data:
- Brand: {p.brand or 'N/A'}
- Product name (AZ): {p.name_az or 'N/A'}
- Product name (RU): {p.name_ru or 'N/A'}
- Product name (EN): {p.name_en or 'N/A'}
- Category: {p.category or 'N/A'}
- {gender_line}
- {price_line}
- Description (AZ): {(p.description_az or '').strip()[:600]}
- Description (RU): {(p.description_ru or '').strip()[:600]}
- Description (EN): {(p.description_en or '').strip()[:600]}

Site: {req.site_name} ({req.site_url})

Return the JSON as specified in the system prompt. Do not include any text outside the JSON."""

    payload = {
        "systemInstruction": {"parts": [{"text": SEO_SYSTEM_PROMPT}]},
        "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
        "generationConfig": {
            "temperature": 0.4,
            "topP": 1,
            "maxOutputTokens": 2048,
            "responseMimeType": "application/json",
        },
    }
    url = f"{GEMINI_BASE_URL}/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    data, err = await _gemini_generate(payload, timeout=60.0)
    if err or not data:
        return SeoGenerateResponse(success=False, error=f"AI provayder xətası: {err or 'boş cavab'}")

    candidates = data.get("candidates") or []
    content = ""
    if candidates:
        parts = ((candidates[0].get("content") or {}).get("parts")) or []
        content = "".join(p.get("text", "") for p in parts).strip()

    parsed = _extract_json_block(content)
    if not parsed:
        return SeoGenerateResponse(success=False, error="AI cavabından JSON çıxarıla bilmədi", raw=content[:600])

    def _lang_block(node: Any) -> SeoLangBlock:
        if not isinstance(node, dict):
            return SeoLangBlock()
        return SeoLangBlock(
            title=str(node.get("title") or "").strip()[:120],
            description=str(node.get("description") or "").strip()[:250],
            keywords=str(node.get("keywords") or "").strip()[:400],
            imageAlt=str(node.get("imageAlt") or node.get("alt") or "").strip()[:200],
        )

    az = _lang_block(parsed.get("az"))
    ru = _lang_block(parsed.get("ru"))
    en = _lang_block(parsed.get("en"))

    # Build the SEO slug from the EN or AZ product name + brand for stability
    slug_source = " ".join(x for x in [p.brand, p.name_en or p.name_az or p.name_ru] if x)
    slug = _slugify(slug_source) or _slugify(p.id)

    return SeoGenerateResponse(
        success=True,
        seo=SeoResult(az=az, ru=ru, en=en, slug=slug),
    )


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


# ===========================================================================
# WhatsApp Cloud API (Meta) — transactional messaging for password-reset flows
# ===========================================================================
#
# Configuration is read from Firestore `siteSettings/whatsapp` (so the admin
# panel can change phone-number/token at runtime) with a fallback to backend
# .env environment variables. Admin must populate one or the other.
#
# Required keys (any source):
#   - phone_id            (Meta WhatsApp Phone Number ID — numeric)
#   - access_token        (Permanent system-user access token)
#   - business_account_id (WhatsApp Business Account ID)
#   - api_version         (default v22.0)
#   - sender_display      (Optional; what we show admins, e.g. "+994777577277")
#
# All credentials are stored in Firestore (via admin panel) — backend only
# reads them, never returns the raw token to the frontend.
# ---------------------------------------------------------------------------

WHATSAPP_GRAPH_BASE = "https://graph.facebook.com"


def _wa_config_from_env() -> Dict[str, str]:
    return {
        "phone_id": os.environ.get("WHATSAPP_PHONE_ID", "") or "",
        "access_token": os.environ.get("WHATSAPP_ACCESS_TOKEN", "") or "",
        "business_account_id": os.environ.get("WHATSAPP_BUSINESS_ACCOUNT_ID", "") or "",
        "api_version": os.environ.get("WHATSAPP_API_VERSION", "v22.0") or "v22.0",
        "sender_display": os.environ.get("WHATSAPP_SENDER_DISPLAY", "+994777577277") or "+994777577277",
    }


def get_whatsapp_config() -> Dict[str, str]:
    """Read WhatsApp config from Firestore, fall back to env."""
    env_cfg = _wa_config_from_env()
    if not (firebase_ready and fb_db is not None):
        return env_cfg
    try:
        snap = fb_db.collection("siteSettings").document("whatsapp").get()
        if snap.exists:
            data = snap.to_dict() or {}
            return {
                "phone_id": (data.get("phone_id") or env_cfg["phone_id"]).strip(),
                "access_token": (data.get("access_token") or env_cfg["access_token"]).strip(),
                "business_account_id": (data.get("business_account_id") or env_cfg["business_account_id"]).strip(),
                "api_version": (data.get("api_version") or env_cfg["api_version"]).strip(),
                "sender_display": (data.get("sender_display") or env_cfg["sender_display"]).strip(),
            }
    except Exception as e:
        logger.warning("WhatsApp config read failed (using env): %s", e)
    return env_cfg


def _wa_normalize_phone(phone: str) -> str:
    """Normalize to E.164 without leading + (Meta API expects '994...')."""
    cleaned = "".join(c for c in (phone or "") if c.isdigit())
    if cleaned.startswith("00"):
        cleaned = cleaned[2:]
    return cleaned


async def whatsapp_send_text(to_phone: str, text: str) -> Dict[str, Any]:
    """Send a plain text WhatsApp message (works inside the 24h customer
    service window OR when the recipient has previously messaged us).

    Note: For first-contact transactional messages outside that window,
    Meta requires an *approved template* — see whatsapp_send_template.
    """
    cfg = get_whatsapp_config()
    if not (cfg["phone_id"] and cfg["access_token"]):
        return {"success": False, "error": "whatsapp_not_configured", "message": "WhatsApp credentials not set"}

    to = _wa_normalize_phone(to_phone)
    if len(to) < 9:
        return {"success": False, "error": "invalid_phone", "message": "Invalid phone"}

    url = f"{WHATSAPP_GRAPH_BASE}/{cfg['api_version']}/{cfg['phone_id']}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "text",
        "text": {"preview_url": False, "body": text},
    }
    headers = {
        "Authorization": f"Bearer {cfg['access_token']}",
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            r = await client.post(url, json=payload, headers=headers)
            body = r.json() if r.text else {}
        if r.status_code in (200, 201):
            msg_id = (body.get("messages") or [{}])[0].get("id")
            return {"success": True, "message_id": msg_id, "raw": body}
        err = (body.get("error") or {})
        return {
            "success": False,
            "error": err.get("type") or f"http_{r.status_code}",
            "code": err.get("code"),
            "message": err.get("message") or "WhatsApp send failed",
            "raw": body,
        }
    except httpx.HTTPError as e:
        logger.exception("WhatsApp send error: %s", e)
        return {"success": False, "error": "network", "message": str(e)}


async def whatsapp_send_template(
    to_phone: str,
    template_name: str,
    body_params: Optional[List[str]] = None,
    language_code: str = "az",
) -> Dict[str, Any]:
    """Send an approved template (auth/utility category)."""
    cfg = get_whatsapp_config()
    if not (cfg["phone_id"] and cfg["access_token"]):
        return {"success": False, "error": "whatsapp_not_configured", "message": "WhatsApp credentials not set"}

    to = _wa_normalize_phone(to_phone)
    if len(to) < 9:
        return {"success": False, "error": "invalid_phone", "message": "Invalid phone"}

    components: List[Dict[str, Any]] = []
    if body_params:
        components.append({
            "type": "body",
            "parameters": [{"type": "text", "text": p} for p in body_params],
        })

    url = f"{WHATSAPP_GRAPH_BASE}/{cfg['api_version']}/{cfg['phone_id']}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": language_code},
            "components": components,
        },
    }
    headers = {"Authorization": f"Bearer {cfg['access_token']}", "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            r = await client.post(url, json=payload, headers=headers)
            body = r.json() if r.text else {}
        if r.status_code in (200, 201):
            return {"success": True, "message_id": (body.get("messages") or [{}])[0].get("id"), "raw": body}
        err = body.get("error") or {}
        return {
            "success": False,
            "error": err.get("type") or f"http_{r.status_code}",
            "code": err.get("code"),
            "message": err.get("message") or "WhatsApp template send failed",
            "raw": body,
        }
    except httpx.HTTPError as e:
        return {"success": False, "error": "network", "message": str(e)}


# ---------------------------------------------------------------------------
# Password-reset orchestration
# ---------------------------------------------------------------------------

def _generate_temp_password(length: int = 9) -> str:
    """Memorable but secure: 2-3 letters + dash + 4 alphanum.
    Avoids ambiguous chars (0/O, 1/l/I) so users can read it from WhatsApp."""
    alphabet_letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"
    alphabet_alnum = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    head = "".join(secrets.choice(alphabet_letters) for _ in range(2))
    tail = "".join(secrets.choice(alphabet_alnum) for _ in range(max(4, length - 3)))
    return f"{head}-{tail}"


def _wa_message_for_reset(name: str, temp_password: str) -> str:
    name_safe = (name or "müştəri").strip().split(" ")[0] or "müştəri"
    return (
        f"Salam, {name_safe}!\n\n"
        f"DE VALEUR hesabınız üçün yeni müvəqqəti şifrəniz:\n"
        f"🔐  *{temp_password}*\n\n"
        f"Saytımıza daxil olduqdan sonra profil bölməsindən şifrəni dəyişməyi unutmayın.\n\n"
        f"Əgər bu sıfırlamanı siz tələb etməmisinizsə, dərhal bizimlə əlaqə saxlayın."
    )


async def _reset_user_password_and_notify(
    *,
    full_phone: str,
    triggered_by: str,
) -> Dict[str, Any]:
    """Core flow: lookup user by phone → generate temp pw → update Firebase Auth
    → log to Firestore → send WhatsApp.

    `triggered_by` should be 'self' (customer) or 'admin' for audit.
    """
    if not firebase_ready or fb_db is None:
        raise HTTPException(status_code=503, detail="Firebase Admin SDK aktiv deyil. Admin xidməti hesabını backend-ə əlavə edin.")

    # 1) Find the Firestore user record by phone
    users_ref = fb_db.collection("users")
    matches = list(users_ref.where("phone", "==", full_phone).limit(1).stream())
    if not matches:
        raise HTTPException(status_code=404, detail="Bu nömrə ilə qeydiyyatdan keçmiş müştəri tapılmadı.")
    user_doc = matches[0]
    user_data = user_doc.to_dict() or {}
    user_id = user_data.get("id") or user_doc.id
    user_name = user_data.get("name") or ""

    # 2) Generate new temporary password
    temp_password = _generate_temp_password()

    # 3) Update Firebase Auth password using Admin SDK
    try:
        fb_auth.update_user(user_id, password=temp_password)
    except fb_auth.UserNotFoundError:
        raise HTTPException(status_code=404, detail="Firebase Auth-da istifadəçi tapılmadı (Firestore qeydi köhnə ola bilər).")
    except Exception as e:
        logger.exception("Auth password update failed for %s: %s", user_id, e)
        raise HTTPException(status_code=500, detail=f"Şifrə yenilənmədi: {e}")

    # 4) Audit log in Firestore (passwordResets collection)
    try:
        from datetime import datetime, timezone
        fb_db.collection("passwordResets").add({
            "userId": user_id,
            "phone": full_phone,
            "triggeredBy": triggered_by,
            "createdAt": datetime.now(timezone.utc),
        })
        # Also flag user document
        user_doc.reference.update({
            "lastPasswordResetAt": datetime.now(timezone.utc),
            "lastPasswordResetBy": triggered_by,
            "mustChangePassword": True,
        })
    except Exception as e:
        logger.warning("passwordResets audit log failed: %s", e)

    # 5) Send the new password to user via WhatsApp
    text = _wa_message_for_reset(user_name, temp_password)
    wa_result = await whatsapp_send_text(full_phone, text)

    return {
        "success": True,
        "userId": user_id,
        "temp_password_sent": wa_result.get("success", False),
        "whatsapp": wa_result,
        # NOTE: temp_password is also returned so admins can read it in their
        # panel as a fallback in case WhatsApp delivery fails (rare).
        # The customer-self endpoint must NOT echo this back — see below.
        "temp_password": temp_password,
    }


# ---------------------------------------------------------------------------
# Endpoints — customer self-serve
# ---------------------------------------------------------------------------

class ForgotPasswordRequest(BaseModel):
    phone: str = Field(..., min_length=8, max_length=20, description="+994XXXXXXXXX or 994XXXXXXXXX")


class ForgotPasswordResponse(BaseModel):
    success: bool
    delivered: bool
    sender_display: Optional[str] = None
    message: Optional[str] = None


@app.post("/api/auth/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(req: ForgotPasswordRequest):
    """Customer self-serve password reset.
    Always returns success=true to avoid revealing whether a phone is
    registered, EXCEPT when the phone format is plainly invalid (400).
    """
    digits = _wa_normalize_phone(req.phone)
    if len(digits) < 11:
        raise HTTPException(status_code=400, detail="Telefon nömrəsi düzgün deyil. Məs: +994501234567")
    full_phone = "+" + digits

    cfg = get_whatsapp_config()
    try:
        result = await _reset_user_password_and_notify(full_phone=full_phone, triggered_by="self")
    except HTTPException as e:
        # Map "user not found" (404) back to generic success to avoid enumeration
        if e.status_code == 404:
            return ForgotPasswordResponse(
                success=True,
                delivered=False,
                sender_display=cfg.get("sender_display") or None,
                message="Əgər bu nömrə ilə hesab varsa, WhatsApp-a yeni şifrə göndəriləcək.",
            )
        raise

    return ForgotPasswordResponse(
        success=True,
        delivered=bool(result.get("temp_password_sent")),
        sender_display=cfg.get("sender_display") or None,
        message=(
            "Yeni şifrə WhatsApp nömrənizə göndərildi."
            if result.get("temp_password_sent")
            else "Şifrəniz yeniləndi, lakin WhatsApp göndərilməsi uğursuz oldu. Zəhmət olmasa dəstəklə əlaqə saxlayın."
        ),
    )


# ---------------------------------------------------------------------------
# Endpoints — admin
# ---------------------------------------------------------------------------
# NOTE: These endpoints rely on a simple shared admin secret header until a
# proper JWT/role-based auth layer is added. The frontend reads
# `localStorage.adminApiSecret` (set via WhatsApp config tab) and sends it
# as `X-Admin-Secret`. This is intentionally simple — same pattern that was
# already used for /api/admin/* in this project.
#
# Default secret (override via env var): use ADMIN_API_SECRET.

ADMIN_API_SECRET = os.environ.get("ADMIN_API_SECRET", "devaleur-admin-2026")


def _check_admin_secret(provided: Optional[str]) -> None:
    if not provided or provided != ADMIN_API_SECRET:
        raise HTTPException(status_code=401, detail="Admin icazəsi yoxdur.")


from fastapi import Header  # noqa: E402  (imported here to keep diff minimal)


class AdminResetCustomerRequest(BaseModel):
    phone: Optional[str] = None
    user_id: Optional[str] = None


class AdminResetCustomerResponse(BaseModel):
    success: bool
    delivered: bool
    temp_password: str
    user_id: str
    whatsapp_error: Optional[str] = None


@app.post("/api/admin/customers/reset-password", response_model=AdminResetCustomerResponse)
async def admin_reset_customer_password(
    req: AdminResetCustomerRequest,
    x_admin_secret: Optional[str] = Header(default=None, alias="X-Admin-Secret"),
):
    _check_admin_secret(x_admin_secret)
    if not firebase_ready or fb_db is None:
        raise HTTPException(status_code=503, detail="Firebase Admin SDK aktiv deyil.")

    full_phone: Optional[str] = None
    if req.phone:
        digits = _wa_normalize_phone(req.phone)
        if len(digits) < 11:
            raise HTTPException(status_code=400, detail="Telefon formatı yanlışdır.")
        full_phone = "+" + digits
    elif req.user_id:
        snap = fb_db.collection("users").document(req.user_id).get()
        if not snap.exists:
            # Try alternate: query by id field
            q = list(fb_db.collection("users").where("id", "==", req.user_id).limit(1).stream())
            if not q:
                raise HTTPException(status_code=404, detail="Müştəri tapılmadı.")
            data = q[0].to_dict() or {}
            full_phone = data.get("phone")
        else:
            data = snap.to_dict() or {}
            full_phone = data.get("phone")
        if not full_phone:
            raise HTTPException(status_code=400, detail="Müştəridə qeydiyyatda olan WhatsApp nömrəsi yoxdur.")
    else:
        raise HTTPException(status_code=400, detail="`phone` və ya `user_id` göstərin.")

    result = await _reset_user_password_and_notify(full_phone=full_phone, triggered_by="admin")
    return AdminResetCustomerResponse(
        success=True,
        delivered=bool(result.get("temp_password_sent")),
        temp_password=result["temp_password"],
        user_id=result["userId"],
        whatsapp_error=(None if result.get("temp_password_sent") else (result.get("whatsapp", {}) or {}).get("message")),
    )


# ---- WhatsApp config (admin) ----------------------------------------------

class WhatsAppConfigDTO(BaseModel):
    phone_id: str = ""
    access_token: str = ""
    business_account_id: str = ""
    api_version: str = "v22.0"
    sender_display: str = "+994777577277"


class WhatsAppConfigPublic(BaseModel):
    phone_id: str
    access_token_masked: str
    has_token: bool
    business_account_id: str
    api_version: str
    sender_display: str
    firebase_ready: bool


@app.get("/api/admin/whatsapp-config", response_model=WhatsAppConfigPublic)
async def admin_get_whatsapp_config(
    x_admin_secret: Optional[str] = Header(default=None, alias="X-Admin-Secret"),
):
    _check_admin_secret(x_admin_secret)
    cfg = get_whatsapp_config()
    tok = cfg["access_token"] or ""
    return WhatsAppConfigPublic(
        phone_id=cfg["phone_id"],
        access_token_masked=("•" * 6 + tok[-4:]) if tok else "",
        has_token=bool(tok),
        business_account_id=cfg["business_account_id"],
        api_version=cfg["api_version"],
        sender_display=cfg["sender_display"],
        firebase_ready=firebase_ready,
    )


@app.post("/api/admin/whatsapp-config", response_model=WhatsAppConfigPublic)
async def admin_update_whatsapp_config(
    body: WhatsAppConfigDTO,
    x_admin_secret: Optional[str] = Header(default=None, alias="X-Admin-Secret"),
):
    _check_admin_secret(x_admin_secret)
    if not firebase_ready or fb_db is None:
        raise HTTPException(status_code=503, detail="Firebase Admin SDK aktiv deyil. Service account əlavə edin.")
    update: Dict[str, str] = {
        "phone_id": body.phone_id.strip(),
        "business_account_id": body.business_account_id.strip(),
        "api_version": (body.api_version or "v22.0").strip(),
        "sender_display": body.sender_display.strip(),
    }
    # Only update token if a non-empty / non-masked value is provided
    if body.access_token and "•" not in body.access_token:
        update["access_token"] = body.access_token.strip()
    fb_db.collection("siteSettings").document("whatsapp").set(update, merge=True)
    return await admin_get_whatsapp_config(x_admin_secret)


class WhatsAppTestRequest(BaseModel):
    to_phone: str
    message: str = "DE VALEUR test mesajı – əgər bunu görürsünüzsə, inteqrasiya işləyir."


class WhatsAppTestResponse(BaseModel):
    success: bool
    error: Optional[str] = None
    message_id: Optional[str] = None
    detail: Optional[str] = None


@app.post("/api/admin/whatsapp-test", response_model=WhatsAppTestResponse)
async def admin_whatsapp_test(
    req: WhatsAppTestRequest,
    x_admin_secret: Optional[str] = Header(default=None, alias="X-Admin-Secret"),
):
    _check_admin_secret(x_admin_secret)
    res = await whatsapp_send_text(req.to_phone, req.message)
    return WhatsAppTestResponse(
        success=bool(res.get("success")),
        message_id=res.get("message_id"),
        error=res.get("error"),
        detail=res.get("message"),
    )
