import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X, Send, Loader2, Sparkles, Trash2, ShoppingBag, Check } from 'lucide-react';
import { productService } from '../services/productService';
import { getAiKnowledge, subscribeChatEnabled, subscribeGreetBubbleText, type AiKnowledge } from '../services/aiKnowledgeService';
import { sendChatMessage } from '../services/aiChatService';
import { useCart } from '../context/CartContext';
import type { Product } from '../types';

const SESSION_KEY = 'devaleur_ai_session';
const HISTORY_KEY = 'devaleur_ai_history';
const MAX_HISTORY = 24;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
}

const newSessionId = () => {
  if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) {
    return (crypto as any).randomUUID();
  }
  return 'ses-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
};

const compactProducts = (products: Product[]) => {
  // Filter out coming-soon / disabled, then rank for AI:
  // 1) in-stock + bestseller, 2) in-stock, 3) out-of-stock
  const visible = products.filter((p) => p.isEnabled !== false && !p.comingSoon);
  const score = (p: Product) => {
    const inStock = (p.stock ?? 0) > 0 ? 2 : 0;
    const bs = p.isBestseller ? 1 : 0;
    return inStock + bs;
  };
  const ranked = [...visible].sort((a, b) => score(b) - score(a));
  // Send ALL products so AI can match any customer request.
  // Top 60 ranked products get a short description; the rest are compact rows.
  return ranked.map((p, idx) => {
    const desc = p.description?.az || p.description?.en || p.description?.ru || '';
    return {
      id: p.id,
      name: p.name?.az || p.name?.en || p.name?.ru || '',
      brand: p.brand || '',
      category: p.category || '',
      gender: p.gender || '',
      price: typeof p.price === 'number' ? p.price : null,
      salePrice: typeof p.salePrice === 'number' ? p.salePrice : null,
      stock: typeof p.stock === 'number' ? p.stock : null,
      isBestseller: !!p.isBestseller,
      // Only include description for top 60 ranked products to keep prompt size reasonable
      description: idx < 60 ? desc.slice(0, 180) : '',
    };
  });
};

const renderInline = (text: string) => {
  // Simple **bold** highlighter for AI messages
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return (
        <strong key={i} className="font-semibold text-gray-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
};

interface ProductCardProps {
  product: Product;
  lang: 'az' | 'ru' | 'en';
  onClick: () => void;
  onAddToCart?: (product: Product) => void;
}

const ProductMiniCard: React.FC<ProductCardProps> = ({ product, lang, onClick, onAddToCart }) => {
  const [added, setAdded] = useState(false);
  const name = product.name?.[lang] || product.name?.en || product.name?.az || '';
  const price = product.salePrice || product.price;
  const original = product.salePrice && product.price && product.salePrice < product.price ? product.price : null;
  const img = product.images?.[0];
  const inStock = (product.stock ?? 0) > 0 && product.isEnabled !== false && !product.comingSoon;

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onAddToCart || !inStock || added) return;
    onAddToCart(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="my-2 w-full bg-white border border-gray-200 rounded-xl hover:border-gray-900 hover:shadow-md transition-all overflow-hidden" data-testid={`ai-product-card-${product.id}`}>
      <button
        type="button"
        onClick={onClick}
        className="group w-full flex items-center gap-3 p-2.5 text-left"
      >
        <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 border border-gray-100 flex-shrink-0">
          {img ? (
            <img
              src={img}
              alt={name}
              loading="lazy"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400">N/A</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          {product.brand && (
            <p className="text-[10px] uppercase tracking-wide text-amber-600 font-semibold truncate">
              {product.brand}
            </p>
          )}
          <p className="text-[13px] font-medium text-gray-900 leading-tight line-clamp-2">{name}</p>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            {original ? (
              <>
                <span className="text-[11px] text-gray-400 line-through">{original.toFixed(2)} AZN</span>
                <span className="text-sm font-bold text-red-500">{price.toFixed(2)} AZN</span>
              </>
            ) : (
              <span className="text-sm font-bold text-gray-900">{price?.toFixed(2)} AZN</span>
            )}
          </div>
        </div>
      </button>
      {/* Səbətə əlavə et və Bax düymələri */}
      <div className="flex items-stretch border-t border-gray-100">
        <button
          type="button"
          onClick={handleAdd}
          disabled={!inStock || added}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
            added
              ? 'bg-emerald-50 text-emerald-700'
              : inStock
              ? 'bg-gray-900 text-white hover:bg-black'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
          data-testid={`ai-product-add-cart-${product.id}`}
        >
          {added ? (
            <>
              <Check className="h-3.5 w-3.5" /> Əlavə olundu
            </>
          ) : inStock ? (
            <>
              <ShoppingBag className="h-3.5 w-3.5" /> Səbətə əlavə et
            </>
          ) : (
            <>Bitdi</>
          )}
        </button>
        <button
          type="button"
          onClick={onClick}
          className="px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 border-l border-gray-100"
          data-testid={`ai-product-view-${product.id}`}
        >
          Bax →
        </button>
      </div>
    </div>
  );
};

const PRODUCT_MARKER_RE = /\[\[PRODUCT:([^\]\s]+)\]\]/g;

interface AssistantContentProps {
  text: string;
  productMap: Record<string, Product>;
  setProductMap: React.Dispatch<React.SetStateAction<Record<string, Product>>>;
  lang: 'az' | 'ru' | 'en';
  onProductClick: (id: string) => void;
  onAddToCart: (product: Product) => void;
}

// Resolve a marker id to an actual product. Tries:
// 1) exact ID match
// 2) case-insensitive ID match
// 3) prefix/contains ID match (truncated)
// 4) match by product name field (AI sometimes returns model name instead of ID)
const resolveProduct = (rawId: string, productMap: Record<string, Product>): Product | null => {
  if (productMap[rawId]) return productMap[rawId];
  const lower = rawId.toLowerCase();
  const products = Object.values(productMap);
  // Case-insensitive ID match
  const ci = products.find((p) => p.id.toLowerCase() === lower);
  if (ci) return ci;
  // Match by product name (AI sometimes uses model number e.g. "F20694/6")
  const byName = products.find((p) => {
    const az = (p.name?.az || '').toLowerCase();
    const en = (p.name?.en || '').toLowerCase();
    const ru = (p.name?.ru || '').toLowerCase();
    return az === lower || en === lower || ru === lower;
  });
  if (byName) return byName;
  // Partial name match
  if (rawId.length >= 4) {
    const partial = products.find((p) => {
      const az = (p.name?.az || '').toLowerCase();
      const en = (p.name?.en || '').toLowerCase();
      return az.includes(lower) || en.includes(lower) || lower.includes(az) || lower.includes(en);
    });
    if (partial) return partial;
  }
  // Prefix / contains ID match
  if (rawId.length >= 6) {
    const prefix = products.find((p) => p.id.startsWith(rawId) || rawId.startsWith(p.id));
    if (prefix) return prefix;
    const contains = products.find((p) => p.id.includes(rawId) || rawId.includes(p.id));
    if (contains) return contains;
  }
  return null;
};

const LazyProductCard: React.FC<{
  productId: string;
  setProductMap: React.Dispatch<React.SetStateAction<Record<string, Product>>>;
  lang: 'az' | 'ru' | 'en';
  onClick: () => void;
  onAddToCart: (product: Product) => void;
}> = ({ productId, setProductMap, lang, onClick, onAddToCart }) => {
  const [product, setProduct] = useState<Product | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    productService
      .getById(productId)
      .then((p) => {
        if (cancelled) return;
        if (p) {
          setProduct(p);
          setProductMap((prev) => (prev[productId] ? prev : { ...prev, [productId]: p }));
        } else {
          setFailed(true);
        }
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [productId, setProductMap]);
  if (failed) {
    return (
      <button
        onClick={onClick}
        className="my-2 inline-flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs text-gray-700"
      >
        Məhsula bax →
      </button>
    );
  }
  if (!product) {
    return (
      <div className="my-2 w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-3 animate-pulse">
        <div className="w-14 h-14 rounded-lg bg-gray-200" />
        <div className="flex-1 space-y-1.5">
          <div className="h-2 bg-gray-200 rounded w-1/3" />
          <div className="h-3 bg-gray-200 rounded w-2/3" />
          <div className="h-3 bg-gray-200 rounded w-1/4" />
        </div>
      </div>
    );
  }
  return <ProductMiniCard product={product} lang={lang} onClick={onClick} onAddToCart={onAddToCart} />;
};

const AssistantContent: React.FC<AssistantContentProps> = ({ text, productMap, setProductMap, lang, onProductClick, onAddToCart }) => {
  // Split text on [[PRODUCT:id]] markers and render text + cards
  const segments: Array<{ kind: 'text'; value: string } | { kind: 'product'; id: string }> = [];
  let lastIndex = 0;
  for (const match of text.matchAll(PRODUCT_MARKER_RE)) {
    const idx = match.index ?? 0;
    if (idx > lastIndex) {
      segments.push({ kind: 'text', value: text.slice(lastIndex, idx) });
    }
    segments.push({ kind: 'product', id: match[1] });
    lastIndex = idx + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ kind: 'text', value: text.slice(lastIndex) });
  }
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.kind === 'text') {
          if (!seg.value.trim()) return null;
          return (
            <div key={i} className="whitespace-pre-wrap break-words">
              {renderInline(seg.value)}
            </div>
          );
        }
        const p = resolveProduct(seg.id, productMap);
        if (p) {
          return (
            <ProductMiniCard
              key={i}
              product={p}
              lang={lang}
              onClick={() => onProductClick(p.id)}
              onAddToCart={onAddToCart}
            />
          );
        }
        // Lazy-fetch the product directly by id
        return (
          <LazyProductCard
            key={i}
            productId={seg.id}
            setProductMap={setProductMap}
            lang={lang}
            onClick={() => onProductClick(seg.id)}
            onAddToCart={onAddToCart}
          />
        );
      })}
    </>
  );
};

const DEVALEUR_LOGO = 'https://i.hizliresim.com/tmu65g6.png';

const AiChatWidget: React.FC = () => {
  const { i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [productMap, setProductMap] = useState<Record<string, Product>>({});
  // Salamlama "tooltip" üçün state — sayta girdikdən 30 saniyə sonra
  // animasiya ilə görünür, 1 dəqiqə qalır, sonra avtomatik gizlənir.
  // Mətn admin paneldən (AI Bilik Bazası) dinamik gəlir; boş olsa
  // bubble heç vaxt göstərilmir.
  const [greetBubbleText, setGreetBubbleText] = useState<string>('');
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [bubbleClosing, setBubbleClosing] = useState(false);
  const [bubbleDismissed, setBubbleDismissed] = useState(false);
  const productsRef = useRef<Product[]>([]);
  const knowledgeRef = useRef<AiKnowledge | null>(null);
  const sessionIdRef = useRef<string>('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const lang = (i18n.language || 'az') as 'az' | 'ru' | 'en';

  const handleProductClick = (productId: string) => {
    setOpen(false);
    navigate(`/product/${productId}`);
  };

  // Bot mesajından məhsul kartından səbətə əlavə etmə (bot-un öz-özünə əlavə edə bilməsi)
  const handleAddToCart = (product: Product) => {
    addToCart(product, 1);
  };

  // Hide on admin / b2b-login / workers / payment routes,
  // OR when admin has globally disabled the chat from the AI Knowledge tab.
  const hidden = useMemo(() => {
    const p = location.pathname;
    if (!chatEnabled) return true;
    return (
      p.startsWith('/admin') ||
      p.startsWith('/workers') ||
      p.startsWith('/b2b-login') ||
      p.startsWith('/admin-login') ||
      p.startsWith('/b2b-request') ||
      p.startsWith('/payment')
    );
  }, [location.pathname, chatEnabled]);

  // Live-subscribe to the chat-visibility flag. When admin toggles it
  // off, every customer sees the widget disappear within ~1s.
  useEffect(() => {
    const unsub = subscribeChatEnabled((flag) => {
      setChatEnabled(flag);
      if (!flag) setOpen(false);
    });
    return () => unsub();
  }, []);

  // Listen for the external "open chat" event (dispatched from the header's
  // "Onlayn dəstək" badge, footer CTAs, etc.).
  useEffect(() => {
    const handler = () => {
      setBubbleVisible(false);
      setBubbleDismissed(true);
      setOpen(true);
    };
    window.addEventListener('dv:open-chat', handler);
    return () => window.removeEventListener('dv:open-chat', handler);
  }, []);

  // Init: load session id + history from localStorage (safe-wrapped for Safari private mode)
  useEffect(() => {
    let sid: string | null = null;
    try {
      sid = localStorage.getItem(SESSION_KEY);
      if (!sid) {
        sid = newSessionId();
        localStorage.setItem(SESSION_KEY, sid);
      }
    } catch {
      // Safari private mode / storage disabled → use in-memory sessionId
      sid = newSessionId();
    }
    sessionIdRef.current = sid!;
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setMessages(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  // Persist history
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-MAX_HISTORY)));
    } catch {
      /* ignore */
    }
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open, busy]);

  // Lazy load products + AI knowledge on first open
  useEffect(() => {
    if (open && !productsLoaded) {
      Promise.all([
        productService.getAll().catch(() => [] as Product[]),
        getAiKnowledge().catch(() => null),
      ]).then(([list, knowledge]) => {
        productsRef.current = list;
        knowledgeRef.current = knowledge;
        const m: Record<string, Product> = {};
        list.forEach((p) => {
          m[p.id] = p;
        });
        setProductMap(m);
        setProductsLoaded(true);
      });
    }
  }, [open, productsLoaded]);

  // Safe storage helpers — Safari private mode, cookies-disabled scenarios
  const safeSessionGet = (k: string): string | null => {
    try { return sessionStorage.getItem(k); } catch { return null; }
  };
  const safeSessionSet = (k: string, v: string) => {
    try { sessionStorage.setItem(k, v); } catch { /* ignore */ }
  };

  // Live-subscribe to the greeting-bubble text (set in admin > AI Knowledge).
  useEffect(() => {
    const unsub = subscribeGreetBubbleText((txt) => setGreetBubbleText(txt || ''));
    return () => unsub();
  }, []);

  // Bubble lifecycle: 30s after the visit it fades in, stays for 60s,
  // then fades out — only once per session.
  useEffect(() => {
    if (hidden || open) return;
    if (bubbleDismissed) return;
    if (!greetBubbleText.trim()) return;
    if (bubbleVisible) return;

    const SHOW_DELAY_MS = 30_000;
    const VISIBLE_DURATION_MS = 60_000;
    const CLOSE_ANIM_MS = 420;

    const showTimer = setTimeout(() => {
      setBubbleClosing(false);
      setBubbleVisible(true);

      const hideTimer = setTimeout(() => {
        setBubbleClosing(true);
        const removeTimer = setTimeout(() => {
          setBubbleVisible(false);
          setBubbleClosing(false);
          setBubbleDismissed(true);
        }, CLOSE_ANIM_MS);
        (showTimer as any)._removeTimer = removeTimer;
      }, VISIBLE_DURATION_MS);
      (showTimer as any)._hideTimer = hideTimer;
    }, SHOW_DELAY_MS);

    return () => {
      clearTimeout(showTimer);
      const h = (showTimer as any)._hideTimer;
      const r = (showTimer as any)._removeTimer;
      if (h) clearTimeout(h);
      if (r) clearTimeout(r);
    };
    // We intentionally trigger only when the text first arrives / route becomes eligible.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidden, greetBubbleText, bubbleDismissed]);

  // (Auto-open after 60s disabled — keeps the launcher icon consistently
  // visible. Users can open the chat manually whenever they need it.)
  useEffect(() => {
    return undefined;
  }, [hidden]);

  // First-time greeting when chat opens with empty history.
  // Do NOT wait for productsLoaded — greeting shows immediately;
  // products load in parallel and are used by subsequent messages.
  useEffect(() => {
    if (open && messages.length === 0 && !busy) {
      void sendToServer('Salam', { silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const sendToServer = async (
    text: string,
    options: { silent?: boolean } = {}
  ): Promise<void> => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    setBusy(true);
    let pendingHistory: ChatMessage[] = [];
    if (!options.silent) {
      pendingHistory = [...messages, { role: 'user', content: trimmed, ts: Date.now() }];
      setMessages(pendingHistory);
    } else {
      pendingHistory = [...messages];
    }

    try {
      const reply = await sendChatMessage({
        message: trimmed,
        history: pendingHistory.map((m) => ({ role: m.role, content: m.content })),
        products: compactProducts(productsRef.current),
        knowledge: knowledgeRef.current || undefined,
        language: lang,
        sessionId: sessionIdRef.current,
      });
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: reply, ts: Date.now() },
      ]);
    } catch (err) {
      console.warn('[AI Chat] sendChatMessage failed:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'Bir anlıq bağlantı problemi oldu. Zəhmət olmasa bir neçə saniyə sonra yenidən yazın.',
          ts: Date.now(),
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput('');
    void sendToServer(text);
  };

  const handleClear = () => {
    if (!confirm('Söhbəti təmizləmək istəyirsiniz?')) return;
    setMessages([]);
    sessionIdRef.current = newSessionId();
    try {
      localStorage.setItem(SESSION_KEY, sessionIdRef.current);
      localStorage.removeItem(HISTORY_KEY);
    } catch { /* ignore */ }
  };

  if (hidden) return null;

  return (
    <>
      {/* Floating launcher button — minimalist */}
      {!open && (
        <div className="fixed bottom-5 right-5 z-[9998] flex items-end gap-2">
          {/* Greet bubble — fades in 30s after visit, stays 1 min, fades out. Text from admin. */}
          {bubbleVisible && greetBubbleText.trim() && (
            <button
              type="button"
              onClick={() => {
                setOpen(true);
                setBubbleVisible(false);
                setBubbleDismissed(true);
              }}
              className={`mb-1.5 max-w-[200px] relative cursor-pointer group ${bubbleClosing ? 'dv-ai-greet-out' : 'dv-ai-greet-in'}`}
              data-testid="ai-greet-bubble"
              aria-label={greetBubbleText}
            >
              <span className="relative block bg-white border border-[#D4AF37]/70 pl-2.5 pr-6 py-1.5 text-left shadow-[0_4px_14px_-6px_rgba(212,175,55,0.45)]">
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setBubbleClosing(true);
                    setTimeout(() => {
                      setBubbleVisible(false);
                      setBubbleClosing(false);
                      setBubbleDismissed(true);
                    }, 380);
                  }}
                  className="absolute top-1/2 -translate-y-1/2 right-1.5 text-black/30 hover:text-black/70 cursor-pointer leading-none"
                  aria-label="Bağla"
                >
                  <X className="h-2.5 w-2.5" strokeWidth={1.5} />
                </span>
                <span className="relative block text-[10.5px] text-black font-medium leading-snug tracking-tight whitespace-nowrap">
                  {greetBubbleText}
                </span>
              </span>
              {/* Tail pointing to the launcher */}
              <span aria-hidden="true" className="dv-ai-greet-tail" />
            </button>
          )}
          <button
            onClick={() => {
              setOpen(true);
              setBubbleVisible(false);
              setBubbleDismissed(true);
            }}
            className="dv-ai-launcher dv-ai-launcher-live group relative flex items-center justify-center w-12 h-12 rounded-full bg-white transition-all duration-300 overflow-visible"
            title="De Valeur AI ilə danış"
            aria-label="De Valeur AI ilə danış"
            data-testid="ai-chat-launcher"
          >
            {/* Animated gold ring */}
            <span aria-hidden="true" className="dv-ai-ring absolute inset-0 rounded-full" />
            {/* Logo — full image, contained inside the circle so D and R aren't clipped */}
            <span className="absolute inset-[3px] rounded-full overflow-hidden flex items-center justify-center bg-white z-[1]">
              <img
                src="https://i.hizliresim.com/tmu65g6.png"
                alt="De Valeur"
                className="w-[80%] h-[80%] object-contain"
                draggable={false}
              />
            </span>
            {/* Pulsing online indicator (green light) */}
            <span aria-hidden="true" className="dv-ai-online-dot absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white z-[2]" />
            <span aria-hidden="true" className="dv-ai-online-pulse absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 z-[1]" />
          </button>
        </div>
      )}

      {/* Chat panel — minimalist luxe */}
      {open && (
        <div
          className="fixed bottom-5 right-5 z-[9999] bg-white flex flex-col overflow-hidden dv-ai-panel"
          style={{
            width: 'min(400px, calc(100vw - 24px))',
            height: 'min(600px, calc(100vh - 60px))',
            border: '1px solid #D4AF37',
            boxShadow: '0 24px 60px -20px rgba(0,0,0,0.45), 0 0 0 0.5px rgba(212,175,55,0.3)',
          }}
          data-testid="ai-chat-panel"
        >
          {/* Header — luxury with gold accent */}
          <div className="relative px-5 py-4 flex items-center justify-between bg-white">
            <div className="flex items-center gap-3 min-w-0">
              <span className="relative w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center bg-white" style={{ boxShadow: '0 0 0 1px #D4AF37' }}>
                <img src={DEVALEUR_LOGO} alt="" className="w-[75%] h-[75%] object-contain" draggable={false} />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
              </span>
              <p className="font-playfair text-[22px] font-light text-black tracking-[0.04em] leading-none uppercase">
                DE VALEUR
              </p>
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button
                onClick={handleClear}
                className="p-1.5 hover:bg-black/[0.04] rounded-full transition-colors"
                title="Söhbəti təmizlə"
                data-testid="ai-chat-clear"
              >
                <Trash2 className="h-3.5 w-3.5 text-black/45 hover:text-black/70" strokeWidth={1.5} />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 hover:bg-black/[0.04] rounded-full transition-colors"
                title="Bağla"
                data-testid="ai-chat-close"
              >
                <X className="h-4 w-4 text-black/60 hover:text-black" strokeWidth={1.5} />
              </button>
            </div>
            {/* Gold accent line at bottom */}
            <span aria-hidden="true" className="absolute left-5 right-5 bottom-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-4 bg-gradient-to-b from-white via-white to-[#FAF8F3]"
            data-testid="ai-chat-messages"
          >
            {messages.length === 0 && !busy && (
              <div className="text-center py-10">
                <div className="inline-flex w-12 h-12 rounded-full items-center justify-center mb-4" style={{ boxShadow: '0 0 0 1px #D4AF37' }}>
                  <Sparkles className="h-5 w-5 text-[#D4AF37]" strokeWidth={1.5} />
                </div>
                <p className="font-playfair text-base text-black font-light tracking-tight mb-1">Necə kömək edə bilərəm?</p>
                <p className="text-[12px] text-black/50 font-light px-4 leading-relaxed">
                  Sizə uyğun saat və aksesuar tapmaqda yardım edirəm.
                </p>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`mb-3 flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} dv-ai-msg-in`}
                data-testid={`ai-chat-msg-${m.role}-${i}`}
              >
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 text-[13px] leading-relaxed break-words rounded-2xl ${
                    m.role === 'user'
                      ? 'bg-black text-white whitespace-pre-wrap rounded-br-sm'
                      : 'bg-white border border-black/[0.08] text-black rounded-bl-sm shadow-[0_2px_8px_-4px_rgba(0,0,0,0.08)]'
                  }`}
                >
                  {m.role === 'assistant' ? (
                    <AssistantContent
                      text={m.content}
                      productMap={productMap}
                      setProductMap={setProductMap}
                      lang={lang}
                      onProductClick={handleProductClick}
                      onAddToCart={handleAddToCart}
                    />
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}

            {busy && (
              <div className="flex justify-start mb-3">
                <div className="bg-white border border-black/[0.08] px-3.5 py-2.5 rounded-2xl rounded-bl-sm shadow-[0_2px_8px_-4px_rgba(0,0,0,0.08)]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-[#D4AF37] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-[#D4AF37] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-[#D4AF37] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="border-t border-black/[0.06] px-3 py-3 bg-white flex items-end gap-2"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Mesajınızı yazın..."
              rows={1}
              maxLength={2000}
              disabled={busy}
              className="flex-1 resize-none border border-black/15 focus:border-[#D4AF37] outline-none px-3.5 py-2.5 text-[13px] text-black placeholder-black/35 max-h-28 disabled:bg-black/[0.02] transition-colors bg-white rounded-full"
              style={{ minHeight: 40 }}
              data-testid="ai-chat-input"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="bg-black text-white hover:bg-[#D4AF37] hover:text-black disabled:opacity-40 disabled:cursor-not-allowed transition-all p-2.5 flex-shrink-0 rounded-full w-10 h-10 flex items-center justify-center"
              data-testid="ai-chat-send"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
              ) : (
                <Send className="h-4 w-4" strokeWidth={1.75} />
              )}
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default AiChatWidget;
