import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2, Save, Sparkles, Building2, Tag, Shield, Package, FileText, CheckCircle2,
  MessageCircle, Power, MessageSquare, Plus, Trash2, Send, Users, TrendingUp,
  Clock, Search, Bot, PowerOff, MessageSquareText, BarChart3,
  Paperclip, Volume2, VolumeX, X, Copy, User, Phone, CheckCheck, Play,
} from 'lucide-react';
import {
  getAiKnowledge,
  saveAiKnowledge,
  EMPTY_KNOWLEDGE,
  type AiKnowledge,
  type ConversationExample,
} from '../../services/aiKnowledgeService';
import {
  subscribeAllSessions,
  subscribeSessionMessages,
  toggleSessionAi,
  deleteSession,
  logMessage,
  computeStats,
  formatRelativeTime,
  type ChatSessionMeta,
  type ChatSessionMessage,
  type ChatStats,
} from '../../services/chatSessionService';
import {
  saveAdminChatProfile,
  subscribeAdminChatProfile,
  DEFAULT_ADMIN_PROFILE,
  type AdminChatProfile,
} from '../../services/adminChatProfileService';
import { uploadImageToR2 } from '../../services/imageUploadService';
import {
  isAdminChatMuted,
  setAdminChatMuted,
} from '../../utils/chatSounds';
import { playNewSessionSound } from '../../utils/chatSounds';
import { consumePendingChatSession, onOpenChatSession } from '../../utils/adminChatBridge';

type SubTab = 'behavior' | 'examples' | 'stats' | 'conversations' | 'contacts';

// ─── Behavior fields config ─────────────────────────────────────────────
interface FieldConfig {
  key: keyof AiKnowledge;
  label: string;
  hint: string;
  placeholder: string;
  icon: React.ReactNode;
  color: string;
}

const FIELDS: FieldConfig[] = [
  {
    key: 'aiInstructions',
    label: 'AI Davranış Komandaları',
    hint: 'AI-yə müştərilərlə necə danışmasını izah edin: ton, sürət, satış strategiyası, qadağan sözlər və s.',
    placeholder: 'Müştərilərə həmişə "siz" formasında müraciət et.\nCavablar maks 3 cümlə olsun.\nƏn yüksək marja olan brendləri prioritet təklif et.',
    icon: <MessageCircle className="h-4 w-4" />,
    color: 'from-indigo-500 to-purple-500',
  },
  {
    key: 'companyInfo',
    label: 'Şirkət haqqında',
    hint: 'De Valeur-un tarixi, missiyası, ünvanları, iş saatları.',
    placeholder: 'De Valeur 2018-ci ildə Bakıda təsis olunmuş...\nİş saatları: B.e–Şən 10:00–20:00',
    icon: <Building2 className="h-4 w-4" />,
    color: 'from-blue-500 to-cyan-500',
  },
  {
    key: 'brandsInfo',
    label: 'Brendlər haqqında',
    hint: 'Hər brend üçün mənşə ölkə, tarix və xüsusiyyətlər.',
    placeholder: 'Festina — İspaniya, 1902.\nPierre Lannier — Fransa, 1977.',
    icon: <Tag className="h-4 w-4" />,
    color: 'from-amber-500 to-orange-500',
  },
  {
    key: 'policiesInfo',
    label: 'Zəmanət, çatdırılma və qaytarma',
    hint: 'Müştərilərin tez-tez soruşduğu siyasətlər.',
    placeholder: 'Zəmanət: 2 il.\nÇatdırılma: Bakı daxili pulsuz, regionlar 8 AZN.\nQaytarma: 14 gün.',
    icon: <Shield className="h-4 w-4" />,
    color: 'from-emerald-500 to-teal-500',
  },
  {
    key: 'productsInfo',
    label: 'Məhsullar haqqında əlavə qeydlər',
    hint: 'Konkret məhsullar/seriyalar haqqında xüsusi qeydlər.',
    placeholder: 'Festina Chrono kişi seriyası — xronoqraf funksiyası, 100m suya davamlı.',
    icon: <Package className="h-4 w-4" />,
    color: 'from-rose-500 to-pink-500',
  },
  {
    key: 'additionalNotes',
    label: 'Əlavə qeydlər və FAQ',
    hint: 'Tez-tez verilən suallar, kampaniyalar və s.',
    placeholder: 'Hazırda fəal kampaniya: 3 saat alana 4-cü 50% endirimlə.',
    icon: <FileText className="h-4 w-4" />,
    color: 'from-slate-500 to-gray-700',
  },
];

const newExampleId = () => 'ex-' + Math.random().toString(36).slice(2, 9);

// ═══════════════ Main component ═══════════════
const AiConsultantTab: React.FC = () => {
  const [subTab, setSubTab] = useState<SubTab>('behavior');
  const [data, setData] = useState<AiKnowledge>(EMPTY_KNOWLEDGE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pendingSelect, setPendingSelect] = useState<string | null>(null);

  // On mount: check if there's a pending session waiting (fired before mount)
  useEffect(() => {
    const sid = consumePendingChatSession();
    if (sid) {
      setSubTab('conversations');
      setPendingSelect(sid);
    }
    // Subscribe for future events (fired while mounted)
    const unsub = onOpenChatSession((sid2) => {
      setSubTab('conversations');
      setPendingSelect(sid2);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const k = await getAiKnowledge();
        setData({ ...k, conversationExamples: k.conversationExamples || [] });
      } finally { setLoading(false); }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveAiKnowledge(data);
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 3500);
    } catch (e) {
      alert('Yadda saxlanmadı: ' + (e as Error).message);
    } finally { setSaving(false); }
  };

  const updateField = (key: keyof AiKnowledge, value: any) =>
    setData((prev) => ({ ...prev, [key]: value }));

  const toggleEnabled = async () => {
    const next = !data.enabled;
    const optimistic = { ...data, enabled: next };
    setData(optimistic);
    setSaving(true);
    try {
      await saveAiKnowledge(optimistic);
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 3500);
    } catch (e) {
      setData((prev) => ({ ...prev, enabled: !next }));
      alert('Vəziyyət dəyişdirilə bilmədi: ' + (e as Error).message);
    } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-14">
        <Loader2 className="h-7 w-7 animate-spin text-gray-600" />
      </div>
    );
  }

  const SUB_TABS: Array<{ id: SubTab; label: string; icon: React.ReactNode; count?: number }> = [
    { id: 'behavior', label: 'AI Davranışları', icon: <Sparkles className="h-4 w-4" /> },
    { id: 'examples', label: 'Nümunələr', icon: <MessageSquareText className="h-4 w-4" />, count: (data.conversationExamples || []).length },
    { id: 'stats', label: 'Statistika', icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'conversations', label: 'Söhbətlər', icon: <MessageSquare className="h-4 w-4" /> },
    { id: 'contacts', label: 'Kontaktlar', icon: <Phone className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-5" data-testid="ai-consultant-tab">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
              <Sparkles className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 leading-tight">AI Konsultant</h2>
              <p className="text-xs text-gray-500 mt-0.5">Saytdakı canlı chat mərkəzi</p>
            </div>
          </div>
        </div>
        {(subTab === 'behavior' || subTab === 'examples') && (
          <div className="flex items-center gap-2">
            {savedAt && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full">
                <CheckCircle2 className="h-3.5 w-3.5" /> Yadda saxlandı
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium disabled:opacity-60 shadow-sm"
              data-testid="ai-consultant-save-btn"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Yadda saxla
            </button>
          </div>
        )}
      </div>

      {/* Instagram / Public link */}
      <div className="bg-gradient-to-r from-purple-50 via-fuchsia-50 to-amber-50 border border-purple-200/60 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900 text-sm">Instagram / WhatsApp bio linki</p>
            <p className="text-xs text-gray-600 mt-0.5 mb-2 leading-relaxed">
              Bu linki paylaşın — müştəri kliklədikdə tam-ekran AI konsultanta açılacaq.
            </p>
            <div className="flex items-center gap-2 bg-white rounded-lg border border-purple-200 px-3 py-2">
              <code className="text-xs text-purple-700 font-mono flex-1 truncate">https://devaleur.az/consultant</code>
              <button
                onClick={() => navigator.clipboard.writeText('https://devaleur.az/consultant').catch(() => undefined)}
                className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded bg-purple-500 hover:bg-purple-600 text-white font-medium"
                data-testid="copy-consultant-link"
              >
                <Copy className="h-3 w-3" /> Kopyala
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Enable toggle */}
      <div
        className={`rounded-xl p-4 border flex items-center justify-between gap-4 transition-colors ${
          data.enabled ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
        }`}
      >
        <div className="flex items-start gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${data.enabled ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
            <Power className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 text-sm">Saytda AI Chat görünüşü</p>
            <p className="text-xs text-gray-600 mt-0.5">
              {data.enabled ? 'AÇIQDIR — müştərilər chat düyməsini görür.' : 'BAĞLIDIR — chat gizlədilib.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleEnabled}
          disabled={saving}
          role="switch"
          aria-checked={data.enabled}
          className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-60 ${data.enabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
          data-testid="ai-chat-visibility-toggle"
        >
          <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${data.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>

      {/* Sub-tab nav */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        {SUB_TABS.map((t) => {
          const isActive = subTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                isActive ? 'border-amber-500 text-amber-700' : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
              data-testid={`ai-consultant-subtab-${t.id}`}
            >
              {t.icon}
              {t.label}
              {typeof t.count === 'number' && t.count > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-amber-100 text-amber-700 rounded-full">{t.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Sub-tab content */}
      {subTab === 'behavior' && <BehaviorSection data={data} onUpdate={updateField} />}
      {subTab === 'examples' && (
        <ExamplesSection
          examples={data.conversationExamples || []}
          onChange={(list) => updateField('conversationExamples', list)}
        />
      )}
      {subTab === 'stats' && <StatsSection />}
      {subTab === 'conversations' && (
        <ConversationsSection
          pendingSelect={pendingSelect}
          onSelectionHandled={() => setPendingSelect(null)}
        />
      )}
      {subTab === 'contacts' && (
        <ContactsSection onOpenConversation={(sid) => { setPendingSelect(sid); setSubTab('conversations'); }} />
      )}
    </div>
  );
};

// ═══════════════ Behavior sub-section (professional cleanup) ═══════════════
const BehaviorSection: React.FC<{
  data: AiKnowledge;
  onUpdate: (key: keyof AiKnowledge, value: any) => void;
}> = ({ data, onUpdate }) => (
  <div className="space-y-4">
    {/* Greet bubble — highlighted */}
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-5 py-3.5 border-b border-gray-100 bg-gradient-to-r from-amber-50/70 to-white flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-[#D4AF37] text-white flex items-center justify-center flex-shrink-0 shadow-sm">
          <MessageSquare className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-gray-900">Saytda göstərilən qısa mesaj</div>
          <div className="text-[11px] text-gray-500 mt-0.5">Chat düyməsinin yanında görünür — 30 saniyə sonra, 60 saniyə qalır</div>
        </div>
      </div>
      <div className="px-5 py-4">
        <input
          type="text"
          value={data.greetBubbleText || ''}
          onChange={(e) => onUpdate('greetBubbleText', e.target.value)}
          placeholder="Məsələn: Mütəxəssisdən tövsiyə al"
          maxLength={80}
          className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#D4AF37]/40 focus:border-[#D4AF37] transition-colors outline-none"
          data-testid="ai-knowledge-greetBubbleText"
        />
      </div>
    </div>

    {FIELDS.map((f) => {
      const value = (data[f.key] as string) || '';
      return (
        <div key={f.key} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          {/* Card header */}
          <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50 flex items-start gap-3">
            <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${f.color} text-white flex items-center justify-center flex-shrink-0 shadow-sm`}>
              {f.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold text-gray-900">{f.label}</div>
                <span className="text-[10px] text-gray-400 font-medium bg-white border border-gray-200 rounded-full px-2 py-0.5">
                  {value.length}/4000
                </span>
              </div>
              <div className="text-[12px] text-gray-500 mt-1 leading-relaxed">{f.hint}</div>
            </div>
          </div>
          <div className="px-5 py-4">
            <textarea
              value={value}
              onChange={(e) => onUpdate(f.key, e.target.value)}
              placeholder={f.placeholder}
              rows={5}
              maxLength={4000}
              className="w-full px-3.5 py-3 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-amber-300/40 focus:border-amber-400 outline-none resize-y transition-colors font-mono leading-relaxed"
              data-testid={`ai-knowledge-${f.key}`}
            />
          </div>
        </div>
      );
    })}
  </div>
);

// ═══════════════ Examples sub-section ═══════════════
const ExamplesSection: React.FC<{
  examples: ConversationExample[];
  onChange: (list: ConversationExample[]) => void;
}> = ({ examples, onChange }) => {
  const addExample = () => {
    onChange([...examples, { id: newExampleId(), userMessage: '', assistantMessage: '', note: '' }]);
  };
  const updateEx = (id: string, patch: Partial<ConversationExample>) => {
    onChange(examples.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };
  const removeEx = (id: string) => {
    if (!confirm('Bu nümunəni silmək istəyirsiniz?')) return;
    onChange(examples.filter((e) => e.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 flex items-start gap-3">
        <Sparkles className="h-5 w-5 flex-shrink-0 mt-0.5 text-amber-600" />
        <div>
          <p className="font-semibold mb-1">Nümunələr niyə vacibdir?</p>
          <p className="text-amber-800/80 leading-relaxed">
            AI hər söhbətdə bu nümunələrə baxaraq oxşar tərzdə cavab verməyi öyrənir (few-shot learning).
          </p>
        </div>
      </div>

      {examples.length === 0 && (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-8 text-center">
          <MessageSquareText className="h-8 w-8 mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-600 mb-4">Hələ heç bir nümunə yoxdur.</p>
          <button
            onClick={addExample}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium"
            data-testid="add-example-btn"
          >
            <Plus className="h-4 w-4" /> İlk nümunəni əlavə et
          </button>
        </div>
      )}

      {examples.map((ex, i) => (
        <div key={ex.id} className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3 shadow-sm" data-testid={`example-item-${ex.id}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
              Nümunə #{i + 1}
            </span>
            <button onClick={() => removeEx(ex.id)} className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg" data-testid={`remove-example-${ex.id}`}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block flex items-center gap-1"><User className="h-3 w-3" /> Müştəri yazır</label>
            <textarea
              value={ex.userMessage}
              onChange={(e) => updateEx(ex.id, { userMessage: e.target.value })}
              placeholder="Sportla məşğul olan həyat yoldaşıma saat axtarıram, büdcə 300 AZN"
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-y focus:ring-2 focus:ring-amber-300/40 focus:border-amber-400 outline-none bg-gray-50 focus:bg-white"
              data-testid={`example-user-${ex.id}`}
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block flex items-center gap-1"><Sparkles className="h-3 w-3" /> AI cavab verir</label>
            <textarea
              value={ex.assistantMessage}
              onChange={(e) => updateEx(ex.id, { assistantMessage: e.target.value })}
              placeholder="Əla seçim! Sportla məşğul olan biri üçün su-toz keçirməyən Casio modellərini tövsiyə edirəm..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-y focus:ring-2 focus:ring-amber-300/40 focus:border-amber-400 outline-none bg-gray-50 focus:bg-white"
              data-testid={`example-assistant-${ex.id}`}
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Qeyd (məcburi deyil)</label>
            <input
              type="text"
              value={ex.note || ''}
              onChange={(e) => updateEx(ex.id, { note: e.target.value })}
              placeholder="Məsələn: Sport / kişi hədiyyəsi ssenarisi"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-300/40 focus:border-amber-400 outline-none bg-gray-50 focus:bg-white"
              data-testid={`example-note-${ex.id}`}
            />
          </div>
        </div>
      ))}

      {examples.length > 0 && (
        <button
          onClick={addExample}
          className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-3 bg-white border border-dashed border-gray-300 hover:border-amber-400 hover:text-amber-700 text-gray-600 rounded-xl text-sm font-medium transition-colors"
          data-testid="add-more-example-btn"
        >
          <Plus className="h-4 w-4" /> Yeni nümunə əlavə et
        </button>
      )}
    </div>
  );
};

// ═══════════════ Statistics sub-section (professional) ═══════════════
const StatsSection: React.FC = () => {
  const [stats, setStats] = useState<ChatStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try { setStats(await computeStats()); }
    catch (e: any) {
      console.error('[AI Konsultant] Statistika yüklənmədi:', e);
      setError(e?.message || 'Statistika yüklənmədi');
    }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  if (loading) return <div className="flex items-center justify-center py-14"><Loader2 className="h-6 w-6 animate-spin text-gray-500" /></div>;
  if (error || !stats) return <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">{error || 'Məlumat yoxdur'}</div>;

  const primaryKPIs: Array<{ label: string; value: string | number; sub?: string; icon: React.ReactNode; color: string }> = [
    { label: 'Cəmi söhbət', value: stats.totalSessions.toLocaleString(), sub: `${stats.activeThisWeek} bu həftə`, icon: <Users className="h-5 w-5" />, color: 'from-blue-500 to-indigo-500' },
    { label: 'Bu gün aktiv', value: stats.activeToday, sub: 'son 24 saatda', icon: <TrendingUp className="h-5 w-5" />, color: 'from-emerald-500 to-teal-500' },
    { label: 'Cəmi mesaj', value: stats.totalMessages.toLocaleString(), sub: `${stats.totalUserMessages.toLocaleString()} müştəridən`, icon: <MessageSquare className="h-5 w-5" />, color: 'from-purple-500 to-pink-500' },
    { label: 'Orta müddət', value: `${stats.avgSessionDurationMin} dəq`, sub: `${stats.avgMessagesPerSession} mesaj/söhbət`, icon: <Clock className="h-5 w-5" />, color: 'from-amber-500 to-orange-500' },
  ];

  const conversionRate = stats.totalSessions > 0
    ? Math.round((stats.activeThisWeek / Math.max(stats.totalSessions, 1)) * 100)
    : 0;
  const imageRate = stats.totalSessions > 0
    ? Math.round((stats.totalWithImages / stats.totalSessions) * 100)
    : 0;

  return (
    <div className="space-y-5" data-testid="ai-stats-section">
      {/* Primary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {primaryKPIs.map((c) => (
          <div key={c.label} className="bg-white border border-gray-200 rounded-2xl p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center text-white shadow-sm`}>
                {c.icon}
              </div>
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900 leading-tight">{c.value}</div>
            <div className="text-xs text-gray-500 mt-1">{c.label}</div>
            {c.sub && <div className="text-[10px] text-gray-400 mt-1.5">{c.sub}</div>}
          </div>
        ))}
      </div>

      {/* Engagement + Progress rows */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-3">Angajman</div>
          <div className="space-y-3.5">
            <ProgressRow label="Cavablanma dərəcəsi" value={100} suffix="%" gradient="from-emerald-400 to-emerald-600" />
            <ProgressRow label="Bu həftə aktivlik" value={conversionRate} suffix="%" gradient="from-blue-400 to-indigo-500" />
            <ProgressRow label="Şəkilli söhbətlər" value={imageRate} suffix="%" gradient="from-pink-400 to-rose-500" />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 lg:col-span-2">
          <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-3 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            Müştərilərin ən çox soruşduqları
          </div>
          {stats.topKeywords.length === 0 ? (
            <p className="text-xs text-gray-500">Hələ kifayət qədər məlumat yoxdur.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {stats.topKeywords.slice(0, 20).map((k, i) => {
                const max = stats.topKeywords[0]?.count || 1;
                const intensity = Math.max(0.3, k.count / max);
                return (
                  <span
                    key={k.word}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/70 text-amber-900"
                    style={{ fontSize: `${11 + intensity * 3}px`, opacity: 0.6 + intensity * 0.4 }}
                    title={`${k.count} dəfə istifadə olunub`}
                  >
                    #{i + 1} · {k.word}
                    <span className="bg-white text-amber-700 rounded-full px-1.5 py-0.5 text-[10px] font-bold border border-amber-200">{k.count}</span>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Language breakdown */}
      {Object.keys(stats.languageBreakdown).length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-3">Dil bölgüsü</div>
          <div className="space-y-2.5">
            {Object.entries(stats.languageBreakdown).sort((a, b) => b[1] - a[1]).map(([lang, count]) => {
              const pct = Math.round((count / Math.max(stats.totalSessions, 1)) * 100);
              const badge: Record<string, { label: string; color: string }> = {
                az: { label: '🇦🇿 Azərbaycan', color: 'from-blue-500 to-teal-500' },
                en: { label: '🇬🇧 English', color: 'from-red-500 to-purple-500' },
                ru: { label: '🇷🇺 Русский', color: 'from-orange-500 to-red-500' },
              };
              const b = badge[lang] || { label: lang.toUpperCase(), color: 'from-slate-500 to-gray-700' };
              return (
                <div key={lang}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium text-gray-700">{b.label}</span>
                    <span className="text-gray-500 font-mono">{count} söhbət · {pct}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full bg-gradient-to-r ${b.color} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button onClick={load} className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white hover:bg-gray-800 rounded-lg text-sm font-medium" data-testid="refresh-stats-btn">
          <TrendingUp className="h-3.5 w-3.5" /> Yenilə
        </button>
        <span className="text-xs text-gray-400">Sonuncu yeniləmə: {new Date().toLocaleTimeString('az-AZ')}</span>
      </div>
    </div>
  );
};

const ProgressRow: React.FC<{ label: string; value: number; suffix?: string; gradient: string }> = ({ label, value, suffix, gradient }) => (
  <div>
    <div className="flex items-center justify-between text-xs mb-1">
      <span className="font-medium text-gray-700">{label}</span>
      <span className="text-gray-600 font-mono font-semibold">{value}{suffix}</span>
    </div>
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full bg-gradient-to-r ${gradient} rounded-full transition-all duration-500`} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  </div>
);


// ═══════════════ Contacts CRM (real customers with phone) ═══════════════
const ContactsSection: React.FC<{ onOpenConversation: (sessionId: string) => void }> = ({ onOpenConversation }) => {
  const [sessions, setSessions] = useState<ChatSessionMeta[]>([]);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeAllSessions(setSessions);
    return () => unsub();
  }, []);

  const contacts = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return sessions
      .filter((s) => s.contactCaptured && s.contactPhone)
      .filter((s) => {
        if (!q) return true;
        return (
          (s.contactName || '').toLowerCase().includes(q) ||
          (s.contactPhone || '').toLowerCase().includes(q) ||
          (s.lastMessage || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const av = (a.contactCapturedAt as any)?.seconds || (a.lastActive as any)?.seconds || 0;
        const bv = (b.contactCapturedAt as any)?.seconds || (b.lastActive as any)?.seconds || 0;
        return bv - av;
      });
  }, [sessions, search]);

  const copyText = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); }
    catch { /* ignore */ }
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
  };

  const exportCsv = () => {
    const rows = [['Ad', 'Telefon', 'İlk əlaqə', 'Son aktivlik', 'Son mesaj', 'Session ID']];
    contacts.forEach((c) => {
      const capturedAt = (c.contactCapturedAt as any)?.seconds
        ? new Date((c.contactCapturedAt as any).seconds * 1000).toISOString()
        : '';
      const lastAt = (c.lastActive as any)?.seconds
        ? new Date((c.lastActive as any).seconds * 1000).toISOString()
        : '';
      rows.push([
        c.contactName || '',
        c.contactPhone || '',
        capturedAt,
        lastAt,
        (c.lastMessage || '').replace(/[\r\n]+/g, ' ').slice(0, 200),
        c.id,
      ]);
    });
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `devaleur-kontaktlar-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const waLink = (phone: string, name?: string) => {
    const digits = phone.replace(/[^\d]/g, '');
    const msg = encodeURIComponent(
      `Salam${name ? ' ' + name : ''}, De Valeur-dan yazırıq. Saytdakı chat üzərindən bizə mesaj yazmışdınız — sizə necə kömək edə bilərik? 💫`
    );
    return `https://wa.me/${digits}?text=${msg}`;
  };

  return (
    <div className="space-y-4" data-testid="contacts-section">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Phone className="h-4 w-4 text-orange-500" />
            Real müştəri kontaktları
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">
              {contacts.length}
            </span>
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Chat-də telefon nömrəsini paylaşan ziyarətçilər — CRM üçün hazır.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ad və ya nömrə axtar…"
              className="pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 min-w-[220px]"
              data-testid="contacts-search"
            />
          </div>
          <button
            onClick={exportCsv}
            disabled={contacts.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
            data-testid="contacts-export-btn"
          >
            <FileText className="h-3.5 w-3.5" /> Excel/CSV export
          </button>
        </div>
      </div>

      {contacts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-orange-50 flex items-center justify-center mb-3">
            <Phone className="h-6 w-6 text-orange-400" />
          </div>
          <div className="text-sm font-semibold text-gray-800">Hələ real kontakt yoxdur</div>
          <div className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
            Müştəri chat-də telefon nömrəsi yazan kimi burada avtomatik görünəcək. AI 2-3 mesajdan sonra
            nəzakətlə nömrə soruşur — panelə real bildiriş də gəlir.
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/70 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="text-left px-4 py-2.5">Müştəri</th>
                  <th className="text-left px-4 py-2.5">Telefon</th>
                  <th className="text-left px-4 py-2.5 hidden md:table-cell">İlk əlaqə</th>
                  <th className="text-left px-4 py-2.5 hidden lg:table-cell">Son mesaj</th>
                  <th className="text-right px-4 py-2.5">Əməliyyat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {contacts.map((c) => (
                  <tr key={c.id} className="hover:bg-orange-50/40 transition-colors" data-testid={`contact-row-${c.id}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-200 to-rose-200 flex items-center justify-center text-rose-800 font-bold text-xs flex-shrink-0">
                          {c.contactName ? c.contactName.trim().slice(0, 2).toUpperCase() : c.id.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 truncate">
                            {c.contactName || <span className="text-gray-400 font-normal italic">Ad yoxdur</span>}
                          </div>
                          <div className="text-[10.5px] text-gray-500">
                            {(c.language || 'az').toUpperCase()} · {c.messageCount || 0} mesaj
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => copyText(c.contactPhone!, c.id + ':phone')}
                        className="font-mono text-[13px] text-orange-700 font-semibold hover:underline flex items-center gap-1.5 group"
                        data-testid={`contact-phone-${c.id}`}
                      >
                        <span>{c.contactPhone}</span>
                        {copied === c.id + ':phone'
                          ? <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          : <Copy className="h-3 w-3 text-gray-300 group-hover:text-gray-500" />}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 hidden md:table-cell">
                      {formatRelativeTime(c.contactCapturedAt || c.lastActive)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 max-w-xs hidden lg:table-cell">
                      <div className="truncate">{c.lastMessage || <span className="italic text-gray-400">(boş)</span>}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <a
                          href={waLink(c.contactPhone!, c.contactName)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                          title="WhatsApp-da yaz"
                          data-testid={`contact-wa-${c.id}`}
                        >
                          <MessageCircle className="h-3 w-3" /> WA
                        </a>
                        <a
                          href={`tel:${c.contactPhone}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                          title="Zəng et"
                          data-testid={`contact-call-${c.id}`}
                        >
                          <Phone className="h-3 w-3" /> Zəng
                        </a>
                        <button
                          onClick={() => onOpenConversation(c.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors"
                          title="Söhbətə keç"
                          data-testid={`contact-open-${c.id}`}
                        >
                          <MessageSquare className="h-3 w-3" /> Chat
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};


// ═══════════════ Conversations (WhatsApp-like) ═══════════════
const ConversationsSection: React.FC<{
  pendingSelect: string | null;
  onSelectionHandled: () => void;
}> = ({ pendingSelect, onSelectionHandled }) => {
  const [sessions, setSessions] = useState<ChatSessionMeta[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatSessionMessage[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [profile, setProfile] = useState<AdminChatProfile>(DEFAULT_ADMIN_PROFILE);
  const [muted, setMuted] = useState(isAdminChatMuted());
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [typingTick, setTypingTick] = useState(0);
  void typingTick; // used only to trigger re-render for stale typing indicator
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Force re-render every 2s while a session is selected — needed to hide
  // stale typing indicators (customerTyping might not be reset if browser closed).
  useEffect(() => {
    if (!selectedId) return;
    const t = setInterval(() => setTypingTick((x) => x + 1), 2000);
    return () => clearInterval(t);
  }, [selectedId]);

  useEffect(() => {
    const unsub = subscribeAllSessions(setSessions);
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeAdminChatProfile(setProfile);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (pendingSelect) {
      setSelectedId(pendingSelect);
      onSelectionHandled();
    }
  }, [pendingSelect, onSelectionHandled]);

  useEffect(() => {
    if (!selectedId) { setMessages([]); return; }
    const unsub = subscribeSessionMessages(selectedId, (msgs) => {
      setMessages(msgs);
    });
    return () => unsub();
  }, [selectedId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return sessions;
    return sessions.filter((s) =>
      (s.lastMessage || '').toLowerCase().includes(term) ||
      s.id.toLowerCase().includes(term) ||
      (s.language || '').toLowerCase().includes(term)
    );
  }, [sessions, search]);

  const current = sessions.find((s) => s.id === selectedId) || null;

  const handleToggleAi = async () => { if (current) await toggleSessionAi(current.id, !current.aiEnabled); };
  const handleDelete = async (id: string) => {
    if (!confirm('Bu söhbət silinsin? Bütün mesajlar da silinəcək.')) return;
    await deleteSession(id);
    if (selectedId === id) setSelectedId(null);
  };
  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Yalnız şəkil qəbul olunur'); return; }
    if (file.size > 8 * 1024 * 1024) { alert('Şəkil 8 MB-dan böyük ola bilməz'); return; }
    setUploading(true);
    try { setPendingImage(await uploadImageToR2(file, 'chat')); }
    catch (err: any) { alert('Şəkil yüklənmədi: ' + (err?.message || err)); }
    finally { setUploading(false); }
  };
  const handleSendReply = async () => {
    if (!selectedId || (!reply.trim() && !pendingImage)) return;
    setSending(true);
    try {
      await logMessage(selectedId, {
        role: 'admin',
        content: reply.trim(),
        imageUrl: pendingImage || undefined,
        byName: profile.displayName,
        byRole: profile.roleLabel,
      });
      setReply('');
      setPendingImage(null);
    } catch (e: any) { alert('Göndərmə uğursuz: ' + (e?.message || e)); }
    finally { setSending(false); }
  };

  const toggleMute = () => {
    const next = !muted;
    setAdminChatMuted(next);
    setMuted(next);
  };

  return (
    <div className="space-y-3" data-testid="ai-conversations-section">
      {/* Admin profile + sound toggle bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
            {profile.displayName.trim().charAt(0).toUpperCase() || 'K'}
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-white" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900 truncate">{profile.displayName}</div>
            <div className="text-[11px] text-gray-500 truncate">Müştəriyə bu ad görünür</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${muted ? 'bg-gray-100 text-gray-500 border-gray-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}
            title={muted ? 'Səslər söndürülüb — klikləyin ki açın' : 'Səslər aktivdir'}
            data-testid="admin-sound-toggle"
          >
            {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            {muted ? 'Səs off' : 'Səs açıq'}
          </button>
          <button
            onClick={() => {
              // Play sound even when muted so admin can preview it.
              const wasMuted = isAdminChatMuted();
              if (wasMuted) setAdminChatMuted(false);
              playNewSessionSound();
              if (wasMuted) setTimeout(() => setAdminChatMuted(true), 1500);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 transition-colors"
            title="Bildiriş səsini sınaqla dinlə"
            data-testid="admin-sound-test"
          >
            <Play className="h-3.5 w-3.5" />
            Sınaq
          </button>
          <button
            onClick={() => setShowProfileEditor(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-900 text-white hover:bg-gray-800"
            data-testid="edit-admin-profile"
          >
            <User className="h-3.5 w-3.5" /> Ad/soyad
          </button>
        </div>
      </div>

      {showProfileEditor && (
        <ProfileEditorModal
          profile={profile}
          onClose={() => setShowProfileEditor(false)}
          onSaved={(p) => { setProfile(p); setShowProfileEditor(false); }}
        />
      )}

      {/* WhatsApp-like split */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px,1fr] gap-3 h-[calc(100vh-260px)] min-h-[520px] max-h-[820px]">
        {/* Left: sessions list (narrower) */}
        <div className="bg-white rounded-2xl border border-gray-200 flex flex-col overflow-hidden h-full min-h-0">
          <div className="p-3 border-b border-gray-100 bg-gray-50/50 flex-shrink-0">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Axtarış…"
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-200 bg-white"
                data-testid="conversations-search"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {filtered.length === 0 && (
              <div className="p-6 text-center text-sm text-gray-500">
                <MessageSquare className="h-6 w-6 mx-auto mb-2 text-gray-300" />
                Söhbət yoxdur.
              </div>
            )}
            {filtered.map((s) => (
              <div
                key={s.id}
                className={`w-full text-left px-3 py-2.5 border-b border-gray-50 flex gap-2.5 hover:bg-gray-50 transition-colors cursor-pointer ${
                  selectedId === s.id
                    ? 'bg-amber-50/70 border-l-2 border-l-amber-500'
                    : s.contactCaptured
                    ? 'border-l-2 border-l-orange-400 bg-orange-50/30'
                    : 'border-l-2 border-l-transparent'
                }`}
                onClick={() => setSelectedId(s.id)}
                data-testid={`session-item-${s.id}`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs ${
                  s.contactCaptured
                    ? 'bg-gradient-to-br from-orange-200 to-rose-200 text-rose-800'
                    : 'bg-gradient-to-br from-amber-100 to-amber-200 text-amber-800'
                }`}>
                  {s.contactCaptured && s.contactName
                    ? s.contactName.trim().slice(0, 2).toUpperCase()
                    : s.id.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-gray-900 truncate flex items-center gap-1">
                      {s.contactCaptured && s.contactName
                        ? s.contactName
                        : `Müştəri ${s.id.slice(0, 6)}`}
                      {s.contactCaptured && (
                        <Phone className="h-3 w-3 text-orange-500 flex-shrink-0" strokeWidth={2.5} />
                      )}
                    </span>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">{formatRelativeTime(s.lastActive)}</span>
                  </div>
                  {s.contactCaptured && s.contactPhone && (
                    <div className="text-[10.5px] text-orange-700 font-mono truncate mt-0.5">
                      {s.contactPhone}
                    </div>
                  )}
                  <div className="text-[12px] text-gray-500 truncate mt-0.5">
                    {s.hasImage ? '🖼️ ' : ''}{s.lastMessage || '(boş)'}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded ${s.aiEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                      {s.aiEnabled ? <Bot className="h-2 w-2" /> : <PowerOff className="h-2 w-2" />}
                      {s.aiEnabled ? 'AI' : 'Manual'}
                    </span>
                    {s.contactCaptured && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-orange-500 text-white">
                        REAL
                      </span>
                    )}
                    <span className="text-[9px] text-gray-400">{s.messageCount || 0}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); void handleDelete(s.id); }}
                      className="ml-auto p-1 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded"
                      title="Söhbəti sil"
                      data-testid={`delete-session-${s.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: WhatsApp-like chat area (wider) */}
        <div className="bg-white rounded-2xl border border-gray-200 flex flex-col overflow-hidden h-full min-h-0" style={{ backgroundImage: 'radial-gradient(circle at top right, rgba(212,175,55,0.03) 0%, transparent 40%)' }}>
          {!current ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm p-6">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                  <MessageSquare className="h-7 w-7 text-gray-300" />
                </div>
                <p className="text-gray-500">Söhbəti seçin</p>
                <p className="text-[11px] text-gray-400 mt-1">Sol tərəfdən müştəri söhbətini seçib manual cavab verə bilərsiniz</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className={`px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-shrink-0 ${
                current.contactCaptured
                  ? 'bg-gradient-to-r from-orange-50 via-amber-50 to-rose-50 border-b-orange-200'
                  : 'bg-gradient-to-r from-white to-amber-50/40'
              }`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                    current.contactCaptured
                      ? 'bg-gradient-to-br from-orange-300 to-rose-300 text-rose-900'
                      : 'bg-gradient-to-br from-amber-200 to-amber-300 text-amber-900'
                  }`}>
                    {current.contactCaptured && current.contactName
                      ? current.contactName.trim().slice(0, 2).toUpperCase()
                      : current.id.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate flex items-center gap-1.5">
                      {current.contactCaptured && current.contactName
                        ? current.contactName
                        : `Müştəri ${current.id.slice(0, 6)}`}
                      {current.contactCaptured && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-orange-500 text-white">
                          <Phone className="h-2.5 w-2.5" strokeWidth={3} /> Real
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500 truncate flex items-center gap-1.5">
                      {current.contactCaptured && current.contactPhone && (
                        <>
                          <a
                            href={`tel:${current.contactPhone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-mono text-orange-700 font-semibold hover:underline"
                            data-testid="contact-phone-link"
                          >
                            {current.contactPhone}
                          </a>
                          <span className="text-gray-400">·</span>
                        </>
                      )}
                      <span>{(current.language || 'az').toUpperCase()} · {current.messageCount || 0} mesaj · {formatRelativeTime(current.lastActive)}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleToggleAi}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex-shrink-0 ${
                    current.aiEnabled
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-200'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  }`}
                  data-testid="toggle-conv-ai-btn"
                >
                  {current.aiEnabled ? <><Bot className="h-3.5 w-3.5" /> AI aktiv</> : <><User className="h-3.5 w-3.5" /> Manual</>}
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-2.5 bg-[#F5F0E5]/40">
                {(() => {
                  const readTsMs = (() => {
                    const v: any = (current as any)?.lastReadByCustomerTs;
                    if (!v) return 0;
                    if (typeof v.seconds === 'number') return v.seconds * 1000;
                    if (typeof v.toMillis === 'function') return v.toMillis();
                    return 0;
                  })();
                  return messages.map((m) => {
                  const isUser = m.role === 'user';
                  const isAdmin = m.role === 'admin';
                  const msgMs = (m.ts as any)?.seconds ? (m.ts as any).seconds * 1000 : 0;
                  const isRead = isAdmin && readTsMs > 0 && msgMs > 0 && readTsMs >= msgMs;
                  return (
                    <div key={m.id} className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                        isUser
                          ? 'bg-white border border-gray-200 text-gray-900 rounded-bl-sm'
                          : isAdmin
                          ? 'bg-[#DCF8C6] text-gray-900 rounded-br-sm'
                          : 'bg-indigo-600 text-white rounded-br-sm'
                      }`}>
                        {isAdmin && (
                          <div className="flex items-center gap-1 mb-1">
                            <span className="text-[10.5px] font-semibold text-emerald-700">{m.byName || profile.displayName}</span>
                          </div>
                        )}
                        {!isUser && !isAdmin && (
                          <div className="text-[10px] font-semibold text-white/70 mb-1">🤖 AI</div>
                        )}
                        {m.imageUrl && (
                          <a href={m.imageUrl} target="_blank" rel="noreferrer" className="block mb-1.5">
                            <img src={m.imageUrl} alt="Şəkil" className="rounded-lg max-h-52 object-cover" />
                          </a>
                        )}
                        {m.content && <div className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</div>}
                        <div className={`text-[10px] mt-1 text-right flex items-center justify-end gap-1 ${isUser ? 'text-gray-400' : isAdmin ? 'text-emerald-800/60' : 'text-white/60'}`}>
                          <span>{formatRelativeTime(m.ts)}</span>
                          {isAdmin && (
                            isRead
                              ? <CheckCheck className="h-3.5 w-3.5 text-sky-500" strokeWidth={2.4} data-testid={`admin-msg-read-${m.id}`} />
                              : <CheckCheck className="h-3.5 w-3.5 text-emerald-800/40" strokeWidth={2.2} data-testid={`admin-msg-sent-${m.id}`} />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                  });
                })()}
                {messages.length === 0 && (
                  <div className="text-center text-xs text-gray-400 py-8">Hələ mesaj yoxdur</div>
                )}
                {(() => {
                  const typingAtMs = (() => {
                    const v: any = (current as any)?.customerTypingAt;
                    if (!v) return 0;
                    if (typeof v.seconds === 'number') return v.seconds * 1000;
                    if (typeof v.toMillis === 'function') return v.toMillis();
                    return 0;
                  })();
                  // Only show typing if flag is on AND signal is recent (< 8s)
                  const isTyping =
                    !!(current as any)?.customerTyping &&
                    typingAtMs > 0 &&
                    Date.now() - typingAtMs < 8000;
                  if (!isTyping) return null;
                  return (
                    <div className="flex justify-start dv-typing-appear" data-testid="customer-typing-indicator">
                      <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-sm flex items-center gap-2">
                        <span className="text-[11px] font-medium text-gray-500">yazır</span>
                        <span className="flex items-end gap-0.5 h-3">
                          <span className="dv-dot" />
                          <span className="dv-dot" style={{ animationDelay: '0.15s' }} />
                          <span className="dv-dot" style={{ animationDelay: '0.3s' }} />
                        </span>
                      </div>
                    </div>
                  );
                })()}
                <div ref={chatEndRef} />
              </div>

              {/* Pending image preview */}
              {pendingImage && (
                <div className="px-3 py-2 border-t border-gray-100 bg-white flex items-center gap-2">
                  <div className="relative">
                    <img src={pendingImage} alt="preview" className="h-14 w-14 object-cover rounded-lg border border-gray-200" />
                    <button
                      onClick={() => setPendingImage(null)}
                      className="absolute -top-1.5 -right-1.5 bg-black text-white rounded-full p-0.5 hover:bg-red-600"
                      data-testid="admin-remove-image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <span className="text-[11px] text-gray-500">Şəkil göndərilməyə hazırdır</span>
                </div>
              )}

              {/* Composer */}
              <div className="p-3 border-t border-gray-100 bg-white flex-shrink-0">
                <div className="flex items-end gap-2">
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} data-testid="admin-file-input" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || sending}
                    className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full border border-gray-200 hover:border-amber-400 hover:text-amber-600 text-gray-500 transition-colors disabled:opacity-40"
                    title="Şəkil əlavə et"
                    data-testid="admin-attach-btn"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                  </button>
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSendReply(); } }}
                    placeholder={current.aiEnabled ? 'Manual cavab yaz (AI-nı da söndürmək istəyirsinizsə yuxarıdan)…' : 'Manual cavab yaz…'}
                    rows={1}
                    className="flex-1 resize-none px-4 py-2.5 text-sm border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 bg-gray-50 focus:bg-white max-h-32"
                    data-testid="admin-reply-input"
                  />
                  <button
                    onClick={handleSendReply}
                    disabled={sending || (!reply.trim() && !pendingImage)}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 flex-shrink-0 shadow-sm"
                    data-testid="admin-reply-send"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5 pl-2">
                  Müştəri sizin <strong className="text-gray-600">{profile.displayName}</strong> adınızı görəcək.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ═══════════════ Profile Editor Modal ═══════════════
const ProfileEditorModal: React.FC<{
  profile: AdminChatProfile;
  onClose: () => void;
  onSaved: (p: AdminChatProfile) => void;
}> = ({ profile, onClose, onSaved }) => {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const next: AdminChatProfile = {
        displayName: displayName.trim() || 'Konsultant',
        roleLabel: profile.roleLabel, // preserved but not shown to customer
      };
      await saveAdminChatProfile(next);
      onSaved(next);
    } catch (e: any) { alert('Yadda saxlanmadı: ' + (e?.message || e)); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Konsultant profili</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
          Müştəri sizin mesajlarınızda bu adı görəcək. İstədiyiniz takma ad yaza bilərsiniz.
        </p>

        <div>
          <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5 mb-1.5">
            <User className="h-3.5 w-3.5" /> Ad və soyad
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Aynur Məmmədova"
            maxLength={40}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none"
            data-testid="profile-name-input"
            autoFocus
          />
        </div>

        {/* Preview */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-[10px] uppercase font-semibold text-gray-400 mb-1.5">Öncədən görünüş (müştəri belə görəcək)</div>
          <div className="inline-block bg-[#D4AF37]/10 border border-[#D4AF37]/40 rounded-2xl rounded-bl-sm px-3.5 py-2.5">
            <div className="text-[12px] font-semibold text-black leading-tight">{displayName || 'Konsultant'}</div>
            <div className="text-[13px] text-black mt-1">Salam! Necə kömək edə bilərəm?</div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Ləğv et</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium disabled:opacity-60"
            data-testid="profile-save-btn"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Yadda saxla
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════ (New session toaster moved to AdminChatNotifier — qlobal mount edilir) ═══════════════

export default AiConsultantTab;
