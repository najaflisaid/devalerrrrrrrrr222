import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  Inbox, Send, Bot, PowerOff as BotOff, RefreshCw, Save, Eye, EyeOff, Sparkles,
  MessageSquare, Instagram, AlertCircle, CheckCircle2, Copy,
  Settings as SettingsIcon, Search, ShieldCheck, Loader2, Wand2,
} from 'lucide-react';
import {
  doc,
  setDoc,
  onSnapshot,
  collection,
  query,
  orderBy,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface Conversation {
  id: string;
  platform: 'whatsapp' | 'instagram' | string;
  user_external_id: string;
  user_name: string;
  ai_enabled: boolean;
  last_message: string;
  last_direction: 'inbound' | 'outbound';
  unread_count: number;
  updated_at?: any;
}

interface InboxMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  text: string;
  by: 'customer' | 'ai' | 'admin';
  created_at?: any;
}

interface AiInboxConfig {
  global_enabled: boolean;
  wa_enabled: boolean;
  ig_enabled: boolean;
  provider: string;          // 'openai' | 'anthropic' | 'gemini'
  model: string;
  use_custom_key: boolean;
  custom_api_key: string;
  persona: string;
  instagram_page_id: string;
  instagram_access_token: string;
  instagram_api_version: string;
  whatsapp_phone_id: string;
  whatsapp_access_token: string;
  whatsapp_api_version: string;
  meta_verify_token: string;
  meta_app_secret: string;
}

const DEFAULT_PERSONA =
  'Sən De Valeur saatlar və lüks aksesuarlar mağazasının rəsmi WhatsApp/Instagram müştəri xidmətləri köməkçisisən. ' +
  'Müştərilərə Azərbaycan dilində (və ya yazıldığı dildə) mehriban, peşəkar və qısa cavab ver. ' +
  'Saat brendləri, ödəniş, çatdırılma, qaytarma haqqında kömək et. Konkret məhsul soruşulsa, müştərini saytımıza yönləndir: https://devaleur.az. ' +
  'Cavablar maks 3-4 cümlə olsun, robot kimi deyil, təbii danışıq tonunda.';

const DEFAULT_CFG: AiInboxConfig = {
  global_enabled: false,
  wa_enabled: true,
  ig_enabled: true,
  provider: 'openai',
  model: 'gpt-4o-mini',
  use_custom_key: false,
  custom_api_key: '',
  persona: DEFAULT_PERSONA,
  instagram_page_id: '',
  instagram_access_token: '',
  instagram_api_version: 'v22.0',
  whatsapp_phone_id: '',
  whatsapp_access_token: '',
  whatsapp_api_version: 'v22.0',
  meta_verify_token: 'devaleur-meta-2026',
  meta_app_secret: '',
};

const ALLOWED_MODELS: Record<string, string[]> = {
  openai: ['gpt-5', 'gpt-5-mini', 'gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini'],
  anthropic: [
    'claude-sonnet-4-5-20250929',
    'claude-opus-4-1-20250805',
    'claude-haiku-4-5',
  ],
  gemini: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
};

const PROVIDER_LABEL: Record<string, string> = {
  openai: 'OpenAI (GPT)',
  anthropic: 'Anthropic (Claude)',
  gemini: 'Google (Gemini)',
};

const maskToken = (t: string) => {
  if (!t) return '';
  return t.length > 4 ? '•'.repeat(6) + t.slice(-4) : '••••';
};

const buildWebhookUrls = () => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return {
    whatsapp: `${origin}/api/webhooks/whatsapp`,
    instagram: `${origin}/api/webhooks/instagram`,
  };
};

const AiInboxTab: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'inbox' | 'settings' | 'setup'>('inbox');
  const [cfg, setCfg] = useState<AiInboxConfig>(DEFAULT_CFG);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filterPlatform, setFilterPlatform] = useState<'all' | 'whatsapp' | 'instagram'>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const webhookUrls = useMemo(buildWebhookUrls, []);

  // Form state for settings
  const [form, setForm] = useState<AiInboxConfig>(DEFAULT_CFG);
  const [showKey, setShowKey] = useState(false);
  const [showIgToken, setShowIgToken] = useState(false);
  const [showWaToken, setShowWaToken] = useState(false);
  const [showAppSecret, setShowAppSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testInput, setTestInput] = useState('Salam, qiymət barədə məlumat verə bilərsiniz?');
  const [testReply, setTestReply] = useState<string | null>(null);

  const showToast = (ok: boolean, text: string) => {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 4500);
  };

  // ---- Subscribe to config (live) ---------------------------------------
  useEffect(() => {
    const ref = doc(db, 'siteSettings', 'aiInbox');
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.exists() ? (snap.data() as Partial<AiInboxConfig>) : {};
      const merged = { ...DEFAULT_CFG, ...data } as AiInboxConfig;
      setCfg(merged);
      setForm((prev) => {
        // On first load just overwrite. After that, only refresh non-secret fields
        if (prev === DEFAULT_CFG) return merged;
        return {
          ...prev,
          global_enabled: merged.global_enabled,
          wa_enabled: merged.wa_enabled,
          ig_enabled: merged.ig_enabled,
        };
      });
    });
    return () => unsub();
  }, []);

  // ---- Subscribe to conversations (live) --------------------------------
  useEffect(() => {
    const ref = collection(db, 'aiInboxConversations');
    const unsub = onSnapshot(ref, (snap) => {
      const list: Conversation[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        list.push({
          id: data.id || d.id,
          platform: data.platform || '',
          user_external_id: data.user_external_id || '',
          user_name: data.user_name || '',
          ai_enabled: data.ai_enabled !== false,
          last_message: data.last_message || '',
          last_direction: data.last_direction || 'inbound',
          unread_count: data.unread_count || 0,
          updated_at: data.updated_at,
        });
      });
      list.sort((a, b) => {
        const ta = a.updated_at?.seconds || 0;
        const tb = b.updated_at?.seconds || 0;
        return tb - ta;
      });
      setConversations(list);
    });
    return () => unsub();
  }, []);

  // ---- Subscribe to messages of selected conversation -------------------
  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    const msgsRef = collection(db, 'aiInboxConversations', selectedId, 'messages');
    const q = query(msgsRef, orderBy('created_at', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const list: InboxMessage[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        list.push({
          id: data.id || d.id,
          direction: data.direction || 'inbound',
          text: data.text || '',
          by: data.by || 'customer',
          created_at: data.created_at,
        });
      });
      setMessages(list);
      // Mark as read (reset unread_count)
      updateDoc(doc(db, 'aiInboxConversations', selectedId), { unread_count: 0 }).catch(() => undefined);
    });
    return () => unsub();
  }, [selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ---- Actions ----------------------------------------------------------
  const saveSettings = async () => {
    setSaving(true);
    try {
      const payload: any = { ...form };
      // Don't overwrite stored secrets with masked placeholder strings
      if (!form.custom_api_key) delete payload.custom_api_key;
      if (!form.instagram_access_token) delete payload.instagram_access_token;
      if (!form.whatsapp_access_token) delete payload.whatsapp_access_token;
      if (!form.meta_app_secret) delete payload.meta_app_secret;

      const ref = doc(db, 'siteSettings', 'aiInbox');
      await setDoc(ref, payload, { merge: true });
      setForm((f) => ({
        ...f,
        custom_api_key: '',
        instagram_access_token: '',
        whatsapp_access_token: '',
        meta_app_secret: '',
      }));
      showToast(true, 'Parametrlər yadda saxlanıldı');
    } catch (e: any) {
      showToast(false, 'Yadda saxlanılmadı: ' + (e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const toggleConvAi = async (convId: string, current: boolean) => {
    try {
      await updateDoc(doc(db, 'aiInboxConversations', convId), { ai_enabled: !current });
      showToast(true, !current ? 'AI aktiv edildi' : 'AI dayandırıldı');
    } catch (e: any) {
      showToast(false, 'Dəyişiklik baş tutmadı: ' + (e?.message || e));
    }
  };

  const sendReply = async () => {
    if (!selectedId || !replyText.trim()) return;
    setSending(true);
    try {
      const res = await fetch('/api/ai-inbox/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conv_id: selectedId, text: replyText.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setReplyText('');
      showToast(true, 'Mesaj göndərildi');
    } catch (e: any) {
      showToast(false, 'Göndərmə uğursuz oldu: ' + (e?.message || e));
    } finally {
      setSending(false);
    }
  };

  const runAiTest = async () => {
    setTesting(true);
    setTestReply(null);
    try {
      const res = await fetch('/api/ai-inbox/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: testInput,
          // Use the current form values (so admin can test before saving)
          config: {
            provider: form.provider,
            model: form.model,
            use_custom_key: form.use_custom_key,
            custom_api_key: form.custom_api_key || undefined,
            persona: form.persona,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setTestReply(data.reply || '(boş cavab)');
      showToast(true, 'AI cavab verdi');
    } catch (e: any) {
      showToast(false, 'AI test uğursuz: ' + (e?.message || e));
      setTestReply('Xəta: ' + (e?.message || e));
    } finally {
      setTesting(false);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast(true, 'Kopyalandı');
  };

  // ---- Derived ----------------------------------------------------------
  const filteredConvs = useMemo(() => {
    let list = conversations;
    if (filterPlatform !== 'all') list = list.filter((c) => c.platform === filterPlatform);
    const term = search.trim().toLowerCase();
    if (term) {
      list = list.filter(
        (c) =>
          c.user_name?.toLowerCase().includes(term) ||
          c.user_external_id?.toLowerCase().includes(term) ||
          c.last_message?.toLowerCase().includes(term)
      );
    }
    return list;
  }, [conversations, filterPlatform, search]);

  const selectedConv = conversations.find((c) => c.id === selectedId) || null;
  const modelOptions = ALLOWED_MODELS[form.provider || 'openai'] || [];

  const renderPlatformIcon = (p: string, sz = 16) =>
    p === 'instagram' ? (
      <Instagram size={sz} className="text-pink-500" />
    ) : (
      <MessageSquare size={sz} className="text-green-500" />
    );

  return (
    <div className="space-y-4" data-testid="ai-inbox-tab">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 ${
            toast.ok
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
          data-testid="ai-inbox-toast"
        >
          {toast.ok ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span className="text-sm">{toast.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">AI Inbox</h2>
            <p className="text-xs text-gray-500">
              WhatsApp və Instagram mesajlarına süni intellektlə avtomatik cavab verin
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
              cfg.global_enabled
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-gray-50 text-gray-600 border border-gray-200'
            }`}
            data-testid="ai-inbox-status-badge"
          >
            {cfg.global_enabled ? <Bot size={14} /> : <BotOff size={14} />}
            AI {cfg.global_enabled ? 'Aktiv' : 'Söndürülüb'}
          </span>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200">
        {([
          { id: 'inbox', label: 'Söhbətlər', icon: Inbox },
          { id: 'settings', label: 'AI Parametrləri', icon: SettingsIcon },
          { id: 'setup', label: 'Quraşdırma', icon: ShieldCheck },
        ] as const).map((t) => {
          const Icon = t.icon;
          const isActive = activeSection === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveSection(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                isActive ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
              data-testid={`ai-inbox-section-${t.id}`}
            >
              <Icon size={16} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* === INBOX === */}
      {activeSection === 'inbox' && (
        <div className="grid grid-cols-1 lg:grid-cols-[340px,1fr] gap-4 min-h-[600px]">
          {/* Conversation list */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
            <div className="p-3 border-b border-gray-100 space-y-2">
              <div className="flex gap-1">
                {(['all', 'whatsapp', 'instagram'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setFilterPlatform(p)}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      filterPlatform === p
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                    }`}
                    data-testid={`filter-platform-${p}`}
                  >
                    {p === 'all' ? 'Hamısı' : p === 'whatsapp' ? 'WhatsApp' : 'Instagram'}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Axtarış…"
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
                  data-testid="inbox-search"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[60vh]">
              {filteredConvs.length === 0 && (
                <div className="p-6 text-center text-sm text-gray-500">
                  <Inbox size={24} className="mx-auto mb-2 text-gray-300" />
                  Söhbət yoxdur. Müştərilər mesaj yazanda burada görəcəksiniz.
                </div>
              )}
              {filteredConvs.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full text-left px-3 py-3 border-b border-gray-50 flex gap-3 hover:bg-gray-50 transition-colors ${
                    selectedId === c.id ? 'bg-indigo-50/50' : ''
                  }`}
                  data-testid={`conv-item-${c.id}`}
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center flex-shrink-0">
                    {renderPlatformIcon(c.platform, 16)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {c.user_name || c.user_external_id}
                      </span>
                      {c.unread_count > 0 && (
                        <span className="bg-indigo-600 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                          {c.unread_count}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 truncate mt-0.5">
                      {c.last_direction === 'outbound' ? '→ ' : ''}
                      {c.last_message}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                          c.ai_enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {c.ai_enabled ? <Bot size={10} /> : <BotOff size={10} />}
                        {c.ai_enabled ? 'AI aktiv' : 'AI off'}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Thread view */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden min-h-[600px]">
            {!selectedConv ? (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                <div className="text-center">
                  <MessageSquare size={36} className="mx-auto mb-3 text-gray-300" />
                  <p>Sol tərəfdən söhbət seçin</p>
                </div>
              </div>
            ) : (
              <>
                <div className="p-3 border-b border-gray-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                      {renderPlatformIcon(selectedConv.platform, 16)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {selectedConv.user_name || selectedConv.user_external_id}
                      </div>
                      <div className="text-[11px] text-gray-500 truncate">
                        {selectedConv.platform === 'whatsapp' ? 'WhatsApp' : 'Instagram'} ·{' '}
                        {selectedConv.user_external_id}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleConvAi(selectedConv.id, selectedConv.ai_enabled)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      selectedConv.ai_enabled
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                        : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                    }`}
                    data-testid="toggle-conv-ai"
                  >
                    {selectedConv.ai_enabled ? <Bot size={14} /> : <BotOff size={14} />}
                    AI {selectedConv.ai_enabled ? 'aktiv' : 'off'}
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50 max-h-[55vh]">
                  {messages.map((m) => {
                    const isOut = m.direction === 'outbound';
                    const byLabel = m.by === 'ai' ? 'AI' : m.by === 'admin' ? 'Admin' : '';
                    let ts: string | null = null;
                    if (m.created_at?.seconds) {
                      ts = new Date(m.created_at.seconds * 1000).toLocaleString('az-AZ');
                    }
                    return (
                      <div
                        key={m.id}
                        className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}
                        data-testid={`msg-${m.id}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                            isOut
                              ? m.by === 'ai'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-900 text-white'
                              : 'bg-white text-gray-900 border border-gray-200'
                          }`}
                        >
                          {byLabel && (
                            <div className={`text-[10px] font-semibold mb-0.5 ${isOut ? 'text-white/70' : 'text-gray-500'}`}>
                              {byLabel}
                            </div>
                          )}
                          <div className="whitespace-pre-wrap break-words">{m.text}</div>
                          {ts && (
                            <div className={`text-[10px] mt-1 ${isOut ? 'text-white/60' : 'text-gray-400'}`}>
                              {ts}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                <div className="p-3 border-t border-gray-100 bg-white">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendReply();
                        }
                      }}
                      placeholder="Manual cavab yaz…"
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
                      data-testid="reply-input"
                    />
                    <button
                      onClick={sendReply}
                      disabled={sending || !replyText.trim()}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
                      data-testid="reply-send-btn"
                    >
                      {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      Göndər
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1.5">
                    Bu söhbətdə AI {selectedConv.ai_enabled ? 'aktivdir' : 'söndürülüb'} — manual cavab göndəririk
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* === SETTINGS === */}
      {activeSection === 'settings' && (
        <div className="space-y-4">
          {/* Global toggles */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Avtomatik cavab</h3>
            <p className="text-xs text-gray-500 mb-4">
              AI-ın gələn mesajlara cavab verib-verməyəcəyini idarə edin.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { key: 'global_enabled', label: 'Bütün AI cavablar', desc: 'Ana açar' },
                { key: 'wa_enabled', label: 'WhatsApp', desc: 'WhatsApp mesajları' },
                { key: 'ig_enabled', label: 'Instagram', desc: 'Instagram DM-ləri' },
              ].map((t) => (
                <label
                  key={t.key}
                  className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:border-indigo-200 cursor-pointer transition-colors"
                  data-testid={`toggle-${t.key}`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 w-4 h-4 accent-indigo-600"
                    checked={Boolean((form as any)[t.key])}
                    onChange={(e) => setForm({ ...form, [t.key]: e.target.checked })}
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{t.label}</div>
                    <div className="text-xs text-gray-500">{t.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* AI Provider & Model */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-1">AI Model</h3>
            <p className="text-xs text-gray-500 mb-4">
              Hansı AI modelinin cavab verəcəyini seçin. Default OpenAI açarı saytın chat sistemində istifadə olunan açardır.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Provayder</label>
                <select
                  value={form.provider || 'openai'}
                  onChange={(e) => {
                    const p = e.target.value;
                    const first = ALLOWED_MODELS[p]?.[0] || '';
                    setForm({ ...form, provider: p, model: first });
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white"
                  data-testid="provider-select"
                >
                  {Object.keys(ALLOWED_MODELS).map((p) => (
                    <option key={p} value={p}>
                      {PROVIDER_LABEL[p] || p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Model</label>
                <select
                  value={form.model || ''}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white"
                  data-testid="model-select"
                >
                  {modelOptions.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-gray-50 border border-gray-200">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-indigo-600"
                  checked={Boolean(form.use_custom_key)}
                  onChange={(e) => setForm({ ...form, use_custom_key: e.target.checked })}
                  data-testid="use-custom-key"
                />
                <span className="text-sm font-medium text-gray-900">
                  Öz AI API açarımı istifadə et
                </span>
              </label>
              {form.use_custom_key && (
                <div className="mt-3">
                  <label className="text-xs text-gray-600 block mb-1">
                    API açarı{' '}
                    {cfg.custom_api_key && (
                      <span className="text-gray-400">
                        (cari: {maskToken(cfg.custom_api_key)})
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={form.custom_api_key || ''}
                      onChange={(e) => setForm({ ...form, custom_api_key: e.target.value })}
                      placeholder="sk-... və ya hər hansı API açarı"
                      className="w-full pr-9 px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      data-testid="custom-api-key-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Açar seçilmiş provayderə uyğun olmalıdır (OpenAI üçün OpenAI açarı, Anthropic üçün Claude açarı, və s.).
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Persona */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-1">AI Persona / Təlimat</h3>
            <p className="text-xs text-gray-500 mb-3">
              AI-ın necə cavab verəcəyini buradan idarə edin. Şirkətinizin tonu, dili, məhdudiyyətlər.
            </p>
            <textarea
              value={form.persona || ''}
              onChange={(e) => setForm({ ...form, persona: e.target.value })}
              rows={8}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-200"
              data-testid="persona-input"
            />
          </div>

          {/* WhatsApp credentials */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <MessageSquare size={16} className="text-green-600" /> WhatsApp
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              WhatsApp Cloud API (Meta) credentials. Əgər boş qalsa, mövcud Admin → WhatsApp tab-ından oxunur.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Phone Number ID</label>
                <input
                  type="text"
                  value={form.whatsapp_phone_id || ''}
                  onChange={(e) => setForm({ ...form, whatsapp_phone_id: e.target.value })}
                  placeholder="məs. 123456789012345"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  data-testid="wa-phone-id"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">API version</label>
                <input
                  type="text"
                  value={form.whatsapp_api_version || 'v22.0'}
                  onChange={(e) => setForm({ ...form, whatsapp_api_version: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="text-xs font-medium text-gray-700 block mb-1">
                Permanent Access Token{' '}
                {cfg.whatsapp_access_token && (
                  <span className="text-gray-400">(cari: {maskToken(cfg.whatsapp_access_token)})</span>
                )}
              </label>
              <div className="relative">
                <input
                  type={showWaToken ? 'text' : 'password'}
                  value={form.whatsapp_access_token || ''}
                  onChange={(e) => setForm({ ...form, whatsapp_access_token: e.target.value })}
                  placeholder="EAA..."
                  className="w-full pr-9 px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  data-testid="wa-token-input"
                />
                <button
                  type="button"
                  onClick={() => setShowWaToken(!showWaToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showWaToken ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>

          {/* Instagram credentials */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <Instagram size={16} className="text-pink-500" /> Instagram
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Instagram Business hesabınızın credential-ları (Meta Graph API).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">
                  Instagram Page ID (Facebook Page bağlı)
                </label>
                <input
                  type="text"
                  value={form.instagram_page_id || ''}
                  onChange={(e) => setForm({ ...form, instagram_page_id: e.target.value })}
                  placeholder="məs. 17841405793..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  data-testid="ig-page-id"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">API version</label>
                <input
                  type="text"
                  value={form.instagram_api_version || 'v22.0'}
                  onChange={(e) => setForm({ ...form, instagram_api_version: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="text-xs font-medium text-gray-700 block mb-1">
                Page Access Token{' '}
                {cfg.instagram_access_token && (
                  <span className="text-gray-400">(cari: {maskToken(cfg.instagram_access_token)})</span>
                )}
              </label>
              <div className="relative">
                <input
                  type={showIgToken ? 'text' : 'password'}
                  value={form.instagram_access_token || ''}
                  onChange={(e) => setForm({ ...form, instagram_access_token: e.target.value })}
                  placeholder="EAA..."
                  className="w-full pr-9 px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  data-testid="ig-token-input"
                />
                <button
                  type="button"
                  onClick={() => setShowIgToken(!showIgToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showIgToken ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>

          {/* Meta webhook security */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Meta Webhook Təhlükəsizliyi</h3>
            <p className="text-xs text-gray-500 mb-3">
              Meta-da webhook konfiqurasiya edərkən bu dəyərləri istifadə edəcəksiniz.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Verify Token</label>
                <input
                  type="text"
                  value={form.meta_verify_token || ''}
                  onChange={(e) => setForm({ ...form, meta_verify_token: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  data-testid="verify-token-input"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">
                  App Secret{' '}
                  {cfg.meta_app_secret && (
                    <span className="text-gray-400">(təyin edilib)</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type={showAppSecret ? 'text' : 'password'}
                    value={form.meta_app_secret || ''}
                    onChange={(e) => setForm({ ...form, meta_app_secret: e.target.value })}
                    placeholder="Meta app secret"
                    className="w-full pr-9 px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    data-testid="app-secret-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAppSecret(!showAppSecret)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showAppSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Save */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={saveSettings}
              disabled={saving}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
              data-testid="save-settings-btn"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Yadda saxla
            </button>
            <button
              onClick={() => setForm(cfg)}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200"
              data-testid="reload-settings-btn"
            >
              <RefreshCw size={16} />
              Sıfırla
            </button>
          </div>

          {/* AI Test panel */}
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <Wand2 size={16} className="text-indigo-600" />
              AI Cavabı Test Et
            </h3>
            <p className="text-xs text-gray-600 mb-3">
              Müştəri mesajı yazın, AI necə cavab verəcəyini yoxlayın (real göndərmə olmadan).
            </p>
            <textarea
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
              data-testid="ai-test-input"
            />
            <button
              onClick={runAiTest}
              disabled={testing || !testInput.trim()}
              className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
              data-testid="ai-test-btn"
            >
              {testing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Cavabı yarat
            </button>
            {testReply && (
              <div className="mt-3 p-3 bg-white rounded-lg border border-indigo-200" data-testid="ai-test-reply">
                <div className="text-[11px] font-semibold text-indigo-700 mb-1">AI cavabı:</div>
                <div className="text-sm text-gray-900 whitespace-pre-wrap">{testReply}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* === SETUP guide === */}
      {activeSection === 'setup' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-3">Webhook URL-ləri</h3>
            <p className="text-xs text-gray-500 mb-3">
              Meta-da Webhook konfiqurasiya edərkən aşağıdakı URL-ləri istifadə edin:
            </p>
            <div className="space-y-2">
              {[
                { label: 'WhatsApp', icon: MessageSquare, url: webhookUrls.whatsapp, color: 'text-green-600' },
                { label: 'Instagram', icon: Instagram, url: webhookUrls.instagram, color: 'text-pink-600' },
              ].map((w) => {
                const Icon = w.icon;
                return (
                  <div key={w.label} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                    <Icon size={16} className={w.color} />
                    <span className="text-sm font-medium text-gray-700 w-24">{w.label}</span>
                    <code className="flex-1 text-xs text-gray-900 font-mono truncate">{w.url}</code>
                    <button
                      onClick={() => copy(w.url)}
                      className="p-1.5 rounded hover:bg-gray-200 text-gray-600"
                      data-testid={`copy-webhook-${w.label.toLowerCase()}`}
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                );
              })}
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <ShieldCheck size={16} className="text-indigo-600" />
                <span className="text-sm font-medium text-gray-700 w-24">Verify Token</span>
                <code className="flex-1 text-xs text-gray-900 font-mono truncate">{cfg.meta_verify_token}</code>
                <button
                  onClick={() => copy(cfg.meta_verify_token)}
                  className="p-1.5 rounded hover:bg-gray-200 text-gray-600"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <MessageSquare size={16} className="text-green-600" /> WhatsApp Business API quraşdırılması
            </h3>
            <ol className="space-y-2 text-sm text-gray-700 list-decimal list-inside">
              <li>
                <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="text-indigo-600 underline">
                  developers.facebook.com
                </a>{' '}
                → My Apps → app-i seçin (yoxdursa Business app yaradın)
              </li>
              <li>Add Product → <b>WhatsApp</b> → Setup</li>
              <li>
                <b>Phone Number ID</b>, <b>Business Account ID</b> və <b>permanent access token</b> alın (System User vasitəsi ilə)
              </li>
              <li>
                Bunları yuxarıda Settings → <b>WhatsApp</b> bölməsinə daxil edin (və ya Admin → WhatsApp tab-ında)
              </li>
              <li>
                Configuration → Webhooks → <b>Callback URL</b>: yuxarıdakı WhatsApp URL-i; <b>Verify Token</b>: yuxarıdakı token; Subscribe to: <b>messages, message_status</b>
              </li>
              <li>
                App Settings → Basic → <b>App Secret</b>-i kopyalayıb yuxarıda Settings → Meta Webhook Təhlükəsizliyi-yə yapışdırın
              </li>
            </ol>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Instagram size={16} className="text-pink-600" /> Instagram Graph API quraşdırılması
            </h3>
            <ol className="space-y-2 text-sm text-gray-700 list-decimal list-inside">
              <li>Instagram hesabınızı <b>Professional / Business</b>-ə çevirin</li>
              <li>Facebook <b>Page</b>-ə bağlayın (Page Settings → Linked Accounts → Instagram)</li>
              <li>Eyni Meta app-ə Add Product → <b>Instagram</b> + <b>Messenger</b></li>
              <li>
                Graph API Explorer (
                <a className="text-indigo-600 underline" href="https://developers.facebook.com/tools/explorer" target="_blank" rel="noreferrer">
                  developers.facebook.com/tools/explorer
                </a>
                ) → <code className="bg-gray-100 px-1 rounded">me/accounts</code> → page seçin → <code className="bg-gray-100 px-1 rounded">instagram_business_account</code> götürün → <b>Page ID</b> və <b>Page Access Token</b> alın
              </li>
              <li>
                Tələb olunan icazələr: <code className="bg-gray-100 px-1 rounded text-[11px]">instagram_basic</code>,{' '}
                <code className="bg-gray-100 px-1 rounded text-[11px]">instagram_manage_messages</code>,{' '}
                <code className="bg-gray-100 px-1 rounded text-[11px]">pages_messaging</code>,{' '}
                <code className="bg-gray-100 px-1 rounded text-[11px]">pages_show_list</code>
              </li>
              <li>Page ID və Token-i yuxarıda Settings → Instagram bölməsində daxil edin</li>
              <li>
                App Dashboard → Messenger → Settings → Webhooks → <b>Add Callback URL</b> yuxarıdakı Instagram URL-i + Verify Token; Subscribe to: <b>messages</b>, <b>messaging_postbacks</b>
              </li>
              <li>Instagram → Webhooks → eyni URL-i əlavə edin və <b>messages</b>-ə subscribe edin</li>
            </ol>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
            <AlertCircle size={20} className="text-amber-600 flex-shrink-0" />
            <div className="text-sm text-amber-900">
              <b>Vacib:</b> Meta yalnız 24 saat ərzində müştərinin sizə yazdığı mesaja sərbəst cavab verməyə icazə verir. Bu pəncərə xaricində WhatsApp üçün təsdiqlənmiş template, Instagram üçün isə standart bir cavab tələb olunur.
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
            <ShieldCheck size={20} className="text-blue-600 flex-shrink-0" />
            <div className="text-sm text-blue-900">
              <b>Memarliq:</b> Bu funksiya tamamilə frontend-də (Vercel serverless functions + Firebase Firestore) işləyir — ayrı backend serverinə ehtiyac yoxdur. Webhooks <code>/api/webhooks/*</code> serverless function-ları tərəfindən işlənir, məlumatlar isə birbaşa Firestore-da saxlanılır.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AiInboxTab;
