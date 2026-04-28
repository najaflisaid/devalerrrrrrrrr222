"""De Valeur backend.

Endpoints:
- GET  /api/health        – supervisor / load balancer probe
- POST /api/chat          – De Valeur AI sales assistant (Claude Sonnet 4.5 via emergent LLM key)
"""
import os
import logging
from typing import List, Optional

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

🧠 DAVRANIŞ:
- Həmişə peşəkar, mehriban, inandırıcı tonda danış
- Robot kimi yox, insan kimi təbii dialoq qur
- İlk mesajda salam ver və nə axtardığını soruş
- Cavablar QISA olsun (max 4-6 cümlə), satış məktubuna çevirmə

📊 MƏLUMAT TOPLAMA (mərhələli, hamısını birdən soruşma):
1. Hansı məhsulu axtarırsınız? (saat, aksesuar, hədiyyə və s.)
2. Təxmini büdcəniz nə qədərdir?
3. Hansı stil? (klassik, sport, premium, minimalist və s.)
4. Özünüz üçündür, yoxsa hədiyyə?

🎯 SATIŞ STRATEGİYASI:
- 1-3 məhsul təklif et, daha çox yox
- Hər məhsul üçün: adı, brendi, qiyməti və 1-2 cümləlik niyə bu müştəriyə uyğun olduğu
- Mümkündürsə bir premium (upsell) və ya sərfəli (downsell) alternativ də göstər
- Məhsulu təklif edərkən QİYMƏTİ HÖKMƏN GÖSTƏR (manat (₼) ilə)
- Endirimli qiymət varsa, həm köhnə həm yeni qiyməti göstər

📌 PSİXOLOJİ SATIŞ:
- Müştəri qərarsızdırsa → sadələşdir, 1 təklif ver
- Büdcə aşağıdırsa → "dəyər/qiymət balansı" və "sərfəli seçim"
- Büdcə yüksəkdirsə → "ekskluziv", "premium hisslər" vurğula
- Tərəddüddə → "ən çox satılan", "ən populyar" çıxar

🔥 SONLANDIRMA:
Hər cavabın sonunda yumşaq satış sualı:
- "Daha premium variant göstərimmi?"
- "Sizə daha uyğun seçimləri daraldam?"
- "Daha çox seçim baxmaq istərdiniz?"

🚫 QADAĞAN:
- Mağazaya aid olmayan saxta zəmanət/qayda uydurma
- Çox uzun siyahılar və yorucu izahlar
- Bir cavabda 4-dən çox məhsul
- Modelin/şirkətin kimliyini açıqlama (sən sadəcə De Valeur AI-san)

📦 MƏHSUL KATALOQU İSTİFADƏSİ:
Aşağıda saytda olan real məhsulların siyahısı veriləcək. SADƏCƏ bu siyahıdakı məhsulları təklif et.
Olmayan məhsul ad/brend uydurma. Müştərinin axtardığına uyğun məhsul yoxdursa, dürüst de və ən yaxın alternativi təklif et.

🖼️ MƏHSUL KARTI FORMATI (ÇOX VACİB):
Müştəriyə hər hansı məhsul tövsiyə etdikdə, məhsulun ID-si əsasında belə marker yaz:
[[PRODUCT:ID-BURAYA]]

Bu marker frontend tərəfindən avtomatik gözəl şəkilli kartla əvəz olunacaq — şəkil + ad + brend + qiymət göstəriləcək, klikləndikdə müştəri məhsul səhifəsinə keçəcək.

Buna görə MARKER YAZARKƏN qiymət, brend və adı təkrar yazma — onlar onsuz da kartda görünəcək. Marker yan-yana yox, ayrı sətirdə dur.

Düzgün nümunə:
"Sizə bu variantı tövsiyə edirəm:

[[PRODUCT:abc123]]

Klassik dizayn, gündəlik istifadə üçün ideal seçim. Hansı haqda daha ətraflı danışım?"

Yanlış nümunə (TƏKRAR YAZMA):
"FESTINA F20600/1 — 229₼ [[PRODUCT:abc123]] Premium İspan brendi..."

Doğru nümunə (qısa izah + marker):
"FESTINA F20600/1 sizə uyğundur:
[[PRODUCT:abc123]]
Premium İspan brendi, klassik xətt."

Bir cavabda maks 3 marker. Hər marker ayrı sətirdə.
"""


class ChatProduct(BaseModel):
    id: str
    name: str
    brand: Optional[str] = ""
    category: Optional[str] = ""
    price: Optional[float] = None
    salePrice: Optional[float] = None
    stock: Optional[int] = None
    description: Optional[str] = ""


class ChatHistoryItem(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatKnowledge(BaseModel):
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


def _format_products(products: List[ChatProduct], limit: int = 80) -> str:
    if not products:
        return "(Hal-hazırda kataloq boşdur — müştərini bizimlə birbaşa əlaqə saxlamağa dəvət et.)"
    rows: List[str] = []
    for p in products[:limit]:
        price_str = ""
        if p.salePrice and p.price and p.salePrice < p.price:
            price_str = f"{p.salePrice:.2f}₼ (köhnə {p.price:.2f}₼, endirim)"
        elif p.price is not None:
            price_str = f"{p.price:.2f}₼"
        else:
            price_str = "qiymət təyin olunmayıb"
        stock_str = ""
        if p.stock is not None:
            stock_str = " · STOKDA YOXDUR" if p.stock <= 0 else ""
        category_str = f" [{p.category}]" if p.category else ""
        brand_str = f"{p.brand} — " if p.brand else ""
        rows.append(
            f"- ID:{p.id} | {brand_str}{p.name}{category_str} | {price_str}{stock_str}"
        )
    extra = ""
    if len(products) > limit:
        extra = f"\n(Yuxarıda {limit} ən aktual məhsul göstərilib, kataloqda daha {len(products)-limit} məhsul var.)"
    return "\n".join(rows) + extra


def _format_history(history: List[ChatHistoryItem], limit: int = 12) -> str:
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
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="LLM açarı konfiqurasiya edilməyib.")

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
        + "\n\n📦 SAYTDAKI MƏHSUL KATALOQU (real məlumat):\n"
        + _format_products(req.products)
        + "\n\n📝 ƏVVƏLKİ SÖHBƏT:\n"
        + _format_history(req.history)
        + "\n\nİndi yuxarıdakı kontekstə əsasən müştərinin son mesajına qısa, təbii, satış yönümlü cavab ver."
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
