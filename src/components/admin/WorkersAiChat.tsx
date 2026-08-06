import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  BarChart3,
  Users,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  X,
  Trash2,
} from 'lucide-react';
import type { Worker, Fine, Reward, WorkerRequest } from '../../types/worker';
import {
  listWorkers,
  listAllRecentFines,
  listAllRecentRewards,
  listRequests,
} from '../../services/workerService';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * HR / team-analytics AI chat panel embedded inside the Workers admin tab.
 *
 * On mount it loads a snapshot of workers + fines + rewards + requests and
 * sends them along with every admin question to `/api/workers-chat`. The
 * backend composes a grounded system prompt from the data and lets Gemini
 * answer in natural language.
 */
const WorkersAiChat: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [fines, setFines] = useState<Fine[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [requests, setRequests] = useState<WorkerRequest[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const activeCount = useMemo(() => workers.filter((w) => w.isActive).length, [workers]);

  const loadSnapshot = async () => {
    setLoadingData(true);
    setDataError('');
    try {
      const [w, f, r, q] = await Promise.all([
        listWorkers(),
        listAllRecentFines(80),
        listAllRecentRewards(80),
        listRequests(),
      ]);
      setWorkers(w);
      setFines(f);
      setRewards(r);
      setRequests(q);
    } catch (e: any) {
      setDataError(e?.message || 'Məlumat yüklənmədi');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (open && workers.length === 0) {
      loadSnapshot();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, busy]);

  // ─── Compact worker payload (strip heavy fields, keep only what AI needs) ───
  const buildPayload = (userMsg: string) => ({
    message: userMsg,
    history: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    language: 'az',
    workers: workers.map((w) => ({
      id: w.id,
      name: w.name,
      surname: w.surname,
      position: w.position,
      branch: w.branch,
      hireDate: w.hireDate,
      isActive: w.isActive,
      rating: w.rating,
      monthlyTarget: w.monthlyTarget,
      monthlyTotalSales: w.monthlyTotalSales,
      monthlyTotalReturns: w.monthlyTotalReturns,
      salesHistory: w.salesHistory,
      returnsHistory: w.returnsHistory,
      targetsHistory: w.targetsHistory,
    })),
    fines: fines.map((f) => ({
      workerId: f.workerId,
      amount: f.amount,
      reason: f.reason,
      date: f.date,
    })),
    rewards: rewards.map((r) => ({
      workerId: r.workerId,
      type: r.type,
      amount: r.amount,
      reason: r.reason,
      date: r.date,
    })),
    requests: requests.map((r) => ({
      workerId: r.workerId,
      type: r.type,
      status: r.status,
      subject: r.subject || '',
      createdAt: r.createdAt || '',
    })),
  });

  const send = async (customMsg?: string) => {
    const raw = (customMsg ?? input).trim();
    if (!raw || busy) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: raw }]);
    setBusy(true);
    try {
      const res = await fetch('/api/workers-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(raw)),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setMessages((m) => [...m, { role: 'assistant', content: data.reply || 'Cavab yoxdur.' }]);
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: `⚠️ Xəta: ${e?.message || 'AI cavab verə bilmədi.'}` },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const suggestedQueries = [
    { icon: <TrendingUp className="h-3.5 w-3.5" />, label: 'Bu ay ən yaxşı 3 satıcı kimlərdir?' },
    { icon: <BarChart3 className="h-3.5 w-3.5" />, label: 'Hədəfi tamamlamayanları göstər' },
    { icon: <Users className="h-3.5 w-3.5" />, label: 'Filiallar üzrə orta performans necədir?' },
    { icon: <AlertCircle className="h-3.5 w-3.5" />, label: 'Son 30 gündə ən çox cərimə alan kimdir?' },
  ];

  // ─────────────── Collapsed card (button to open) ───────────────
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative w-full text-left bg-gradient-to-br from-[#111] via-[#2a1f0f] to-[#3a2c14] hover:from-black hover:to-[#4a3720] text-[#f5e7c1] border border-[#C9A24A]/40 hover:border-[#C9A24A] rounded-xl p-4 sm:p-5 transition-all overflow-hidden"
        data-testid="workers-ai-chat-open"
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#C9A24A]/15 border border-[#C9A24A]/30 flex items-center justify-center group-hover:bg-[#C9A24A]/25">
            <Sparkles className="h-5 w-5 text-[#C9A24A]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.24em] text-[#C9A24A]/80 mb-1">
              Admin AI
            </p>
            <p className="text-sm sm:text-base font-semibold text-[#f5e7c1]">
              Heyət haqqında AI ilə danış
            </p>
            <p className="text-[11px] sm:text-xs text-[#f5e7c1]/60 mt-0.5 line-clamp-2">
              Kimin performansı yaxşıdır, kimə diqqət lazımdır, satışlar necə gedir — soruş, cavab al.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-[10px] text-[#C9A24A]/60 pt-1 flex-shrink-0">
            <span>Aç</span>
            <span>→</span>
          </div>
        </div>
      </button>
    );
  }

  // ─────────────── Expanded chat panel ───────────────
  return (
    <div
      className="bg-white border border-[#C9A24A]/30 rounded-xl overflow-hidden shadow-sm"
      data-testid="workers-ai-chat-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 bg-gradient-to-r from-[#111] to-[#3a2c14] text-[#f5e7c1]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-[#C9A24A]/15 border border-[#C9A24A]/30 flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-4 w-4 text-[#C9A24A]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#C9A24A]/80">
              Heyət AI Assistenti
            </p>
            <p className="text-sm font-semibold truncate">
              {loadingData
                ? 'Məlumat yüklənir...'
                : `${workers.length} işçi (${activeCount} aktiv) · ${fines.length} cərimə · ${rewards.length} mükafat`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={loadSnapshot}
            disabled={loadingData}
            className="p-2 hover:bg-white/10 rounded-lg disabled:opacity-50"
            title="Yenilə"
            data-testid="workers-ai-refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loadingData ? 'animate-spin' : ''}`} />
          </button>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="p-2 hover:bg-white/10 rounded-lg"
              title="Söhbəti təmizlə"
              data-testid="workers-ai-clear"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            className="p-2 hover:bg-white/10 rounded-lg"
            title="Bağla"
            data-testid="workers-ai-close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {dataError && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-[12px] text-red-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          {dataError}
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        className="max-h-[420px] min-h-[220px] overflow-y-auto px-4 py-4 space-y-3 bg-gradient-to-b from-white to-[#faf8f2]"
        data-testid="workers-ai-messages"
      >
        {messages.length === 0 && !busy && (
          <div className="space-y-3">
            <div className="text-center py-2">
              <p className="text-sm text-gray-800">
                Salam! Mən De Valeur-un daxili <b>Heyət AI</b>-yıyam.
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                Komanda haqqında istənilən sual verin — bu ay satışlar, top-satıcılar, cərimələr, filial müqayisələri...
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {suggestedQueries.map((q, i) => (
                <button
                  key={i}
                  onClick={() => send(q.label)}
                  disabled={loadingData || busy}
                  className="text-left inline-flex items-start gap-2 px-3 py-2.5 bg-white border border-[#C9A24A]/25 hover:border-[#C9A24A]/60 hover:bg-[#faf5e6] rounded-lg text-[12px] text-gray-800 transition-all disabled:opacity-50"
                  data-testid={`workers-ai-suggest-${i}`}
                >
                  <span className="text-[#C9A24A] flex-shrink-0 mt-0.5">{q.icon}</span>
                  <span className="line-clamp-2">{q.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            data-testid={`workers-ai-msg-${i}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-[#111] text-white rounded-br-sm'
                  : 'bg-white border border-[#C9A24A]/25 text-gray-900 rounded-bl-sm'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex justify-start" data-testid="workers-ai-busy">
            <div className="bg-white border border-[#C9A24A]/25 rounded-2xl rounded-bl-sm px-4 py-3 inline-flex items-center gap-2 text-[12px] text-gray-600">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#C9A24A]" />
              Düşünürəm...
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="border-t border-gray-200 p-3 flex items-end gap-2 bg-white"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Məsələn: Ən yaxşı 5 satıcı kimlərdir?"
          rows={1}
          className="flex-1 resize-none px-3 py-2.5 text-[13px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C9A24A] focus:border-[#C9A24A] outline-none min-h-[44px] max-h-[100px]"
          data-testid="workers-ai-input"
          disabled={busy || loadingData}
        />
        <button
          type="submit"
          disabled={!input.trim() || busy || loadingData}
          className="inline-flex items-center justify-center h-[44px] px-4 bg-[#111] text-white rounded-lg hover:bg-black active:bg-black disabled:opacity-40 transition-all"
          data-testid="workers-ai-send"
          title="Göndər (Enter)"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
};

export default WorkersAiChat;
