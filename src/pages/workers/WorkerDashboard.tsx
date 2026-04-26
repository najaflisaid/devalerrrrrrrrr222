import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, LogOut, CalendarDays, AlertOctagon, Award, Clock,
  Send, Plus, TrendingUp, CheckCircle2, Hourglass, X,
  Bell, Briefcase, Activity, Trophy, Crown, Medal, FileText,
} from 'lucide-react';
import { useWorkerAuth } from '../../context/WorkerAuthContext';
import {
  startWork, endWork, getTodayAttendance, listAttendance,
  listFines, listRewards, listSales, listRequests, submitRequest,
  listNotifications, markNotificationRead,
  computeAttendancePercent, computePerformance, computeExperience,
  getMonthlyLeaderboard, monthYM, daysSince,
} from '../../services/workerService';
import type {
  AttendanceEntry, Fine, Reward, SalesEntry, WorkerRequest,
  RequestType, WorkerNotification, PerformanceBreakdown,
} from '../../types/worker';

const fmtDate = (iso: string) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('az-AZ'); } catch { return iso; }
};
const fmtTime = (iso?: string) => iso ? new Date(iso).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';

const VACATION_UNLOCK_MONTHS = 6;

// ─── Application templates
const REQUEST_TEMPLATES: Record<RequestType, string> = {
  leave: `Hörmətli rəhbərlik,

Mən ____ tarixindən ____ tarixinə qədər məzuniyyət istəyirəm.
Səbəb: ____

Hörmətlə,
[Ad Soyad]`,
  complaint: `Hörmətli rəhbərlik,

Aşağıdakı mövzuda şikayətim var:
____

Xahiş edirəm araşdıraraq cavab verəsiniz.

Hörmətlə,
[Ad Soyad]`,
  suggestion: `Hörmətli rəhbərlik,

İş prosesini yaxşılaşdırmaq üçün təklifim var:
____

Hörmətlə,
[Ad Soyad]`,
  other: `Hörmətli rəhbərlik,

Mövzu: ____
İzahat: ____

Hörmətlə,
[Ad Soyad]`,
};

const REQUEST_TYPE_LABEL: Record<RequestType, string> = {
  leave: 'Məzuniyyət',
  complaint: 'Şikayət',
  suggestion: 'Təklif',
  other: 'Digər',
};

const WorkerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { worker, loading, logout } = useWorkerAuth();

  const [today, setToday] = useState<AttendanceEntry | null>(null);
  const [attendance, setAttendance] = useState<AttendanceEntry[]>([]);
  const [attPercent, setAttPercent] = useState(0);
  const [fines, setFines] = useState<Fine[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [sales, setSales] = useState<SalesEntry[]>([]);
  const [requests, setRequests] = useState<WorkerRequest[]>([]);
  const [notifications, setNotifications] = useState<WorkerNotification[]>([]);
  const [perf, setPerf] = useState<PerformanceBreakdown | null>(null);
  const [leaderboard, setLeaderboard] = useState<Awaited<ReturnType<typeof getMonthlyLeaderboard>>>([]);

  const [busyClock, setBusyClock] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [reqType, setReqType] = useState<RequestType>('leave');
  const [reqDesc, setReqDesc] = useState(REQUEST_TEMPLATES.leave);
  const [submittingReq, setSubmittingReq] = useState(false);

  useEffect(() => { if (!loading && !worker) navigate('/workers', { replace: true }); }, [worker, loading, navigate]);

  const loadAll = async () => {
    if (!worker) return;
    const [t, a, p, f, r, s, rq, nots, pf, lb] = await Promise.all([
      getTodayAttendance(worker.id),
      listAttendance(worker.id, 31),
      computeAttendancePercent(worker.id),
      listFines(worker.id),
      listRewards(worker.id),
      listSales(worker.id, monthYM()),
      listRequests(worker.id),
      listNotifications(worker.id),
      computePerformance(worker),
      getMonthlyLeaderboard(),
    ]);
    setToday(t); setAttendance(a); setAttPercent(p);
    setFines(f); setRewards(r); setSales(s); setRequests(rq); setNotifications(nots);
    setPerf(pf); setLeaderboard(lb);
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [worker]);

  // Auto-fill template when type changes (only if textarea is empty or contains a template)
  useEffect(() => {
    setReqDesc(REQUEST_TEMPLATES[reqType]);
  }, [reqType]);

  const totalSales = useMemo(() => sales.reduce((s, x) => s + (x.amount || 0), 0), [sales]);
  const targetPercent = useMemo(() => {
    if (!worker?.monthlyTarget) return 0;
    return Math.min(100, Math.round((totalSales / worker.monthlyTarget) * 100));
  }, [totalSales, worker]);

  const experience = useMemo(
    () => worker ? computeExperience(worker.hireDate) : { years: 0, months: 0, days: 0, label: '—' },
    [worker]
  );

  const vacationStatus = useMemo(() => {
    if (!worker) return { locked: true, daysLeft: 0, openedAt: '' };
    const days = daysSince(worker.hireDate);
    const required = VACATION_UNLOCK_MONTHS * 30;
    const daysLeft = Math.max(0, required - days);
    return {
      locked: daysLeft > 0,
      daysLeft,
      openedAt: new Date(new Date(worker.hireDate).getTime() + required * 86400000).toISOString().slice(0, 10),
    };
  }, [worker]);

  const handleStart = async () => {
    if (!worker || busyClock) return;
    setBusyClock(true);
    try { const e = await startWork(worker.id); setToday(e); } finally { setBusyClock(false); }
  };
  const handleEnd = async () => {
    if (!worker || busyClock) return;
    setBusyClock(true);
    try { const e = await endWork(worker.id); if (e) setToday(e); await loadAll(); } finally { setBusyClock(false); }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!worker || !reqDesc.trim()) return;
    setSubmittingReq(true);
    try {
      await submitRequest({
        workerId: worker.id, type: reqType, description: reqDesc.trim(),
      });
      setReqDesc(REQUEST_TEMPLATES[reqType]);
      setShowRequestForm(false);
      await loadAll();
    } finally { setSubmittingReq(false); }
  };

  if (loading || !worker) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] text-[#D4AF37] font-semibold">De Valeur · İşçi Paneli</p>
            <h1 className="font-playfair text-xl text-black mt-0.5">Salam, {worker.name} 👋</h1>
          </div>
          <div className="flex items-center gap-2">
            <NotificationsBell items={notifications} unread={unreadCount} onRead={async (id) => { await markNotificationRead(id); await loadAll(); }} />
            <button onClick={async () => { await logout(); navigate('/workers'); }}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg" data-testid="worker-logout">
              <LogOut className="h-4 w-4" /> Çıxış
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* Profile + Performance row */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Profile */}
          <div className="md:col-span-2 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              <div className="w-24 h-24 rounded-full bg-gray-100 overflow-hidden border-2 border-[#D4AF37]/40 flex items-center justify-center text-2xl font-playfair text-gray-500 shrink-0">
                {worker.photo
                  ? <img src={worker.photo} alt={worker.name} className="w-full h-full object-cover" />
                  : <span>{worker.name?.[0]}{worker.surname?.[0]}</span>}
              </div>
              <div className="flex-1 min-w-0">
                {/* Experience badge — TOP */}
                <div className="inline-flex items-center gap-1.5 bg-[#FFF8E5] border border-[#D4AF37]/40 px-3 py-1 rounded-full mb-2">
                  <Briefcase className="h-3 w-3 text-[#8a6d10]" />
                  <span className="text-[11px] uppercase tracking-wider text-[#8a6d10] font-semibold" data-testid="worker-experience">
                    İş stajı: {experience.label}
                  </span>
                </div>
                <h2 className="font-playfair text-2xl text-black">{worker.name} {worker.surname}</h2>
                <p className="text-gray-500 text-sm mt-0.5">{worker.position}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-xs">
                  <div className="flex items-center gap-1.5 text-gray-600"><CalendarDays className="h-3.5 w-3.5" /> İşə başlama: <strong className="text-black">{fmtDate(worker.hireDate)}</strong></div>
                  <div className="flex items-center gap-1.5 text-gray-600"><CalendarDays className="h-3.5 w-3.5" /> Müqavilə: <strong className="text-black">{fmtDate(worker.contractStart)} – {fmtDate(worker.contractEnd)}</strong></div>
                </div>
              </div>
            </div>
          </div>

          {/* Performance % (rating) */}
          <div className="bg-gradient-to-br from-[#FFF8E5] to-white rounded-2xl border border-[#D4AF37]/40 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs uppercase tracking-wider text-[#8a6d10] font-semibold flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5" /> Performans Reytinqi
              </h3>
            </div>
            <div className="flex items-end gap-2">
              <span className="font-playfair text-5xl text-[#8a6d10] font-bold" data-testid="worker-performance-percent">{perf?.total ?? 0}%</span>
              <span className="text-xs text-gray-500 mb-2">/ 100%</span>
            </div>
            <div className="mt-3 h-2 bg-white rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#D4AF37] to-[#F3E2A5] transition-all duration-700"
                style={{ width: `${perf?.total ?? 0}%` }} />
            </div>
            {perf && (
              <div className="mt-4 grid grid-cols-3 gap-2 text-[10px]">
                <PerfMini label="Davamiyyət" value={`${perf.attendance}%`} />
                <PerfMini label="Vaxtında" value={`${perf.punctuality}%`} />
                <PerfMini label="Hədəf" value={`${perf.target}%`} />
              </div>
            )}
          </div>
        </section>

        {/* Attendance */}
        <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="font-playfair text-xl text-black mb-1">İş Günü</h3>
              <p className="text-sm text-gray-500">
                Bu gün:{' '}
                <span className="text-black font-medium">Başlama: {fmtTime(today?.startTime)}</span>{'  '}
                <span className="mx-1 text-gray-300">·</span>{'  '}
                <span className="text-black font-medium">Bitmə: {fmtTime(today?.endTime)}</span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-gray-500">Bu ay davamiyyət</div>
                <div className="text-lg font-semibold text-black">{attPercent}%</div>
              </div>
              <button onClick={handleStart} disabled={!!today?.startTime || busyClock}
                className="px-5 py-2.5 bg-black text-white rounded-lg uppercase tracking-[0.18em] text-xs font-medium hover:bg-[#C99B1F] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                data-testid="worker-clock-start">
                {busyClock && !today?.startTime && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <Clock className="h-3.5 w-3.5" /> İşə başla
              </button>
              <button onClick={handleEnd} disabled={!today?.startTime || !!today?.endTime || busyClock}
                className="px-5 py-2.5 border border-gray-300 text-gray-800 rounded-lg uppercase tracking-[0.18em] text-xs font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                data-testid="worker-clock-end">
                İşi sonlandır
              </button>
            </div>
          </div>

          {/* Daily log */}
          {attendance.length > 0 && (
            <div className="mt-3 border-t border-gray-100 pt-4">
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Gündəlik cədvəl (son 30 gün)</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                    <th className="py-2 pr-4">Tarix</th><th className="py-2 pr-4">Başlama</th><th className="py-2 pr-4">Bitmə</th><th className="py-2">Müddət</th>
                  </tr></thead>
                  <tbody>
                    {attendance.slice(0, 10).map(a => (
                      <tr key={a.id} className="border-b border-gray-50 last:border-0">
                        <td className="py-2 pr-4 font-medium">{fmtDate(a.date + 'T00:00:00')}</td>
                        <td className="py-2 pr-4">{fmtTime(a.startTime)}</td>
                        <td className="py-2 pr-4">{fmtTime(a.endTime)}</td>
                        <td className="py-2">{a.durationMs ? `${Math.floor(a.durationMs / 3600000)}s ${Math.floor((a.durationMs % 3600000) / 60000)}d` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* Targets / Performance */}
        <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-playfair text-xl text-black mb-1">Aylıq Hədəf</h3>
              <p className="text-sm text-gray-500">Bu ay üzrə şəxsi satış göstəriciləriniz</p>
            </div>
            <TrendingUp className="h-5 w-5 text-[#D4AF37]" />
          </div>
          <div className="mt-4">
            <div className="flex items-end justify-between mb-2">
              <div>
                <span className="font-playfair text-3xl text-black">{totalSales.toFixed(0)}</span>
                <span className="text-sm text-gray-500"> / {worker.monthlyTarget?.toFixed(0) || '—'} ₼</span>
              </div>
              <span className="text-2xl font-light text-[#D4AF37]">{targetPercent}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#D4AF37] to-[#F3E2A5] transition-all duration-700" style={{ width: `${targetPercent}%` }} />
            </div>
          </div>
        </section>

        {/* Leaderboard — monthly sales ranking (NAMES ONLY, no amounts) */}
        <LeaderboardSection items={leaderboard} currentId={worker.id} />

        {/* Vacation */}
        <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-playfair text-xl text-black mb-1">Məzuniyyət</h3>
              {vacationStatus.locked ? (
                <p className="text-sm text-gray-500">
                  Açılmasına <strong className="text-black">{vacationStatus.daysLeft} gün</strong> qalıb (təxminən {fmtDate(vacationStatus.openedAt)})
                </p>
              ) : (
                <p className="text-sm text-emerald-600">✓ Məzuniyyət açıqdır — istənilən vaxt müraciət edə bilərsiniz</p>
              )}
            </div>
            <button
              disabled={vacationStatus.locked}
              onClick={() => { setReqType('leave'); setReqDesc(REQUEST_TEMPLATES.leave); setShowRequestForm(true); }}
              className="px-5 py-2.5 border border-black text-black rounded-lg uppercase tracking-[0.18em] text-xs font-medium hover:bg-black hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              data-testid="worker-vacation-btn"
            >
              Məzuniyyətə çıx
            </button>
          </div>
        </section>

        {/* Fines & Rewards */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-playfair text-lg text-black flex items-center gap-2"><AlertOctagon className="h-4 w-4 text-red-500" /> Cərimələr ({fines.length})</h3>
            </div>
            {fines.length === 0 ? (
              <p className="text-sm text-gray-400">Cərimə qeydi yoxdur.</p>
            ) : (
              <ul className="space-y-2">
                {fines.map(f => (
                  <li key={f.id} className="flex items-start justify-between text-sm border-b border-gray-50 pb-2 last:border-0">
                    <div>
                      <p className="font-medium text-black">{f.reason}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{fmtDate(f.date)}</p>
                    </div>
                    <span className="text-red-600 font-medium">−{f.amount} ₼</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-playfair text-lg text-black flex items-center gap-2"><Award className="h-4 w-4 text-[#D4AF37]" /> Mükafatlar ({rewards.length})</h3>
            </div>
            {rewards.length === 0 ? (
              <p className="text-sm text-gray-400">Mükafat qeydi yoxdur.</p>
            ) : (
              <ul className="space-y-2">
                {rewards.map(r => (
                  <li key={r.id} className="flex items-start justify-between text-sm border-b border-gray-50 pb-2 last:border-0">
                    <div>
                      <p className="font-medium text-black">{r.reason}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{fmtDate(r.date)} · {r.type}</p>
                    </div>
                    {r.amount ? <span className="text-emerald-600 font-medium">+{r.amount} {r.type === 'raise' ? '%' : '₼'}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Notifications inline list */}
        <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-playfair text-xl text-black flex items-center gap-2">
              <Bell className="h-4 w-4 text-[#D4AF37]" /> Bildirişlər ({notifications.length})
              {unreadCount > 0 && <span className="text-[10px] bg-red-500 text-white rounded-full px-1.5 py-0.5">{unreadCount} yeni</span>}
            </h3>
          </div>
          {notifications.length === 0 ? (
            <p className="text-sm text-gray-400">Hələ bildiriş yoxdur.</p>
          ) : (
            <ul className="space-y-2 max-h-80 overflow-y-auto">
              {notifications.map(n => (
                <li key={n.id} className={`p-3 rounded-lg border ${!n.read ? 'border-[#D4AF37]/40 bg-[#FFF8E5]/50' : 'border-gray-100 bg-gray-50/40'} cursor-pointer`}
                    onClick={() => !n.read && markNotificationRead(n.id).then(loadAll)}
                    data-testid={`worker-notification-${n.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-black flex-1 whitespace-pre-line">{n.message}</p>
                    {!n.read && <span className="text-[9px] uppercase tracking-wider text-[#8a6d10] font-bold whitespace-nowrap">Yeni</span>}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">{new Date(n.createdAt).toLocaleString('az-AZ')}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Requests */}
        <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-playfair text-xl text-black flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-700" /> Ərizə və müraciətlər
            </h3>
            <button onClick={() => setShowRequestForm(s => !s)}
              className="flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-[0.18em] font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
              data-testid="worker-new-request-btn">
              <Plus className="h-3.5 w-3.5" /> {showRequestForm ? 'Bağla' : 'Yeni ərizə'}
            </button>
          </div>

          {showRequestForm && (
            <form onSubmit={handleSubmitRequest} className="bg-gray-50 rounded-xl p-4 space-y-3 mb-4">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-gray-600 mb-1">Ərizə növü</label>
                <select value={reqType} onChange={(e) => setReqType(e.target.value as RequestType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent" data-testid="worker-request-type">
                  {(Object.keys(REQUEST_TYPE_LABEL) as RequestType[]).map(k =>
                    <option key={k} value={k}>{REQUEST_TYPE_LABEL[k]}</option>
                  )}
                </select>
                <p className="text-[11px] text-gray-500 mt-1">Növü dəyişdirdikdə şablon avtomatik yenilənir. Aşağıda ____ yerlərini öz məlumatınızla doldurun.</p>
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-gray-600 mb-1">Ərizə mətni (şablon)</label>
                <textarea value={reqDesc} onChange={(e) => setReqDesc(e.target.value)} rows={10} required
                  placeholder="Şablon avtomatik dolacaq..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono resize-y focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
                  data-testid="worker-request-desc" />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setReqDesc(REQUEST_TEMPLATES[reqType])}
                  className="px-4 py-2 text-xs uppercase tracking-wider border border-gray-300 rounded-lg hover:bg-gray-100">
                  Şablonu sıfırla
                </button>
                <button type="submit" disabled={submittingReq}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg uppercase tracking-[0.18em] text-xs font-medium hover:bg-[#C99B1F] disabled:opacity-50"
                  data-testid="worker-request-submit">
                  {submittingReq ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Göndər
                </button>
              </div>
            </form>
          )}

          {requests.length === 0 ? (
            <p className="text-sm text-gray-400">Hələ heç bir müraciət yoxdur.</p>
          ) : (
            <ul className="space-y-3">
              {requests.map(r => <RequestRow key={r.id} item={r} />)}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
};

const PerfMini: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-white/80 rounded-lg px-2 py-1.5 border border-[#D4AF37]/20">
    <div className="text-gray-500 uppercase tracking-wider">{label}</div>
    <div className="text-gray-900 font-semibold text-sm">{value}</div>
  </div>
);

// ─── Leaderboard (names only, no amounts)
const LeaderboardSection: React.FC<{
  items: Awaited<ReturnType<typeof getMonthlyLeaderboard>>;
  currentId: string;
}> = ({ items, currentId }) => {
  if (items.length === 0) return null;
  const myRank = items.find(i => i.workerId === currentId);

  const rankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="h-4 w-4 text-[#D4AF37] fill-[#D4AF37]" />;
    if (rank === 2) return <Medal className="h-4 w-4 text-gray-400" />;
    if (rank === 3) return <Medal className="h-4 w-4 text-amber-700" />;
    return <span className="text-xs font-mono text-gray-500 w-4 text-center">{rank}</span>;
  };

  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm" data-testid="leaderboard-section">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-[#D4AF37]" />
          <h3 className="font-playfair text-xl text-black">Aylıq Reytinq</h3>
        </div>
        {myRank && (
          <span className="text-xs text-gray-500">
            Sənin yerin: <strong className="text-[#8a6d10]">#{myRank.rank}</strong>
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Bütün işçilərin aylıq satış sıralaması (məbləğlər məxfidir, yalnız ad-soyadlar göstərilir).
      </p>
      <ul className="divide-y divide-gray-100">
        {items.map(i => {
          const isMe = i.workerId === currentId;
          return (
            <li key={i.workerId}
              className={`flex items-center gap-3 py-3 px-2 rounded-lg ${isMe ? 'bg-[#FFF8E5]/60' : ''}`}
              data-testid={`leaderboard-row-${i.rank}`}>
              <div className="w-8 flex items-center justify-center">{rankIcon(i.rank)}</div>
              <div className="w-9 h-9 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center text-xs font-medium text-gray-600 shrink-0">
                {i.photo ? <img src={i.photo} alt="" className="w-full h-full object-cover" /> : `${i.name?.[0]}${i.surname?.[0]}`}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm truncate ${isMe ? 'font-bold text-[#8a6d10]' : 'font-medium text-gray-900'}`}>
                  {i.name} {i.surname}{isMe && <span className="ml-2 text-[10px] uppercase tracking-wider text-[#8a6d10]">· Sən</span>}
                </p>
                <p className="text-[11px] text-gray-500 truncate">{i.position}</p>
              </div>
              {!i.hasTotal && (
                <span className="text-[10px] uppercase tracking-wider text-gray-400">qeydiyyatda yoxdur</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

const RequestRow: React.FC<{ item: WorkerRequest }> = ({ item }) => {
  const StatusPill = () => {
    if (item.status === 'sent')
      return <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-amber-50 text-amber-700"><Hourglass className="h-3 w-3" /> Göndərildi</span>;
    if (item.status === 'review')
      return <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-blue-50 text-blue-700"><Hourglass className="h-3 w-3" /> Baxılır</span>;
    return <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-50 text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Həll olundu</span>;
  };
  return (
    <li className="border border-gray-100 rounded-lg p-3 text-sm">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-black">{REQUEST_TYPE_LABEL[item.type] || item.type}</p>
          <p className="text-gray-700 mt-1 whitespace-pre-line">{item.description}</p>
          {item.adminResponse && (
            <p className="mt-2 text-[12px] text-gray-700 bg-gray-50 rounded p-2"><strong>Admin cavabı:</strong> {item.adminResponse}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusPill />
          <span className="text-[10px] text-gray-400">{new Date(item.createdAt).toLocaleString('az-AZ')}</span>
        </div>
      </div>
    </li>
  );
};

const NotificationsBell: React.FC<{ items: WorkerNotification[]; unread: number; onRead: (id: string) => void }> = ({ items, unread, onRead }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className="relative p-2 rounded-lg hover:bg-gray-100" data-testid="worker-notifications-btn">
        <Bell className="h-5 w-5 text-gray-700" />
        {unread > 0 && <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white rounded-lg shadow-xl border border-gray-100 z-50">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-medium">Bildirişlər</span>
            <button onClick={() => setOpen(false)}><X className="h-4 w-4 text-gray-500" /></button>
          </div>
          {items.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">Bildiriş yoxdur</div>
          ) : (
            <ul>
              {items.map(n => (
                <li key={n.id} className={`p-3 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 ${!n.read ? 'bg-amber-50/30' : ''}`}
                    onClick={() => !n.read && onRead(n.id)}>
                  <p className="text-sm text-black whitespace-pre-line">{n.message}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{new Date(n.createdAt).toLocaleString('az-AZ')}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default WorkerDashboard;
