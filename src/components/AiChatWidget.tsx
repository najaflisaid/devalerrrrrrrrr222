import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessageCircle, X, Send, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { productService } from '../services/productService';
import type { Product } from '../types';

const BACKEND_URL =
  (import.meta as any).env?.VITE_BACKEND_URL ||
  (import.meta as any).env?.REACT_APP_BACKEND_URL ||
  '';

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
  // Trim to most relevant fields & cap to keep prompt small.
  return products.slice(0, 80).map((p) => ({
    id: p.id,
    name: p.name?.az || p.name?.en || p.name?.ru || '',
    brand: p.brand || '',
    category: p.category || '',
    price: typeof p.price === 'number' ? p.price : null,
    salePrice: typeof p.salePrice === 'number' ? p.salePrice : null,
    stock: typeof p.stock === 'number' ? p.stock : null,
  }));
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

const AiChatWidget: React.FC = () => {
  const { i18n } = useTranslation();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const productsRef = useRef<Product[]>([]);
  const sessionIdRef = useRef<string>('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Hide on admin / b2b-login / workers / payment routes
  const hidden = useMemo(() => {
    const p = location.pathname;
    return (
      p.startsWith('/admin') ||
      p.startsWith('/workers') ||
      p.startsWith('/b2b-login') ||
      p.startsWith('/admin-login') ||
      p.startsWith('/b2b-request')
    );
  }, [location.pathname]);

  // Init: load session id + history from localStorage
  useEffect(() => {
    let sid = localStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = newSessionId();
      localStorage.setItem(SESSION_KEY, sid);
    }
    sessionIdRef.current = sid;
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

  // Lazy load products on first open
  useEffect(() => {
    if (open && !productsLoaded) {
      productService
        .getAll()
        .then((list) => {
          productsRef.current = list;
          setProductsLoaded(true);
        })
        .catch(() => {
          productsRef.current = [];
          setProductsLoaded(true);
        });
    }
  }, [open, productsLoaded]);

  // First-time greeting when chat opens with empty history
  useEffect(() => {
    if (open && messages.length === 0 && productsLoaded && !busy) {
      void sendToServer('Salam', { silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, productsLoaded]);

  const sendToServer = async (
    text: string,
    options: { silent?: boolean } = {}
  ): Promise<void> => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    if (!BACKEND_URL) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Texniki problem: server ünvanı tapılmadı.',
          ts: Date.now(),
        },
      ]);
      return;
    }

    setBusy(true);
    let pendingHistory: ChatMessage[] = [];
    if (!options.silent) {
      pendingHistory = [...messages, { role: 'user', content: trimmed, ts: Date.now() }];
      setMessages(pendingHistory);
    } else {
      pendingHistory = [...messages];
    }

    try {
      const lang = (i18n.language || 'az') as 'az' | 'ru' | 'en';
      const payload = {
        session_id: sessionIdRef.current,
        message: trimmed,
        history: pendingHistory.map((m) => ({ role: m.role, content: m.content })),
        products: compactProducts(productsRef.current),
        language: lang,
      };
      const res = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || 'AI cavab vermədi');
      }
      const data = await res.json();
      const reply: string = (data?.reply || '').toString();
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: reply, ts: Date.now() },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'Bağışlayın, indi cavab verə bilmədim. Bir az sonra yenidən yazın və ya bizimlə əlaqə vasitəsilə bağlanın. ' +
            (err?.message ? `(${err.message})` : ''),
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
    localStorage.setItem(SESSION_KEY, sessionIdRef.current);
    localStorage.removeItem(HISTORY_KEY);
  };

  if (hidden) return null;

  return (
    <>
      {/* Floating launcher button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-[9998] group bg-gradient-to-br from-gray-900 to-gray-700 text-white rounded-full shadow-2xl hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] transition-all duration-300 hover:scale-105 active:scale-95"
          style={{ width: 60, height: 60 }}
          title="De Valeur AI ilə danış"
          data-testid="ai-chat-launcher"
        >
          <span className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-400/40 to-amber-200/0 opacity-0 group-hover:opacity-100 transition-opacity" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-white animate-pulse" />
          <MessageCircle className="h-7 w-7 mx-auto" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-6 right-6 z-[9999] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in"
          style={{
            width: 'min(420px, calc(100vw - 32px))',
            height: 'min(620px, calc(100vh - 80px))',
          }}
          data-testid="ai-chat-panel"
        >
          {/* Header */}
          <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-md ring-2 ring-white/20 flex-shrink-0">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm leading-tight">De Valeur AI</p>
                <p className="text-[11px] text-white/60 leading-tight flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full inline-block" />
                  Onlayn satış konsultantı
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
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
            className="flex-1 overflow-y-auto px-3.5 py-3 bg-gradient-to-b from-gray-50/60 to-white"
            data-testid="ai-chat-messages"
          >
            {messages.length === 0 && !busy && (
              <div className="text-center py-10">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center mx-auto mb-3 shadow-md">
                  <Sparkles className="h-6 w-6 text-amber-400" />
                </div>
                <p className="text-sm font-semibold text-gray-900">De Valeur AI</p>
                <p className="text-xs text-gray-500 mt-1">
                  Sizə uyğun saat və aksesuar tapmaqda kömək edirəm
                </p>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`mb-2.5 flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                data-testid={`ai-chat-msg-${m.role}-${i}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    m.role === 'user'
                      ? 'bg-gray-900 text-white rounded-br-md'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md shadow-sm'
                  }`}
                >
                  {m.role === 'assistant' ? renderInline(m.content) : m.content}
                </div>
              </div>
            ))}

            {busy && (
              <div className="flex justify-start mb-2.5">
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
            className="border-t border-gray-100 px-3 py-2.5 bg-white flex items-end gap-2"
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
              className="flex-1 resize-none border border-gray-200 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none rounded-xl px-3 py-2 text-sm text-gray-900 placeholder-gray-400 max-h-28 disabled:bg-gray-50"
              style={{ minHeight: 38 }}
              data-testid="ai-chat-input"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="bg-gray-900 text-white rounded-xl p-2.5 hover:bg-gray-800 disabled:bg-gray-300 transition-colors flex-shrink-0"
              data-testid="ai-chat-send"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default AiChatWidget;
