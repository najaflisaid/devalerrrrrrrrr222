import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X, Send, Loader2, Sparkles, Trash2, ShoppingBag, Check } from 'lucide-react';
import { productService } from '../services/productService';
import { getAiKnowledge, subscribeChatEnabled, type AiKnowledge } from '../services/aiKnowledgeService';
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
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
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
            <>Stokda yoxdur</>
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
  // Salamlama "tooltip" üçün state — sayta girəndə avtomatik bir neçə saniyə göstərilir
  const [showGreetBubble, setShowGreetBubble] = useState(false);
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
      p.startsWith('/b2b-request')
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

  // Sayta giriş edəndə salamlama bubble (satış mütəxəssisi notification kimi).
  // Tab üçün bir dəfə göstərilir; storage olmasa da in-memory fallback.
  useEffect(() => {
    if (hidden || open) return;
    const SHOWN_KEY = 'devaleur_ai_greet_shown';
    if (safeSessionGet(SHOWN_KEY)) return;
    const timer = window.setTimeout(() => {
      setShowGreetBubble(true);
      safeSessionSet(SHOWN_KEY, '1');
      window.setTimeout(() => setShowGreetBubble(false), 14000);
    }, 40000);
    return () => window.clearTimeout(timer);
  }, [hidden, open]);

  // 1 dəqiqə (60 saniyə) sonra istifadəçi chat-ı açmayıbsa, chat-ı avtomatik aç
  // və satış mütəxəssisi kimi proaktiv salamlama mesajı göstər.
  useEffect(() => {
    if (hidden) return;
    const PROACTIVE_KEY = 'devaleur_ai_proactive_sent';
    if (safeSessionGet(PROACTIVE_KEY)) return;
    const timer = window.setTimeout(() => {
      // Əgər istifadəçi hələ də chat açmayıbsa
      if (!open && messages.length === 0) {
        safeSessionSet(PROACTIVE_KEY, '1');
        const proactiveMsg: ChatMessage = {
          role: 'assistant',
          content:
            'Salam! 👋 Mən DE VALEUR-in satış mütəxəssisiyəm. Saat, dəri aksesuar və ya hədiyyə seçimində sizə kömək etməyə hazıram. Hansı növdə məhsul sizi maraqlandırır?',
          ts: Date.now(),
        };
        setMessages([proactiveMsg]);
        setOpen(true);
        setShowGreetBubble(false);
      }
    }, 60000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    } catch {
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
      {/* Floating launcher button — circle only */}
      {!open && (
        <div className="fixed bottom-5 right-5 z-[9998] flex items-end gap-2">
          {/* Salamlama bubble — satış mütəxəssisi bildirişi kimi */}
          {showGreetBubble && (
            <button
              type="button"
              onClick={() => {
                setOpen(true);
                setShowGreetBubble(false);
              }}
              className="mb-1 max-w-[260px] bg-white shadow-[0_10px_30px_-8px_rgba(0,0,0,0.25)] border border-gray-100 rounded-2xl rounded-br-sm pl-3 pr-7 py-2.5 text-left animate-in slide-in-from-right-2 fade-in relative cursor-pointer hover:shadow-[0_12px_36px_-8px_rgba(0,0,0,0.35)] transition-shadow"
              data-testid="ai-greet-bubble"
              aria-label="AI satış mütəxəssisi ilə danış"
            >
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setShowGreetBubble(false);
                }}
                className="absolute top-1.5 right-1.5 text-gray-300 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-100 cursor-pointer"
              >
                <X className="h-3 w-3" />
              </span>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-bold tracking-wider text-amber-600 uppercase">DE VALEUR</span>
              </div>
              <p className="text-[13px] text-gray-900 font-medium leading-snug">
                Salam! 👋 Sizə uyğun saat və ya aksesuar seçməkdə kömək edə bilərəm.
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">Yazışmaya başlamaq üçün tıklayın</p>
            </button>
          )}
          <button
            onClick={() => {
              setOpen(true);
              setShowGreetBubble(false);
            }}
            className="group relative flex items-center justify-center w-12 h-12 bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white rounded-full shadow-[0_6px_24px_rgba(0,0,0,0.3)] hover:shadow-[0_10px_32px_rgba(0,0,0,0.45)] hover:scale-105 active:scale-95 transition-all duration-300 border border-amber-400/30"
            title="De Valeur AI ilə danış"
            aria-label="De Valeur AI ilə danış"
            data-testid="ai-chat-launcher"
          >
            <span className="relative flex items-center justify-center w-9 h-9 rounded-full bg-white/5 ring-1 ring-amber-400/40 group-hover:ring-amber-400/70 transition-all">
              <img
                src={DEVALEUR_LOGO}
                alt=""
                className="w-6 h-6 object-contain"
                style={{ filter: 'brightness(0) invert(1)' }}
              />
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-gray-900 animate-pulse" />
            </span>
          </button>
        </div>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-6 right-6 z-[9999] bg-white rounded-3xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.5)] border border-gray-100 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in"
          style={{
            width: 'min(440px, calc(100vw - 32px))',
            height: 'min(640px, calc(100vh - 80px))',
          }}
          data-testid="ai-chat-panel"
        >
          {/* Header — premium with logo */}
          <div
            className="relative text-white px-5 py-4 flex items-center justify-between overflow-hidden"
            style={{
              background:
                'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #0f0f0f 100%)',
            }}
          >
            {/* Subtle gold shimmer */}
            <div
              className="absolute inset-0 opacity-30 pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle at 30% 0%, rgba(251, 191, 36, 0.25), transparent 50%)',
              }}
            />
            <div className="relative flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-full bg-white/5 ring-2 ring-amber-400/40 flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
                <img
                  src={DEVALEUR_LOGO}
                  alt="De Valeur"
                  className="w-7 h-7 object-contain"
                  style={{ filter: 'brightness(0) invert(1)' }}
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold text-[15px] leading-tight tracking-wide">
                    De Valeur AI
                  </p>
                  <Sparkles className="h-3 w-3 text-amber-400" />
                </div>
                <p className="text-[11px] text-white/60 leading-tight flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full inline-block animate-pulse" />
                  Onlayn satış konsultantı
                </p>
              </div>
            </div>
            <div className="relative flex items-center gap-1 flex-shrink-0">
              <button
                onClick={handleClear}
                className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                title="Söhbəti təmizlə"
                data-testid="ai-chat-clear"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                title="Bağla"
                data-testid="ai-chat-close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-4 bg-gradient-to-b from-gray-50/80 to-white"
            data-testid="ai-chat-messages"
          >
            {messages.length === 0 && !busy && (
              <div className="text-center py-10">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center mx-auto mb-3 shadow-xl ring-2 ring-amber-400/30">
                  <img
                    src={DEVALEUR_LOGO}
                    alt="De Valeur"
                    className="w-10 h-10 object-contain"
                    style={{ filter: 'brightness(0) invert(1)' }}
                  />
                </div>
                <p className="text-sm font-bold text-gray-900 tracking-wide">DE VALEUR AI</p>
                <p className="text-xs text-gray-500 mt-1">
                  Sizə uyğun saat və aksesuar tapmaqda kömək edirəm
                </p>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`mb-3 flex ${m.role === 'user' ? 'justify-end' : 'justify-start gap-2 items-end'}`}
                data-testid={`ai-chat-msg-${m.role}-${i}`}
              >
                {/* Assistant avatar */}
                {m.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-900 to-black flex items-center justify-center flex-shrink-0 ring-1 ring-amber-400/30 mb-1">
                    <img
                      src={DEVALEUR_LOGO}
                      alt=""
                      className="w-4 h-4 object-contain"
                      style={{ filter: 'brightness(0) invert(1)' }}
                    />
                  </div>
                )}
                <div
                  className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed break-words ${
                    m.role === 'user'
                      ? 'bg-gradient-to-br from-gray-900 to-black text-white rounded-br-md whitespace-pre-wrap shadow-md'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md shadow-sm'
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
              <div className="flex justify-start gap-2 items-end mb-3">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-900 to-black flex items-center justify-center flex-shrink-0 ring-1 ring-amber-400/30 mb-1">
                  <img
                    src={DEVALEUR_LOGO}
                    alt=""
                    className="w-4 h-4 object-contain"
                    style={{ filter: 'brightness(0) invert(1)' }}
                  />
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-2.5 shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: '0ms' }}
                    />
                    <span
                      className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: '150ms' }}
                    />
                    <span
                      className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: '300ms' }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="border-t border-gray-100 px-3 py-3 bg-white flex items-end gap-2"
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
              className="flex-1 resize-none border border-gray-200 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 max-h-28 disabled:bg-gray-50 transition-colors"
              style={{ minHeight: 40 }}
              data-testid="ai-chat-input"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="bg-gradient-to-br from-gray-900 to-black text-white rounded-xl p-2.5 hover:from-gray-800 hover:to-gray-900 disabled:from-gray-300 disabled:to-gray-300 transition-all flex-shrink-0 shadow-md hover:shadow-lg"
              data-testid="ai-chat-send"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </form>

          {/* Footer brand strip */}
          <div className="px-4 py-1.5 bg-gray-50 border-t border-gray-100 flex items-center justify-center gap-1.5">
            <span className="text-[10px] text-gray-400">Powered by</span>
            <span className="text-[10px] font-bold tracking-[0.15em] text-gray-700">
              DE VALEUR
            </span>
            <Sparkles className="h-2.5 w-2.5 text-amber-500" />
          </div>
        </div>
      )}
    </>
  );
};

export default AiChatWidget;
