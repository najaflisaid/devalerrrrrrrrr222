import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, LogOut, CalendarDays, AlertOctagon, Award,
  Send, Plus, TrendingUp, CheckCircle2, Hourglass, X,
  Bell, Activity, Trophy, Crown, Medal, FileText, GraduationCap, Building2, ExternalLink,
} from 'lucide-react';
import { useWorkerAuth } from '../../context/WorkerAuthContext';
import {
  listFines, listRewards, listSales, listRequests, submitRequest,
  listNotifications, markNotificationRead,
  computePerformance, computeExperience,
  getMonthlyLeaderboard, getBranchLeaderboard,
  listTrainings, ensureBirthdayGreeting,
  monthYM, daysSince,
} from '../../services/workerService';
import type {
  Fine, Reward, SalesEntry, WorkerRequest,
  RequestType, WorkerNotification, PerformanceBreakdown, Training, BranchLeaderboardEntry,
} from '../../types/worker';

const TZ = 'Asia/Baku';

const fmtDate = (iso: string) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('az-AZ', { timeZone: TZ });
  } catch { return iso; }
};
const fmtTime = (iso?: string) => iso
  ? new Date(iso).toLocaleTimeString('az-AZ', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit' })
  : '—';
const fmtDateTime = (iso: string) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('az-AZ', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
};

const VACATION_UNLOCK_MONTHS = 6;

// ─── Application templates (with __NAME__ placeholder)
const REQUEST_TEMPLATES: Record<RequestType, string> = {
  leave: `Hörmətli rəhbərlik,

Mən ____ tarixindən ____ tarixinə qədər məzuniyyət istəyirəm.
Səbəb: ____

Hörmətlə,
__NAME__`,
  complaint: `Hörmətli rəhbərlik,

Aşağıdakı mövzuda şikayətim var:
____

Xahiş edirəm araşdıraraq cavab verəsiniz.

Hörmətlə,
__NAME__`,
  suggestion: `Hörmətli rəhbərlik,

İş prosesini yaxşılaşdırmaq üçün təklifim var:
____

Hörmətlə,
__NAME__`,
  explanation: `Hörmətli rəhbərlik,

Mövzu: ____
İzahatım: ____

Hörmətlə,
__NAME__`,
  other: `Hörmətli rəhbərlik,

Mövzu: ____
İzahat: ____

Hörmətlə,
__NAME__`,
};

// İşçinin ad-soyadını şablonda __NAME__ yerinə qoyur
const fillTemplate = (template: string, name: string, surname: string) =>
  template.replace(/__NAME__/g, `${name} ${surname}`);

const REQUEST_TYPE_LABEL: Record<RequestType, string> = {
  leave: 'Məzuniyyət',
  complaint: 'Şikayət',
  suggestion: 'Təklif',
  explanation: 'İzahat',
  other: 'Digər',
};

const WorkerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { worker, loading, logout } = useWorkerAuth();

  const [fines, setFines] = useState<Fine[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [sales, setSales] = useState<SalesEntry[]>([]);
  const [requests, setRequests] = useState<WorkerRequest[]>([]);
  const [notifications, setNotifications] = useState<WorkerNotification[]>([]);
  const [perf, setPerf] = useState<PerformanceBreakdown | null>(null);
  const [leaderboard, setLeaderboard] = useState<Awaited<ReturnType<typeof getMonthlyLeaderboard>>>([]);
  const [branchLeaderboard, setBranchLeaderboard] = useState<BranchLeaderboardEntry[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);

  const [showRequestForm, setShowRequestForm] = useState(false);
  const [reqType, setReqType] = useState<RequestType>('leave');
  const [reqDesc, setReqDesc] = useState('');
  const [submittingReq, setSubmittingReq] = useState(false);

  useEffect(() => { if (!loading && !worker) navigate('/workers', { replace: true }); }, [worker, loading, navigate]);

  const loadAll = async () => {
    if (!worker) return;
    // Doğum gününü yoxla və lazım gələrsə tebrik bildirişi yarat
    try { await ensureBirthdayGreeting(worker); } catch (err) { console.warn('Birthday greeting:', err); }

    const [f, r, s, rq, nots, pf, lb, blb, tr] = await Promise.all([
      listFines(worker.id),
      listRewards(worker.id),
      listSales(worker.id, monthYM()),
      listRequests(worker.id),
      listNotifications(worker.id),
      computePerformance(worker),
      getMonthlyLeaderboard(),
      getBranchLeaderboard(),
      listTrainings(),
    ]);
    setFines(f); setRewards(r); setSales(s); setRequests(rq); setNotifications(nots);
    setPerf(pf); setLeaderboard(lb); setBranchLeaderboard(blb); setTrainings(tr);
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [worker]);

  // Auto-fill template when type or worker changes — ad-soyad avtomatik yerləşir
  useEffect(() => {
    if (!worker) return;
    setReqDesc(fillTemplate(REQUEST_TEMPLATES[reqType], worker.name, worker.surname));
  }, [reqType, worker]);

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
    // Sayğacın başlanğıcı: əgər admin sıfırlayıbsa vacationResetAt, deyilsə hireDate
    const baseIso = worker.vacationResetAt || worker.hireDate;
    const days = daysSince(baseIso);
    const required = VACATION_UNLOCK_MONTHS * 30;
    const daysLeft = Math.max(0, required - days);
    return {
      locked: daysLeft > 0,
      daysLeft,
      openedAt: new Date(new Date(baseIso).getTime() + required * 86400000).toISOString().slice(0, 10),
    };
  }, [worker]);

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!worker || !reqDesc.trim()) return;
    setSubmittingReq(true);
    try {
      await submitRequest({
        workerId: worker.id, type: reqType, description: reqDesc.trim(),
      });
      setReqDesc(worker ? fillTemplate(REQUEST_TEMPLATES[reqType], worker.name, worker.surname) : '');
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
            <div className="flex flex-col sm:flex-row sm:items-center gap-6">
              <div className="w-36 h-36 rounded-full bg-gray-100 overflow-hidden border-2 border-[#D4AF37]/40 flex items-center justify-center text-3xl font-playfair text-gray-500 shrink-0">
                {worker.photo
                  ? <img src={worker.photo} alt={worker.name} className="w-full h-full object-cover" />
                  : <span>{worker.name?.[0]}{worker.surname?.[0]}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-playfair text-2xl text-black">{worker.name} {worker.surname}</h2>
                <p className="text-gray-500 text-sm mt-0.5">{worker.position}</p>

                {/* Profil cədvəli */}
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 mt-4 text-xs" data-testid="worker-profile-fields">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 w-32 shrink-0 uppercase tracking-wider text-[10px]">Filial:</span>
                    <strong className="text-black truncate">{worker.branch || '—'}</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 w-32 shrink-0 uppercase tracking-wider text-[10px]">Vəzifə:</span>
                    <strong className="text-black truncate">{worker.position || '—'}</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 w-32 shrink-0 uppercase tracking-wider text-[10px]">Təcrübə müddəti:</span>
                    <strong className="text-black">{experience.label}</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 w-32 shrink-0 uppercase tracking-wider text-[10px]">İşə başlama:</span>
                    <strong className="text-black">{fmtDate(worker.hireDate)}</strong>
                  </div>
                  <div className="flex items-center gap-2 sm:col-span-2">
                    <span className="text-gray-500 w-32 shrink-0 uppercase tracking-wider text-[10px]">Müqavilə müddəti:</span>
                    <strong className="text-black">{fmtDate(worker.contractStart)} – {fmtDate(worker.contractEnd)}</strong>
                  </div>
                  {worker.birthDate && (
                    <div className="flex items-center gap-2 sm:col-span-2">
                      <span className="text-gray-500 w-32 shrink-0 uppercase tracking-wider text-[10px]">Doğum tarixi:</span>
                      <strong className="text-black">{fmtDate(worker.birthDate)}</strong>
                    </div>
                  )}
                </dl>
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
                <PerfMini label="Satış" value={`${perf.salesScore}%`} />
                <PerfMini label="Mükafat" value={`+${perf.rewardsBonus}%`} />
                <PerfMini label="Cərimə" value={`${perf.finesPenalty}%`} />
              </div>
            )}
            <p className="text-[10px] text-gray-500 mt-3 leading-relaxed">
              Satışların yüksək olması, hədəfi tamamlamaq və mükafat almaq reytinqi qaldırır. Cərimələr reytinqi aşağı salır.
            </p>
          </div>
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

        {/* Branch leaderboard — filial üzrə komanda reytinqi */}
        <BranchLeaderboardSection items={branchLeaderboard} currentBranch={worker.branch || ''} />

        {/* Trainings — admin tərəfindən təyin edilmiş təlim materialları */}
        <TrainingsSection items={trainings} />

        {/* Fines & Rewards */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-playfair text-lg text-black flex items-center gap-2"><AlertOctagon className="h-4 w-4 text-red-500" /> Cərimələr ({fines.length})</h3>
            </div>
            {fines.length === 0 ? (
              <p className="text-sm text-gray-400">Cərimə qeydi yoxdur.</p>
            ) : (
              <>
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
                <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between" data-testid="fines-total">
                  <span className="text-xs uppercase tracking-wider text-gray-600 font-semibold">Ümumi cərimə</span>
                  <span className="text-red-600 font-bold text-base">−{fines.reduce((s, f) => s + (f.amount || 0), 0).toFixed(2)} ₼</span>
                </div>
              </>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-playfair text-lg text-black flex items-center gap-2"><Award className="h-4 w-4 text-[#D4AF37]" /> Mükafatlar ({rewards.length})</h3>
            </div>
            {rewards.length === 0 ? (
              <p className="text-sm text-gray-400">Mükafat qeydi yoxdur.</p>
            ) : (
              <>
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
                <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between" data-testid="rewards-total">
                  <span className="text-xs uppercase tracking-wider text-gray-600 font-semibold">Ümumi mükafat (₼)</span>
                  <span className="text-emerald-600 font-bold text-base">+{rewards.filter(r => r.type !== 'raise').reduce((s, r) => s + (r.amount || 0), 0).toFixed(2)} ₼</span>
                </div>
              </>
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
                  <p className="text-[10px] text-gray-500 mt-1">{fmtDateTime(n.createdAt)}</p>
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
                <p className="text-[11px] text-gray-500 mt-1">Aşağıdakı şablonu öz məlumatlarınızla doldurun. Adınız və soyadınız avtomatik yerləşdirilir. Mətni istədiyiniz kimi redaktə edə, silə və ya əlavə yaza bilərsiniz.</p>
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-gray-600 mb-1">Ərizə mətni</label>
                <textarea value={reqDesc} onChange={(e) => setReqDesc(e.target.value)} rows={10} required
                  placeholder="Şablon avtomatik dolacaq..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-[15px] leading-[1.7] resize-y focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
                  style={{ fontFamily: '"Playfair Display", "Inter", Georgia, serif' }}
                  data-testid="worker-request-desc" />
              </div>
              <div className="flex justify-end gap-2">
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

        {/* Vacation — ən aşağıda */}
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
              onClick={() => { setReqType('leave'); setReqDesc(worker ? fillTemplate(REQUEST_TEMPLATES.leave, worker.name, worker.surname) : ''); setShowRequestForm(true); }}
              className="px-5 py-2.5 border border-black text-black rounded-lg uppercase tracking-[0.18em] text-xs font-medium hover:bg-black hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              data-testid="worker-vacation-btn"
            >
              Məzuniyyətə çıx
            </button>
          </div>
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
        Bütün işçilərin aylıq satış sıralaması
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
                  {i.name} {i.surname}
                  {i.branch && (
                    <span className="ml-2 text-[10px] uppercase tracking-wider text-gray-500 font-medium">· {i.branch}</span>
                  )}
                  {isMe && <span className="ml-2 text-[10px] uppercase tracking-wider text-[#8a6d10]">· Sən</span>}
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

// ─── Branch leaderboard (filial üzrə komanda reytinqi)
const BranchLeaderboardSection: React.FC<{ items: BranchLeaderboardEntry[]; currentBranch: string }> = ({ items, currentBranch }) => {
  if (items.length === 0) return null;
  const rankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="h-4 w-4 text-[#D4AF37] fill-[#D4AF37]" />;
    if (rank === 2) return <Medal className="h-4 w-4 text-gray-400" />;
    if (rank === 3) return <Medal className="h-4 w-4 text-amber-700" />;
    return <span className="text-xs font-mono text-gray-500 w-4 text-center">{rank}</span>;
  };
  const totalAll = items.reduce((s, b) => s + b.totalSales, 0);
  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm" data-testid="branch-leaderboard-section">
      <div className="flex items-center gap-2 mb-3">
        <Building2 className="h-5 w-5 text-[#D4AF37]" />
        <h3 className="font-playfair text-xl text-black">Filiallar üzrə Komanda Reytinqi</h3>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Hansı filialın ümumi performansı qabaqdadır — komanda yarışı.
      </p>
      <ul className="divide-y divide-gray-100">
        {items.map(b => {
          const isMine = b.name === currentBranch;
          const sharePct = totalAll > 0 ? Math.round((b.totalSales / totalAll) * 100) : 0;
          return (
            <li key={b.name}
              className={`flex items-center gap-3 py-3 px-2 rounded-lg ${isMine ? 'bg-[#FFF8E5]/60' : ''}`}
              data-testid={`branch-rank-${b.rank}`}>
              <div className="w-8 flex items-center justify-center">{rankIcon(b.rank)}</div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm truncate ${isMine ? 'font-bold text-[#8a6d10]' : 'font-medium text-gray-900'}`}>
                  {b.name}
                  {isMine && <span className="ml-2 text-[10px] uppercase tracking-wider text-[#8a6d10]">· Mənim filialım</span>}
                </p>
                <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#D4AF37] to-[#F3E2A5]" style={{ width: `${sharePct}%` }} />
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-gray-500">{b.workerCount} işçi</p>
                <p className="text-sm font-semibold text-[#8a6d10]">{sharePct}%</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

// ─── Trainings section
const TrainingsSection: React.FC<{ items: Training[] }> = ({ items }) => {
  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm" data-testid="trainings-section">
      <div className="flex items-center gap-2 mb-3">
        <GraduationCap className="h-5 w-5 text-[#D4AF37]" />
        <h3 className="font-playfair text-xl text-black">Təlim Materialları</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">Hələ təlim materialı əlavə olunmayıb.</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map(t => (
            <li key={t.id} className="border border-gray-200 rounded-xl p-4 hover:border-[#D4AF37]/60 hover:bg-[#FFF8E5]/30 transition-colors" data-testid={`training-${t.id}`}>
              <a href={t.url} target="_blank" rel="noopener noreferrer" className="block">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-black truncate">{t.title}</p>
                    {t.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{t.description}</p>}
                  </div>
                  <ExternalLink className="h-4 w-4 text-[#D4AF37] shrink-0 mt-0.5" />
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

const RequestRow: React.FC<{ item: WorkerRequest }> = ({ item }) => {
  const StatusPill = () => {
    if (item.status === 'sent')
      return <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-amber-50 text-amber-700"><Hourglass className="h-3 w-3" /> Göndərildi</span>;
    if (item.status === 'review')
      return <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-blue-50 text-blue-700"><Hourglass className="h-3 w-3" /> Baxılır</span>;
    return <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-50 text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Təsdiq olundu</span>;
  };
  return (
    <li className="border border-gray-100 rounded-lg p-3 text-sm">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-black">{REQUEST_TYPE_LABEL[item.type] || item.type}</p>
          <p className="text-gray-700 mt-1 whitespace-pre-line">{item.description}</p>
          {item.adminResponse && (
            <p className="mt-2 text-[12px] text-gray-700 bg-gray-50 rounded p-2"><strong>Cavab:</strong> {item.adminResponse}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusPill />
          <span className="text-[10px] text-gray-400">{fmtDateTime(item.createdAt)}</span>
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
                  <p className="text-[10px] text-gray-400 mt-0.5">{fmtDateTime(n.createdAt)}</p>
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
