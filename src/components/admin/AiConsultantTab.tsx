import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2, Save, Sparkles, Building2, Tag, Shield, Package, FileText, CheckCircle2,
  MessageCircle, Power, MessageSquare, Plus, Trash2, Send, Users, TrendingUp,
  Clock, Search, Bot, PowerOff, MessageSquareText, BarChart3,
  Paperclip, Volume2, VolumeX, X, Copy, User, Briefcase,
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
  playNewSessionSound,
  playAdminMessageSound,
  isAdminChatMuted,
  setAdminChatMuted,
} from '../../utils/chatSounds';

type SubTab = 'behavior' | 'examples' | 'stats' | 'conversations';

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
  ];

  return (
    <div className="space-y-5" data-testid="ai-consultant-tab">
      {/* New session toaster (renders regardless of tab) */}
      <NewSessionToaster
        onJump={(sid) => {
          setSubTab('conversations');
          setPendingSelect(sid);
        }}
      />

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
    catch (e: any) { setError(e?.message || 'Statistika yüklənmədi'); }
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
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastMsgCountRef = useRef<Record<string, number>>({});

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
      // Play sound if new user message came in AFTER first load
      const prevCount = lastMsgCountRef.current[selectedId] || 0;
      const userMsgs = msgs.filter((m) => m.role === 'user').length;
      if (prevCount > 0 && userMsgs > prevCount) {
        playAdminMessageSound();
      }
      lastMsgCountRef.current[selectedId] = userMsgs;
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
            <div className="text-[11px] text-gray-500 truncate">{profile.roleLabel} · Müştəriyə bu ad görünür</div>
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
      <div className="grid grid-cols-1 lg:grid-cols-[300px,1fr] gap-3 min-h-[640px]">
        {/* Left: sessions list (narrower) */}
        <div className="bg-white rounded-2xl border border-gray-200 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-gray-100 bg-gray-50/50">
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
          <div className="flex-1 overflow-y-auto max-h-[65vh]">
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
                  selectedId === s.id ? 'bg-amber-50/70 border-l-2 border-l-amber-500' : 'border-l-2 border-l-transparent'
                }`}
                onClick={() => setSelectedId(s.id)}
                data-testid={`session-item-${s.id}`}
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center flex-shrink-0 text-amber-800 font-bold text-xs">
                  {s.id.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-gray-900 truncate">
                      Müştəri {s.id.slice(0, 6)}
                    </span>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">{formatRelativeTime(s.lastActive)}</span>
                  </div>
                  <div className="text-[12px] text-gray-500 truncate mt-0.5">
                    {s.hasImage ? '🖼️ ' : ''}{s.lastMessage || '(boş)'}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded ${s.aiEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                      {s.aiEnabled ? <Bot className="h-2 w-2" /> : <PowerOff className="h-2 w-2" />}
                      {s.aiEnabled ? 'AI' : 'Manual'}
                    </span>
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
        <div className="bg-white rounded-2xl border border-gray-200 flex flex-col overflow-hidden min-h-[640px]" style={{ backgroundImage: 'radial-gradient(circle at top right, rgba(212,175,55,0.03) 0%, transparent 40%)' }}>
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
              <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-white to-amber-50/40 flex items-center justify-between gap-3 flex-shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-200 to-amber-300 flex items-center justify-center text-amber-900 font-bold text-sm flex-shrink-0">
                    {current.id.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">Müştəri {current.id.slice(0, 6)}</div>
                    <div className="text-[11px] text-gray-500 truncate">
                      {(current.language || 'az').toUpperCase()} · {current.messageCount || 0} mesaj · {formatRelativeTime(current.lastActive)}
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
              <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-[#F5F0E5]/40">
                {messages.map((m) => {
                  const isUser = m.role === 'user';
                  const isAdmin = m.role === 'admin';
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
                            <span className="text-[9px] text-gray-400">· {(m as any).byRole || profile.roleLabel}</span>
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
                        <div className={`text-[10px] mt-1 text-right ${isUser ? 'text-gray-400' : isAdmin ? 'text-emerald-800/50' : 'text-white/60'}`}>
                          {formatRelativeTime(m.ts)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {messages.length === 0 && (
                  <div className="text-center text-xs text-gray-400 py-8">Hələ mesaj yoxdur</div>
                )}
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
                  Müştəri sizin <strong className="text-gray-600">{profile.displayName}</strong> adı və <strong className="text-gray-600">{profile.roleLabel}</strong> rolunuzu görəcək.
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
  const [roleLabel, setRoleLabel] = useState(profile.roleLabel);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const next: AdminChatProfile = { displayName: displayName.trim() || 'Konsultant', roleLabel: roleLabel.trim() || 'Satış məsləhətçisi' };
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
          Müştəri sizin mesajlarınızda bu adı və rolu görəcək. Takma ad da yaza bilərsiniz.
        </p>

        <div className="space-y-3">
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
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5 mb-1.5">
              <Briefcase className="h-3.5 w-3.5" /> Rol / vəzifə
            </label>
            <input
              type="text"
              value={roleLabel}
              onChange={(e) => setRoleLabel(e.target.value)}
              placeholder="Satış məsləhətçisi"
              maxLength={40}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none"
              data-testid="profile-role-input"
            />
          </div>
        </div>

        {/* Preview */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-[10px] uppercase font-semibold text-gray-400 mb-1.5">Öncədən görünüş</div>
          <div className="inline-block bg-[#D4AF37]/10 border border-[#D4AF37]/40 rounded-2xl rounded-bl-sm px-3.5 py-2.5">
            <div className="text-[12px] font-semibold text-black leading-tight">{displayName || 'Konsultant'}</div>
            <div className="text-[9.5px] font-medium text-[#B8860B] uppercase tracking-wide mt-0.5">{roleLabel || 'Satış məsləhətçisi'}</div>
            <div className="text-[13px] text-black mt-1.5">Salam! Necə kömək edə bilərəm?</div>
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

// ═══════════════ New session toaster ═══════════════
const NewSessionToaster: React.FC<{ onJump: (sid: string) => void }> = ({ onJump }) => {
  const [newSessions, setNewSessions] = useState<ChatSessionMeta[]>([]);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);

  useEffect(() => {
    const unsub = subscribeAllSessions((all) => {
      if (isFirstLoadRef.current) {
        // Populate known set on first load (no notification for existing sessions)
        all.forEach((s) => knownIdsRef.current.add(s.id));
        isFirstLoadRef.current = false;
        return;
      }
      // Detect newly created sessions with at least 1 user message
      const fresh = all.filter((s) => !knownIdsRef.current.has(s.id) && (s.userMessageCount || 0) > 0);
      if (fresh.length > 0) {
        fresh.forEach((s) => knownIdsRef.current.add(s.id));
        setNewSessions((prev) => [...fresh, ...prev].slice(0, 4));
        playNewSessionSound();
      }
    });
    return () => unsub();
  }, []);

  const dismiss = (id: string) => setNewSessions((prev) => prev.filter((s) => s.id !== id));

  if (newSessions.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-6 z-[9999] flex flex-col gap-2 max-w-xs" data-testid="new-session-toaster">
      {newSessions.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => { onJump(s.id); dismiss(s.id); }}
          className="group bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl shadow-2xl shadow-emerald-500/40 px-4 py-3 pr-10 flex items-center gap-3 text-left animate-[slideUp_0.4s_ease-out] hover:from-emerald-600 hover:to-emerald-700 transition-colors relative"
          data-testid={`new-session-toast-${s.id}`}
        >
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <MessageSquare className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold">Yeni söhbət başladı!</div>
            <div className="text-[11px] text-white/85 truncate">
              Müştəri {s.id.slice(0, 6)} · <span className="underline">Söhbətə qoşul →</span>
            </div>
          </div>
          <span
            onClick={(e) => { e.stopPropagation(); dismiss(s.id); }}
            className="absolute top-1.5 right-1.5 p-1 rounded-full hover:bg-white/20"
          >
            <X className="h-3 w-3" />
          </span>
        </button>
      ))}
      <style>{`@keyframes slideUp {from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
    </div>
  );
};

export default AiConsultantTab;
