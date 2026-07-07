import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X, Send, Loader2, Sparkles, Trash2, ShoppingBag, Check, Paperclip, Image as ImageIcon, LayoutGrid } from 'lucide-react';
import { productService } from '../services/productService';
import { getAiKnowledge, subscribeChatEnabled, subscribeGreetBubbleText, type AiKnowledge } from '../services/aiKnowledgeService';
import { sendChatMessage } from '../services/aiChatService';
import {
  initSession,
  logMessage,
  subscribeSession,
  subscribeSessionMessages,
} from '../services/chatSessionService';
import { uploadImageToR2 } from '../services/imageUploadService';
import { playCustomerReceiveSound } from '../utils/chatSounds';
import { useCart } from '../context/CartContext';
import type { Product } from '../types';

const SESSION_KEY = 'devaleur_ai_session';
const HISTORY_KEY = 'devaleur_ai_history';
const MAX_HISTORY = 24;
const DEVALEUR_LOGO = 'https://i.hizliresim.com/tmu65g6.png';

interface ChatMessage {
  role: 'user' | 'assistant' | 'admin';
  content: string;
  imageUrl?: string;
  ts: number;
  byName?: string;
  byRole?: string;
}

const newSessionId = () => {
  if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) {
    return (crypto as any).randomUUID();
  }
  return 'ses-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
};

const compactProducts = (products: Product[]) => {
  const visible = products.filter((p) => p.isEnabled !== false && !p.comingSoon);
  const score = (p: Product) => {
    const inStock = (p.stock ?? 0) > 0 ? 2 : 0;
    const bs = p.isBestseller ? 1 : 0;
    return inStock + bs;
  };
  const ranked = [...visible].sort((a, b) => score(b) - score(a));
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
      description: idx < 60 ? desc.slice(0, 180) : '',
    };
  });
};

const renderInline = (text: string) => {
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
      <button type="button" onClick={onClick} className="group w-full flex items-center gap-3 p-2.5 text-left">
        <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 border border-gray-100 flex-shrink-0">
          {img ? <img src={img} alt={name} loading="lazy" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400">N/A</div>}
        </div>
        <div className="flex-1 min-w-0">
          {product.brand && <p className="text-[10px] uppercase tracking-wide text-amber-600 font-semibold truncate">{product.brand}</p>}
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
      <div className="flex items-stretch border-t border-gray-100">
        <button type="button" onClick={handleAdd} disabled={!inStock || added} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${added ? 'bg-emerald-50 text-emerald-700' : inStock ? 'bg-gray-900 text-white hover:bg-black' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`} data-testid={`ai-product-add-cart-${product.id}`}>
          {added ? (<><Check className="h-3.5 w-3.5" /> Əlavə olundu</>) : inStock ? (<><ShoppingBag className="h-3.5 w-3.5" /> Səbətə əlavə et</>) : (<>Bitdi</>)}
        </button>
        <button type="button" onClick={onClick} className="px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 border-l border-gray-100" data-testid={`ai-product-view-${product.id}`}>Bax →</button>
      </div>
    </div>
  );
};

const PRODUCT_MARKER_RE = /\[\[PRODUCT:([^\]\s]+)\]\]/g;

const resolveProduct = (rawId: string, productMap: Record<string, Product>): Product | null => {
  if (productMap[rawId]) return productMap[rawId];
  const lower = rawId.toLowerCase();
  const products = Object.values(productMap);
  const ci = products.find((p) => p.id.toLowerCase() === lower);
  if (ci) return ci;
  const byName = products.find((p) => {
    const az = (p.name?.az || '').toLowerCase();
    const en = (p.name?.en || '').toLowerCase();
    const ru = (p.name?.ru || '').toLowerCase();
    return az === lower || en === lower || ru === lower;
  });
  if (byName) return byName;
  if (rawId.length >= 4) {
    const partial = products.find((p) => {
      const az = (p.name?.az || '').toLowerCase();
      const en = (p.name?.en || '').toLowerCase();
      return az.includes(lower) || en.includes(lower) || lower.includes(az) || lower.includes(en);
    });
    if (partial) return partial;
  }
  if (rawId.length >= 6) {
    const prefix = products.find((p) => p.id.startsWith(rawId) || rawId.startsWith(p.id));
    if (prefix) return prefix;
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
    productService.getById(productId).then((p) => {
      if (cancelled) return;
      if (p) {
        setProduct(p);
        setProductMap((prev) => (prev[productId] ? prev : { ...prev, [productId]: p }));
      } else setFailed(true);
    }).catch(() => !cancelled && setFailed(true));
    return () => { cancelled = true; };
  }, [productId, setProductMap]);
  if (failed) return <button onClick={onClick} className="my-2 inline-flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs text-gray-700">Məhsula bax →</button>;
  if (!product) return <div className="my-2 w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-3 animate-pulse"><div className="w-14 h-14 rounded-lg bg-gray-200" /><div className="flex-1 space-y-1.5"><div className="h-2 bg-gray-200 rounded w-1/3" /><div className="h-3 bg-gray-200 rounded w-2/3" /><div className="h-3 bg-gray-200 rounded w-1/4" /></div></div>;
  return <ProductMiniCard product={product} lang={lang} onClick={onClick} onAddToCart={onAddToCart} />;
};

const AssistantContent: React.FC<{
  text: string;
  productMap: Record<string, Product>;
  setProductMap: React.Dispatch<React.SetStateAction<Record<string, Product>>>;
  lang: 'az' | 'ru' | 'en';
  onProductClick: (id: string) => void;
  onAddToCart: (product: Product) => void;
}> = ({ text, productMap, setProductMap, lang, onProductClick, onAddToCart }) => {
  const segments: Array<{ kind: 'text'; value: string } | { kind: 'product'; id: string }> = [];
  let lastIndex = 0;
  for (const match of text.matchAll(PRODUCT_MARKER_RE)) {
    const idx = match.index ?? 0;
    if (idx > lastIndex) segments.push({ kind: 'text', value: text.slice(lastIndex, idx) });
    segments.push({ kind: 'product', id: match[1] });
    lastIndex = idx + match[0].length;
  }
  if (lastIndex < text.length) segments.push({ kind: 'text', value: text.slice(lastIndex) });
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.kind === 'text') {
          if (!seg.value.trim()) return null;
          return <div key={i} className="whitespace-pre-wrap break-words">{renderInline(seg.value)}</div>;
        }
        const p = resolveProduct(seg.id, productMap);
        if (p) return <ProductMiniCard key={i} product={p} lang={lang} onClick={() => onProductClick(p.id)} onAddToCart={onAddToCart} />;
        return <LazyProductCard key={i} productId={seg.id} setProductMap={setProductMap} lang={lang} onClick={() => onProductClick(seg.id)} onAddToCart={onAddToCart} />;
      })}
    </>
  );
};

interface AiChatWidgetProps {
  /** When true, chat is embedded on a dedicated page and always full-screen (no launcher). */
  embedded?: boolean;
}

const AiChatWidget: React.FC<AiChatWidgetProps> = ({ embedded = false }) => {
  const { i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [open, setOpen] = useState(embedded);
  const [busy, setBusy] = useState(false);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [productMap, setProductMap] = useState<Record<string, Product>>({});
  const [greetBubbleText, setGreetBubbleText] = useState<string>('');
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [bubbleClosing, setBubbleClosing] = useState(false);
  const [bubbleDismissed, setBubbleDismissed] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [viewportOffsetTop, setViewportOffsetTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(typeof window !== 'undefined' ? window.innerHeight : 800);
  const [isMobile, setIsMobile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [sessionAiEnabled, setSessionAiEnabled] = useState(true);
  const productsRef = useRef<Product[]>([]);
  const knowledgeRef = useRef<AiKnowledge | null>(null);
  const sessionIdRef = useRef<string>('');
  const sessionInitedRef = useRef<boolean>(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const seenMsgIdsRef = useRef<Set<string>>(new Set());

  const lang = (i18n.language || 'az') as 'az' | 'ru' | 'en';

  const handleProductClick = (id: string) => {
    if (!embedded) setOpen(false);
    navigate(`/product/${id}`);
  };
  const handleAddToCart = (product: Product) => addToCart(product, 1);

  // Detect mobile once & on resize
  useEffect(() => {
    const check = () => setIsMobile(window.matchMedia('(max-width: 640px)').matches);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const hidden = useMemo(() => {
    if (embedded) return false;
    const p = location.pathname;
    if (!chatEnabled) return true;
    return (
      p.startsWith('/admin') ||
      p.startsWith('/workers') ||
      p.startsWith('/b2b-login') ||
      p.startsWith('/admin-login') ||
      p.startsWith('/b2b-request') ||
      p.startsWith('/payment') ||
      p.startsWith('/consultant') ||
      p.startsWith('/chat')
    );
  }, [location.pathname, chatEnabled, embedded]);

  useEffect(() => {
    const unsub = subscribeChatEnabled((flag) => {
      setChatEnabled(flag);
      if (!flag && !embedded) setOpen(false);
    });
    return () => unsub();
  }, [embedded]);

  useEffect(() => {
    const handler = () => {
      setBubbleVisible(false);
      setBubbleDismissed(true);
      setOpen(true);
    };
    window.addEventListener('dv:open-chat', handler);
    return () => window.removeEventListener('dv:open-chat', handler);
  }, []);

  // Mobile keyboard handling — panel takes exact visualViewport space so keyboard slots
  // in below the input without pushing chat up.
  useEffect(() => {
    if (!open) return;
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    if (!vv) return;
    const handleResize = () => {
      const vh = window.innerHeight;
      const kb = Math.max(0, vh - vv.height - vv.offsetTop);
      setKeyboardHeight(kb > 50 ? kb : 0);
      setViewportOffsetTop(vv.offsetTop || 0);
      setViewportHeight(vv.height);
    };
    vv.addEventListener('resize', handleResize);
    vv.addEventListener('scroll', handleResize);
    handleResize();
    return () => {
      vv.removeEventListener('resize', handleResize);
      vv.removeEventListener('scroll', handleResize);
    };
  }, [open]);

  // Prevent body scroll when full-screen chat is open on mobile
  useEffect(() => {
    if (open && (isMobile || embedded)) {
      const orig = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = orig; };
    }
    return undefined;
  }, [open, isMobile, embedded]);

  // Session id + local history bootstrap
  useEffect(() => {
    let sid = '';
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) {
        sid = stored;
      } else {
        sid = newSessionId();
        localStorage.setItem(SESSION_KEY, sid);
      }
    } catch { sid = newSessionId(); }
    sessionIdRef.current = sid;
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setMessages(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  // Persist local history (best-effort)
  useEffect(() => {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-MAX_HISTORY))); }
    catch { /* ignore */ }
  }, [messages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open, busy]);

  // Lazy load products + knowledge on first open
  useEffect(() => {
    if (open && !productsLoaded) {
      Promise.all([
        productService.getAll().catch(() => [] as Product[]),
        getAiKnowledge().catch(() => null),
      ]).then(([list, knowledge]) => {
        productsRef.current = list;
        knowledgeRef.current = knowledge;
        const m: Record<string, Product> = {};
        list.forEach((p) => { m[p.id] = p; });
        setProductMap(m);
        setProductsLoaded(true);
      });
    }
  }, [open, productsLoaded]);

  // Subscribe to greet bubble
  useEffect(() => {
    const unsub = subscribeGreetBubbleText((txt) => setGreetBubbleText(txt || ''));
    return () => unsub();
  }, []);

  // Bubble lifecycle
  useEffect(() => {
    if (hidden || open || embedded) return;
    if (bubbleDismissed || !greetBubbleText.trim() || bubbleVisible) return;
    const SHOW_DELAY = 30000;
    const VISIBLE_MS = 60000;
    const CLOSE_MS = 420;
    const showTimer = setTimeout(() => {
      setBubbleClosing(false);
      setBubbleVisible(true);
      const hideTimer = setTimeout(() => {
        setBubbleClosing(true);
        const removeTimer = setTimeout(() => {
          setBubbleVisible(false);
          setBubbleClosing(false);
          setBubbleDismissed(true);
        }, CLOSE_MS);
        (showTimer as any)._removeTimer = removeTimer;
      }, VISIBLE_MS);
      (showTimer as any)._hideTimer = hideTimer;
    }, SHOW_DELAY);
    return () => {
      clearTimeout(showTimer);
      const h = (showTimer as any)._hideTimer;
      const r = (showTimer as any)._removeTimer;
      if (h) clearTimeout(h);
      if (r) clearTimeout(r);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidden, greetBubbleText, bubbleDismissed, embedded]);

  // First-time greeting
  useEffect(() => {
    if (open && messages.length === 0 && !busy) {
      void sendToServer('Salam', { silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Init Firestore session on first open + subscribe to session ai_enabled + admin messages
  useEffect(() => {
    if (!open || sessionInitedRef.current) return;
    sessionInitedRef.current = true;
    void initSession(sessionIdRef.current, { language: lang });

    const unsubSession = subscribeSession(sessionIdRef.current, (s) => {
      if (s) setSessionAiEnabled(s.aiEnabled !== false);
    });
    const unsubMsgs = subscribeSessionMessages(sessionIdRef.current, (msgs) => {
      // Inject admin messages into UI (skip messages already seen or authored locally)
      const adminMsgs = msgs.filter((m) => m.role === 'admin' && m.id && !seenMsgIdsRef.current.has(m.id));
      if (adminMsgs.length === 0) return;
      // Skip playing sound on first load (initial subscription pass with historical admin messages)
      const isInitialLoad = seenMsgIdsRef.current.size === 0 && adminMsgs.length === msgs.filter(m => m.role === 'admin').length && msgs.length > adminMsgs.length;
      adminMsgs.forEach((m) => seenMsgIdsRef.current.add(m.id!));
      setMessages((prev) => [
        ...prev,
        ...adminMsgs.map<ChatMessage>((m) => ({
          role: 'admin',
          content: m.content || '',
          imageUrl: m.imageUrl || undefined,
          ts: (m.ts as any)?.seconds ? (m.ts as any).seconds * 1000 : Date.now(),
          byName: m.byName || 'Konsultant',
          byRole: (m as any).byRole || 'Satış məsləhətçisi',
        })),
      ]);
      if (!isInitialLoad) {
        playCustomerReceiveSound();
      }
    });
    return () => { unsubSession(); unsubMsgs(); };
  }, [open, lang]);

  const sendToServer = async (
    text: string,
    options: { silent?: boolean; imageUrl?: string } = {}
  ): Promise<void> => {
    const trimmed = text.trim();
    if (!trimmed && !options.imageUrl) return;
    if (busy) return;

    setBusy(true);
    let pendingHistory: ChatMessage[] = [];
    if (!options.silent) {
      const userMsg: ChatMessage = { role: 'user', content: trimmed, imageUrl: options.imageUrl, ts: Date.now() };
      pendingHistory = [...messages, userMsg];
      setMessages(pendingHistory);
      // Log to Firestore
      void logMessage(sessionIdRef.current, {
        role: 'user',
        content: trimmed,
        imageUrl: options.imageUrl,
      });
    } else {
      pendingHistory = [...messages];
    }

    // If admin disabled AI for this session, don't call OpenAI — wait for admin reply.
    if (!sessionAiEnabled) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Mesajınız qeyd olundu — komandamız sizə tezliklə cavab verəcək. 💬',
          ts: Date.now(),
        },
      ]);
      setBusy(false);
      return;
    }

    try {
      const aiMessage = options.imageUrl
        ? `[şəkil: ${options.imageUrl}]${trimmed ? ' ' + trimmed : ''}`
        : trimmed;
      const reply = await sendChatMessage({
        message: aiMessage,
        history: pendingHistory.map((m) => ({
          role: m.role === 'admin' ? 'assistant' : m.role,
          content: m.imageUrl ? `[şəkil: ${m.imageUrl}] ${m.content}` : m.content,
        })),
        products: compactProducts(productsRef.current),
        knowledge: knowledgeRef.current || undefined,
        language: lang,
        sessionId: sessionIdRef.current,
      });
      setMessages((prev) => [...prev, { role: 'assistant', content: reply, ts: Date.now() }]);
      void logMessage(sessionIdRef.current, { role: 'assistant', content: reply });
    } catch (err) {
      console.warn('[AI Chat] sendChatMessage failed:', err);
      if (!options.silent) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Bir anlıq bağlantı problemi oldu. Zəhmət olmasa bir neçə saniyə sonra yenidən yazın.', ts: Date.now() },
        ]);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = input.trim();
    if (!text && !pendingImage) return;
    const img = pendingImage;
    setInput('');
    setPendingImage(null);
    void sendToServer(text, { imageUrl: img || undefined });
  };

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Yalnız şəkil qəbul olunur'); return; }
    if (file.size > 8 * 1024 * 1024) { alert('Şəkil 8 MB-dan böyük ola bilməz'); return; }
    setUploading(true);
    try {
      const url = await uploadImageToR2(file, 'chat');
      setPendingImage(url);
    } catch (err: any) {
      alert('Şəkil yüklənmədi: ' + (err?.message || err));
    } finally {
      setUploading(false);
    }
  };

  const handleClear = () => {
    if (!confirm('Söhbəti təmizləmək istəyirsiniz?')) return;
    setMessages([]);
    seenMsgIdsRef.current.clear();
    sessionInitedRef.current = false;
    sessionIdRef.current = newSessionId();
    try {
      localStorage.setItem(SESSION_KEY, sessionIdRef.current);
      localStorage.removeItem(HISTORY_KEY);
    } catch { /* ignore */ }
  };

  if (hidden) return null;

  // Full-screen mode: always on mobile when open, or when embedded
  const fullScreen = embedded || (open && isMobile);

  return (
    <>
      {/* Floating launcher — not shown when embedded or full-screen open */}
      {!open && !embedded && (
        <div className="fixed bottom-5 right-5 z-[9998] flex items-end gap-2">
          {bubbleVisible && greetBubbleText.trim() && (
            <button
              type="button"
              onClick={() => { setOpen(true); setBubbleVisible(false); setBubbleDismissed(true); }}
              className={`mb-1.5 max-w-[200px] relative cursor-pointer group ${bubbleClosing ? 'dv-ai-greet-out' : 'dv-ai-greet-in'}`}
              data-testid="ai-greet-bubble"
              aria-label={greetBubbleText}
            >
              <span className="relative block bg-white border border-[#D4AF37]/70 pl-2.5 pr-6 py-1.5 text-left shadow-[0_4px_14px_-6px_rgba(212,175,55,0.45)]">
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setBubbleClosing(true);
                    setTimeout(() => { setBubbleVisible(false); setBubbleClosing(false); setBubbleDismissed(true); }, 380);
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
              <span aria-hidden="true" className="dv-ai-greet-tail" />
            </button>
          )}
          <button
            onClick={() => { setOpen(true); setBubbleVisible(false); setBubbleDismissed(true); }}
            className="dv-ai-launcher-pill group relative inline-flex items-center gap-2.5 pl-2 pr-4 h-12 rounded-full bg-white border border-[#D4AF37]/60 hover:border-[#D4AF37] shadow-[0_8px_24px_-8px_rgba(212,175,55,0.45)] hover:shadow-[0_12px_28px_-8px_rgba(212,175,55,0.6)] transition-all duration-300 overflow-visible"
            title="De Valeur AI ilə danış"
            aria-label="De Valeur AI ilə danış"
            data-testid="ai-chat-launcher"
          >
            <span aria-hidden="true" className="dv-ai-ring absolute left-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full pointer-events-none" />
            <span className="relative flex items-center justify-center w-9 h-9 flex-shrink-0 z-[1]">
              <span className="absolute inset-0 rounded-full overflow-hidden flex items-center justify-center bg-white" style={{ boxShadow: '0 0 0 1px rgba(212,175,55,0.55)' }}>
                <img src={DEVALEUR_LOGO} alt="De Valeur" className="w-[78%] h-[78%] object-contain" draggable={false} />
              </span>
              <span aria-hidden="true" className="dv-ai-online-dot absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white z-[3]" />
              <span aria-hidden="true" className="dv-ai-online-pulse absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 z-[2]" />
            </span>
            <span className="text-[11px] font-medium text-black/90 whitespace-nowrap tracking-wide uppercase">
              {lang === 'en' ? 'Chat with us' : lang === 'ru' ? 'Напишите нам' : 'Bizə yaz'}
            </span>
            <svg className="h-3.5 w-3.5 text-black/55 transition-transform duration-300 group-hover:-translate-y-0.5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* Chat panel */}
      {open && (
        <div
          ref={panelRef}
          className={`fixed z-[9999] bg-white flex flex-col overflow-hidden dv-ai-panel ${
            fullScreen ? '' : 'rounded-3xl'
          }`}
          style={fullScreen ? {
            // Anchor panel exactly to visualViewport — keyboard-safe on iOS & Android
            top: viewportOffsetTop,
            left: 0,
            width: '100vw',
            height: viewportHeight,
            border: 'none',
          } : {
            // Desktop / tablet floating panel
            bottom: 16 + keyboardHeight,
            right: 16,
            width: 'min(380px, calc(100vw - 20px))',
            height: `min(600px, calc(${viewportHeight}px - 40px))`,
            border: '1px solid #D4AF37',
            boxShadow: '0 24px 60px -20px rgba(0,0,0,0.45), 0 0 0 0.5px rgba(212,175,55,0.3)',
          }}
          data-testid="ai-chat-panel"
        >
          {/* Header */}
          <div className="relative px-5 py-4 flex items-center justify-between bg-white flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <span className="relative w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center bg-white" style={{ boxShadow: '0 0 0 1px #D4AF37' }}>
                <img src={DEVALEUR_LOGO} alt="" className="w-[75%] h-[75%] object-contain" draggable={false} />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
              </span>
              <div className="min-w-0">
                <p className="font-playfair text-[18px] sm:text-[22px] font-light text-black tracking-[0.04em] leading-none uppercase truncate">DE VALEUR</p>
                {!sessionAiEnabled && (
                  <p className="text-[10px] text-emerald-600 mt-0.5 font-medium">Konsultant onlayn</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {embedded && (
                <button
                  onClick={() => navigate('/products')}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 mr-1 rounded-full text-[11px] font-semibold uppercase tracking-wide bg-[#D4AF37] text-black hover:bg-[#B8961F] transition-colors"
                  title="Bütün məhsullara bax"
                  data-testid="ai-chat-view-products-desktop"
                >
                  <LayoutGrid className="h-3.5 w-3.5" strokeWidth={2} />
                  Məhsullar
                </button>
              )}
              {embedded && (
                <button
                  onClick={() => navigate('/products')}
                  className="sm:hidden p-2 mr-1 rounded-full bg-[#D4AF37] text-black hover:bg-[#B8961F] transition-colors"
                  title="Bütün məhsullara bax"
                  data-testid="ai-chat-view-products-mobile"
                >
                  <LayoutGrid className="h-4 w-4" strokeWidth={2} />
                </button>
              )}
              <button onClick={handleClear} className="p-1.5 hover:bg-black/[0.04] rounded-full transition-colors" title="Söhbəti təmizlə" data-testid="ai-chat-clear">
                <Trash2 className="h-3.5 w-3.5 text-black/45 hover:text-black/70" strokeWidth={1.5} />
              </button>
              {!embedded && (
                <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-black/[0.04] rounded-full transition-colors" title="Bağla" data-testid="ai-chat-close">
                  <X className="h-4 w-4 text-black/60 hover:text-black" strokeWidth={1.5} />
                </button>
              )}
            </div>
            <span aria-hidden="true" className="absolute left-5 right-5 bottom-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 bg-gradient-to-b from-white via-white to-[#FAF8F3]" data-testid="ai-chat-messages">
            {messages.length === 0 && !busy && (
              <div className="text-center py-10">
                <div className="inline-flex w-12 h-12 rounded-full items-center justify-center mb-4" style={{ boxShadow: '0 0 0 1px #D4AF37' }}>
                  <Sparkles className="h-5 w-5 text-[#D4AF37]" strokeWidth={1.5} />
                </div>
                <p className="font-playfair text-base text-black font-light tracking-tight mb-1">Necə kömək edə bilərəm?</p>
                <p className="text-[12px] text-black/50 font-light px-4 leading-relaxed">Sizə uyğun saat və aksesuar tapmaqda yardım edirəm.</p>
              </div>
            )}

            {messages.map((m, i) => {
              const isUser = m.role === 'user';
              const isAdmin = m.role === 'admin';
              return (
                <div key={i} className={`mb-3 flex ${isUser ? 'justify-end' : 'justify-start'} dv-ai-msg-in`} data-testid={`ai-chat-msg-${m.role}-${i}`}>
                  <div className={`max-w-[85%] px-3.5 py-2.5 text-[13px] leading-relaxed break-words rounded-2xl ${
                    isUser
                      ? 'bg-black text-white whitespace-pre-wrap rounded-br-sm'
                      : isAdmin
                      ? 'bg-[#D4AF37]/10 border border-[#D4AF37]/40 text-black rounded-bl-sm'
                      : 'bg-white border border-black/[0.08] text-black rounded-bl-sm shadow-[0_2px_8px_-4px_rgba(0,0,0,0.08)]'
                  }`}>
                    {isAdmin && (
                      <div className="mb-1.5 leading-tight">
                        <div className="text-[12px] font-semibold text-black tracking-tight">
                          {m.byName || 'Konsultant'}
                        </div>
                        <div className="text-[9.5px] font-medium text-[#B8860B] uppercase tracking-wide mt-0.5">
                          {m.byRole || 'Satış məsləhətçisi'}
                        </div>
                      </div>
                    )}
                    {m.imageUrl && (
                      <a href={m.imageUrl} target="_blank" rel="noreferrer" className="block mb-1.5">
                        <img src={m.imageUrl} alt="Göndərilən şəkil" className="rounded-lg max-h-48 object-cover" />
                      </a>
                    )}
                    {isUser ? (
                      m.content
                    ) : (
                      <AssistantContent
                        text={m.content}
                        productMap={productMap}
                        setProductMap={setProductMap}
                        lang={lang}
                        onProductClick={handleProductClick}
                        onAddToCart={handleAddToCart}
                      />
                    )}
                  </div>
                </div>
              );
            })}

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

          {/* Pending image preview */}
          {pendingImage && (
            <div className="flex-shrink-0 px-3 pt-2 flex items-center gap-2">
              <div className="relative">
                <img src={pendingImage} alt="preview" className="h-14 w-14 object-cover rounded-lg border border-gray-200" />
                <button
                  onClick={() => setPendingImage(null)}
                  className="absolute -top-1.5 -right-1.5 bg-black text-white rounded-full p-0.5 hover:bg-red-600"
                  aria-label="Şəkli çıxar"
                  data-testid="ai-chat-remove-image"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <span className="text-[11px] text-black/50">Şəkil göndərilməyə hazırdır</span>
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="border-t border-black/[0.06] px-3 py-3 bg-white flex items-end gap-2 flex-shrink-0"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImagePick}
              data-testid="ai-chat-file-input"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || busy}
              className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full border border-black/15 hover:border-[#D4AF37] hover:text-[#D4AF37] text-black/60 transition-colors disabled:opacity-40"
              title="Şəkil əlavə et"
              data-testid="ai-chat-attach-btn"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" strokeWidth={1.75} />}
            </button>
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
              className="flex-1 resize-none border border-black/15 focus:border-[#D4AF37] outline-none px-3.5 py-2.5 text-[16px] sm:text-[13px] text-black placeholder-black/35 max-h-28 disabled:bg-black/[0.02] transition-colors bg-white rounded-full"
              style={{ minHeight: 40 }}
              data-testid="ai-chat-input"
            />
            <button
              type="submit"
              disabled={busy || (!input.trim() && !pendingImage)}
              className="bg-black text-white hover:bg-[#D4AF37] hover:text-black disabled:opacity-40 disabled:cursor-not-allowed transition-all p-2.5 flex-shrink-0 rounded-full w-10 h-10 flex items-center justify-center"
              data-testid="ai-chat-send"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} /> : <Send className="h-4 w-4" strokeWidth={1.75} />}
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default AiChatWidget;
// Named export helpful for pages that want to render just the panel state icon
export { ImageIcon };
