import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2, Plus, Search, Users, X, Edit2, Trash2, Save,
  AlertOctagon, Award as AwardIcon, TrendingUp,
  Inbox, CheckCircle2, Hourglass, BellPlus, Briefcase, Building2, GraduationCap, RotateCcw, Trophy, Activity,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { siteConfirm } from '../ui/NotificationProvider';
import { verifyPassword } from '../../services/adminPasswordService';
import {
  createWorker, listWorkers, updateWorker, deleteWorker,
  changeWorkerPassword,
  addFine, listFines, deleteFine, updateFine,
  addReward, listRewards, deleteReward, updateReward,
  addSale, listSales,
  listRequests, updateRequestStatus, deleteRequest,
  sendNotification,
  listPositions, addPosition, deletePosition, updatePosition,
  listBranches, addBranch, deleteBranch, updateBranch,
  listTrainings, addTraining, updateTraining, deleteTraining,
  resetVacation,
  computePerformance,
  setMonthlyTotal,
  setMonthlySalesHistory,
  monthYM,
} from '../../services/workerService';
import type {
  Worker, Fine, Reward, SalesEntry, WorkerRequest, RequestStatus, Position, Branch, Training,
  PerformanceBreakdown,
} from '../../types/worker';
import MonthlySalesChart from '../MonthlySalesChart';

type Mode = 'list' | 'create' | 'edit';

// Şifrə yoxlama modalı — redaktə əməliyyatları üçün
const askEditPassword = async (): Promise<boolean> => new Promise((resolve) => {
  const wrap = document.createElement('div');
  wrap.className = 'fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center px-4';
  wrap.innerHTML = `
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
      <div class="flex items-center gap-2 mb-3">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <h3 class="font-semibold text-gray-900">Redaktə kilidi</h3>
      </div>
      <p class="text-xs text-gray-600 mb-4">Bu əməliyyat üçün redaktə şifrəsini daxil edin.</p>
      <input type="password" id="__pw_input" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent" placeholder="Şifrə..." autofocus />
      <p id="__pw_err" class="hidden mt-2 text-xs text-red-600">Yanlış şifrə</p>
      <div class="mt-4 flex justify-end gap-2">
        <button id="__pw_cancel" class="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Ləğv et</button>
        <button id="__pw_ok" class="px-4 py-2 text-sm bg-black text-white rounded-lg hover:bg-gray-800">Təsdiq</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  const inp = wrap.querySelector('#__pw_input') as HTMLInputElement;
  const err = wrap.querySelector('#__pw_err') as HTMLElement;
  const close = (val: boolean) => { document.body.removeChild(wrap); resolve(val); };
  const tryOk = async () => {
    const ok = await verifyPassword('workersEdit', inp.value);
    if (ok) close(true); else { err.classList.remove('hidden'); inp.value = ''; inp.focus(); }
  };
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryOk(); if (e.key === 'Escape') close(false); });
  (wrap.querySelector('#__pw_ok') as HTMLElement).addEventListener('click', tryOk);
  (wrap.querySelector('#__pw_cancel') as HTMLElement).addEventListener('click', () => close(false));
  setTimeout(() => inp.focus(), 50);
});

const TZ = 'Asia/Baku';
const fmt = (iso: string) => iso
  ? new Date(iso).toLocaleDateString('az-AZ', { timeZone: TZ })
  : '—';
const fmtDateTime = (iso: string) => iso
  ? new Date(iso).toLocaleString('az-AZ', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  : '—';

const WorkersTab: React.FC = () => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<Mode>('list');
  const [editing, setEditing] = useState<Worker | null>(null);

  const [allRequests, setAllRequests] = useState<WorkerRequest[]>([]);

  const refresh = async () => {
    setLoading(true);
    try {
      const [w, r, p, b] = await Promise.all([listWorkers(), listRequests(), listPositions(), listBranches()]);
      setWorkers(w); setAllRequests(r); setPositions(p); setBranches(b);
      // Düzəliş: refresh-dən sonra editing state-i yenilə ki, dəyişikliklər dərhal görünsün
      setEditing(prev => prev ? (w.find(x => x.id === prev.id) || prev) : prev);
    } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return workers;
    return workers.filter(w =>
      `${w.name} ${w.surname} ${w.email} ${w.position} ${w.branch || ''}`.toLowerCase().includes(q)
    );
  }, [workers, search]);

  if (loading) {
    return <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-gray-500" /></div>;
  }

  if (mode === 'create') {
    return <WorkerForm positions={positions} branches={branches} onClose={() => setMode('list')} onSaved={async () => { setMode('list'); await refresh(); }} />;
  }
  if (mode === 'edit' && editing) {
    return <WorkerDetail worker={editing} positions={positions} branches={branches} onClose={() => { setEditing(null); setMode('list'); }} onUpdated={async () => { await refresh(); }} />;
  }

  return (
    <div className="space-y-6">
      {/* Workers list — ƏVVƏL gəlir, sürətli giriş üçün */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-gray-700" />
            <h2 className="text-xl font-bold text-gray-900">İşçilər ({filtered.length})</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Axtar..."
                className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent w-56"
                data-testid="workers-search" />
            </div>
            <button onClick={() => setMode('create')}
              className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800"
              data-testid="workers-add-btn">
              <Plus className="h-4 w-4" /> Yeni İşçi
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">Hələ heç bir işçi yoxdur. Yuxarıdan əlavə edə bilərsiniz.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wider text-gray-500 border-b border-gray-100">
                <th className="py-3 pr-4">İşçi</th>
                <th className="py-3 pr-4">Vəzifə</th>
                <th className="py-3 pr-4">Filial</th>
                <th className="py-3 pr-4">Email</th>
                <th className="py-3 pr-4">İşə başlama</th>
                <th className="py-3 pr-4">Hədəf (₼)</th>
                <th className="py-3 pr-4">Aylıq cəmi (₼)</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3"></th>
              </tr></thead>
              <tbody>
                {filtered.map(w => (
                  <tr key={w.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center text-xs font-medium text-gray-600">
                          {w.photo ? <img src={w.photo} alt={w.name} className="w-full h-full object-cover" /> : `${w.name?.[0]}${w.surname?.[0]}`}
                        </div>
                        <span className="font-medium text-gray-900">{w.name} {w.surname}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-gray-600">{w.position}</td>
                    <td className="py-3 pr-4 text-gray-600">{w.branch || <span className="text-gray-300">—</span>}</td>
                    <td className="py-3 pr-4 text-gray-600 text-xs">{w.email}</td>
                    <td className="py-3 pr-4 text-gray-600">{fmt(w.hireDate)}</td>
                    <td className="py-3 pr-4 text-gray-700">{w.monthlyTarget?.toLocaleString() || '—'}</td>
                    <td className="py-3 pr-4 text-gray-700">
                      {w.monthlyTotalMonth === monthYM() && typeof w.monthlyTotalSales === 'number'
                        ? w.monthlyTotalSales.toLocaleString()
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full ${w.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {w.isActive ? 'Aktiv' : 'Deaktiv'}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button onClick={() => { setEditing(w); setMode('edit'); }}
                        className="p-1.5 hover:bg-gray-100 rounded-lg" data-testid={`workers-edit-${w.id}`}>
                        <Edit2 className="h-3.5 w-3.5 text-gray-700" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Requests inbox */}
      <RequestsInbox items={allRequests} workers={workers} onUpdated={refresh} />

      {/* Aşağıda: Vəzifələr, Filiallar, Təlim — kompakt 2x2 grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PositionsPanel positions={positions} onChange={refresh} />
        <BranchesPanel branches={branches} onChange={refresh} />
        <div className="lg:col-span-2"><TrainingsPanel /></div>
      </div>
    </div>
  );
};

// ───────────────────── Positions Panel ─────────────────────
const PositionsPanel: React.FC<{ positions: Position[]; onChange: () => Promise<void> }> = ({ positions, onChange }) => {
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    try { await addPosition(newName); setNewName(''); await onChange(); }
    finally { setBusy(false); }
  };

  const saveEdit = async (id: string) => {
    if (!editVal.trim()) return;
    await updatePosition(id, editVal);
    setEditId(null); setEditVal('');
    await onChange();
  };

  const remove = async (p: Position) => {
    if (!await siteConfirm({ message: `"${p.name}" vəzifəsi silinsin?`, variant: 'danger', confirmLabel: 'Sil' })) return;
    await deletePosition(p.id);
    await onChange();
  };

  return (
    <details className="bg-white rounded-xl shadow-sm border border-gray-200 group">
      <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer list-none hover:bg-gray-50/60 rounded-xl">
        <Briefcase className="h-4 w-4 text-gray-700" />
        <h2 className="text-sm font-bold text-gray-900 flex-1">Vəzifələr <span className="text-gray-400 font-normal">({positions.length})</span></h2>
        <span className="text-xs text-gray-400 group-open:rotate-180 transition-transform">▾</span>
      </summary>
      <div className="px-4 pb-4 pt-1 border-t border-gray-100">
      <form onSubmit={submit} className="flex gap-2 mb-3">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Yeni vəzifə..."
          className={inp + ' flex-1 text-sm py-1.5'} data-testid="position-add-input" />
        <button disabled={busy || !newName.trim()}
          className="px-3 py-1.5 bg-black text-white rounded-lg text-xs font-medium hover:bg-gray-800 disabled:opacity-50 inline-flex items-center gap-1"
          data-testid="position-add-btn">
          <Plus className="h-3.5 w-3.5" /> Əlavə
        </button>
      </form>
      {positions.length === 0 ? (
        <p className="text-xs text-gray-400">Hələ vəzifə yoxdur.</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {positions.map(p => (
            <li key={p.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 border border-gray-100 rounded-md text-xs bg-gray-50/40">
              {editId === p.id ? (
                <>
                  <input value={editVal} onChange={(e) => setEditVal(e.target.value)} className={inp + ' flex-1 text-xs py-1'} autoFocus />
                  <button onClick={() => saveEdit(p.id)} className="p-1 hover:bg-emerald-50 rounded"><Save className="h-3 w-3 text-emerald-600" /></button>
                  <button onClick={() => { setEditId(null); setEditVal(''); }} className="p-1 hover:bg-gray-100 rounded"><X className="h-3 w-3 text-gray-500" /></button>
                </>
              ) : (
                <>
                  <span className="text-gray-800 font-medium truncate">{p.name}</span>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => { setEditId(p.id); setEditVal(p.name); }} className="p-1 hover:bg-gray-100 rounded" data-testid={`position-edit-${p.id}`}>
                      <Edit2 className="h-3 w-3 text-gray-600" />
                    </button>
                    <button onClick={() => remove(p)} className="p-1 hover:bg-red-50 rounded" data-testid={`position-delete-${p.id}`}>
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      </div>
    </details>
  );
};

// ───────────────────── Branches Panel (Filiallar) ─────────────────────
const BranchesPanel: React.FC<{ branches: Branch[]; onChange: () => Promise<void> }> = ({ branches, onChange }) => {
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    try { await addBranch(newName); setNewName(''); await onChange(); }
    finally { setBusy(false); }
  };

  const saveEdit = async (id: string) => {
    if (!editVal.trim()) return;
    await updateBranch(id, editVal);
    setEditId(null); setEditVal('');
    await onChange();
  };

  const remove = async (b: Branch) => {
    if (!await siteConfirm({ message: `"${b.name}" filialı silinsin?`, variant: 'danger', confirmLabel: 'Sil' })) return;
    await deleteBranch(b.id);
    await onChange();
  };

  return (
    <details className="bg-white rounded-xl shadow-sm border border-gray-200 group">
      <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer list-none hover:bg-gray-50/60 rounded-xl">
        <Building2 className="h-4 w-4 text-gray-700" />
        <h2 className="text-sm font-bold text-gray-900 flex-1">Filiallar <span className="text-gray-400 font-normal">({branches.length})</span></h2>
        <span className="text-xs text-gray-400 group-open:rotate-180 transition-transform">▾</span>
      </summary>
      <div className="px-4 pb-4 pt-1 border-t border-gray-100">
      <form onSubmit={submit} className="flex gap-2 mb-3">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Yeni filial..."
          className={inp + ' flex-1 text-sm py-1.5'} data-testid="branch-add-input" />
        <button disabled={busy || !newName.trim()}
          className="px-3 py-1.5 bg-black text-white rounded-lg text-xs font-medium hover:bg-gray-800 disabled:opacity-50 inline-flex items-center gap-1"
          data-testid="branch-add-btn">
          <Plus className="h-3.5 w-3.5" /> Əlavə
        </button>
      </form>
      {branches.length === 0 ? (
        <p className="text-xs text-gray-400">Hələ filial yoxdur.</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {branches.map(b => (
            <li key={b.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 border border-gray-100 rounded-md text-xs bg-gray-50/40">
              {editId === b.id ? (
                <>
                  <input value={editVal} onChange={(e) => setEditVal(e.target.value)} className={inp + ' flex-1 text-xs py-1'} autoFocus />
                  <button onClick={() => saveEdit(b.id)} className="p-1 hover:bg-emerald-50 rounded"><Save className="h-3 w-3 text-emerald-600" /></button>
                  <button onClick={() => { setEditId(null); setEditVal(''); }} className="p-1 hover:bg-gray-100 rounded"><X className="h-3 w-3 text-gray-500" /></button>
                </>
              ) : (
                <>
                  <span className="text-gray-800 font-medium truncate">{b.name}</span>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => { setEditId(b.id); setEditVal(b.name); }} className="p-1 hover:bg-gray-100 rounded" data-testid={`branch-edit-${b.id}`}>
                      <Edit2 className="h-3 w-3 text-gray-600" />
                    </button>
                    <button onClick={() => remove(b)} className="p-1 hover:bg-red-50 rounded" data-testid={`branch-delete-${b.id}`}>
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      </div>
    </details>
  );
};

// ───────────────────── Trainings Panel (Təlimlər) ─────────────────────
const TrainingsPanel: React.FC = () => {
  const [items, setItems] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ title: string; url: string; description: string }>({ title: '', url: '', description: '' });

  const refresh = async () => {
    setLoading(true);
    try { setItems(await listTrainings()); }
    finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;
    setBusy(true);
    try {
      await addTraining({ title: title.trim(), url: url.trim(), description: description.trim() });
      setTitle(''); setUrl(''); setDescription('');
      await refresh();
    } finally { setBusy(false); }
  };

  const saveEdit = async (id: string) => {
    if (!editData.title.trim() || !editData.url.trim()) return;
    await updateTraining(id, editData);
    setEditId(null);
    await refresh();
  };

  const remove = async (t: Training) => {
    if (!await siteConfirm({ message: `"${t.title}" təlim materialı silinsin?`, variant: 'danger', confirmLabel: 'Sil' })) return;
    await deleteTraining(t.id);
    await refresh();
  };

  return (
    <details className="bg-white rounded-xl shadow-sm border border-gray-200 group">
      <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer list-none hover:bg-gray-50/60 rounded-xl">
        <GraduationCap className="h-4 w-4 text-gray-700" />
        <h2 className="text-sm font-bold text-gray-900 flex-1">Təlim Materialları <span className="text-gray-400 font-normal">({items.length})</span></h2>
        <span className="text-xs text-gray-400 group-open:rotate-180 transition-transform">▾</span>
      </summary>
      <div className="px-4 pb-4 pt-1 border-t border-gray-100">
      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-12 gap-1.5 mb-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Başlıq" className={inp + ' md:col-span-3 text-xs py-1.5'} data-testid="training-title" />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://link..." type="url" className={inp + ' md:col-span-4 text-xs py-1.5'} data-testid="training-url" />
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Qısa təsvir" className={inp + ' md:col-span-4 text-xs py-1.5'} />
        <button disabled={busy || !title.trim() || !url.trim()}
          className="md:col-span-1 px-2 py-1.5 bg-black text-white rounded-lg text-xs font-medium hover:bg-gray-800 disabled:opacity-50 inline-flex items-center justify-center gap-1"
          data-testid="training-add-btn">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </form>

      {loading ? (
        <p className="text-xs text-gray-400">Yüklənir...</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-gray-400">Hələ təlim yoxdur.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map(t => (
            <li key={t.id} className="border border-gray-100 rounded-md p-2 bg-gray-50/40 text-xs" data-testid={`training-${t.id}`}>
              {editId === t.id ? (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-1.5">
                  <input value={editData.title} onChange={(e) => setEditData(d => ({ ...d, title: e.target.value }))} className={inp + ' md:col-span-3 text-xs py-1'} />
                  <input value={editData.url} onChange={(e) => setEditData(d => ({ ...d, url: e.target.value }))} className={inp + ' md:col-span-4 text-xs py-1'} />
                  <input value={editData.description} onChange={(e) => setEditData(d => ({ ...d, description: e.target.value }))} className={inp + ' md:col-span-4 text-xs py-1'} />
                  <div className="md:col-span-1 flex items-center gap-0.5">
                    <button onClick={() => saveEdit(t.id)} className="p-1 hover:bg-emerald-50 rounded"><Save className="h-3 w-3 text-emerald-600" /></button>
                    <button onClick={() => setEditId(null)} className="p-1 hover:bg-gray-100 rounded"><X className="h-3 w-3 text-gray-500" /></button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-black truncate">{t.title}</p>
                    <a href={t.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-600 hover:underline truncate block">{t.url}</a>
                    {t.description && <p className="text-[11px] text-gray-600 mt-0.5 line-clamp-1">{t.description}</p>}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => { setEditId(t.id); setEditData({ title: t.title, url: t.url, description: t.description || '' }); }} className="p-1 hover:bg-gray-100 rounded">
                      <Edit2 className="h-3 w-3 text-gray-600" />
                    </button>
                    <button onClick={() => remove(t)} className="p-1 hover:bg-red-50 rounded">
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      </div>
    </details>
  );
};

// ───────────────────── Vacation Panel (Məzuniyyət) ─────────────────────
const VacationPanel: React.FC<{ worker: Worker; onUpdated: () => Promise<void> }> = ({ worker, onUpdated }) => {
  const [resetAt, setResetAt] = useState<string>(worker.vacationResetAt || worker.hireDate);
  const [busy, setBusy] = useState(false);

  const dayMs = 86400000;
  const requiredDays = 6 * 30; // 6 ay
  const baseDate = new Date(resetAt);
  const today = new Date();
  const daysPassed = Math.max(0, Math.floor((today.getTime() - baseDate.getTime()) / dayMs));
  const daysLeft = Math.max(0, requiredDays - daysPassed);
  const percent = Math.min(100, Math.round((daysPassed / requiredDays) * 100));
  const unlockDate = new Date(baseDate.getTime() + requiredDays * dayMs);

  const handleReset = async () => {
    if (!await askEditPassword()) return;
    if (!await siteConfirm({
      message: `${worker.name} ${worker.surname} üçün məzuniyyət sayğacı sıfırlansın? (yenidən 6 ay sayılacaq)`,
      variant: 'default',
      confirmLabel: 'Sıfırla',
    })) return;
    setBusy(true);
    try {
      await resetVacation(worker.id);
      setResetAt(new Date().toISOString());
      await onUpdated();
    } finally { setBusy(false); }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4" data-testid="vacation-panel">
      <div className="flex items-center gap-2">
        <RotateCcw className="h-5 w-5 text-amber-700" />
        <h3 className="text-lg font-bold text-gray-900">Məzuniyyət Statusu</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Sayğac başladığı tarix</p>
          <p className="text-sm font-semibold text-gray-900">{baseDate.toLocaleDateString('az-AZ', { timeZone: TZ })}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Keçən gün</p>
          <p className="text-sm font-semibold text-gray-900">{daysPassed} gün</p>
        </div>
        <div className={`rounded-lg p-4 ${daysLeft === 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
          <p className="text-[10px] uppercase tracking-wider text-gray-700 mb-1">{daysLeft === 0 ? 'Status' : 'Qalan gün'}</p>
          <p className={`text-sm font-semibold ${daysLeft === 0 ? 'text-emerald-700' : 'text-amber-800'}`}>
            {daysLeft === 0 ? 'Açıqdır ✓' : `${daysLeft} gün`}
          </p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-600">İrəliləyiş</span>
          <span className="text-xs font-semibold text-gray-900">{percent}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full transition-all ${percent === 100 ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${percent}%` }} />
        </div>
        <p className="text-[11px] text-gray-500 mt-2">
          Açılma tarixi: <strong>{unlockDate.toLocaleDateString('az-AZ', { timeZone: TZ })}</strong>
        </p>
      </div>

      <div className="border-t border-gray-100 pt-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <p className="text-xs text-gray-600">
          İşçi məzuniyyətə çıxdıqdan sonra burdan sıfırlayın — 6 ay yenidən hesablanacaq.
        </p>
        <button
          onClick={handleReset}
          disabled={busy}
          data-testid="workers-reset-vacation"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm text-amber-800 border border-amber-300 rounded-lg hover:bg-amber-50 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          Məzuniyyəti sıfırla
        </button>
      </div>
    </div>
  );
};

// ───────────────────── Worker Form (create / edit) ─────────────────────
const WorkerForm: React.FC<{ positions: Position[]; branches: Branch[]; onClose: () => void; onSaved: () => void; existing?: Worker }> = ({ positions, branches, onClose, onSaved, existing }) => {
  const [name, setName] = useState(existing?.name || '');
  const [surname, setSurname] = useState(existing?.surname || '');
  const [email, setEmail] = useState(existing?.email || '');
  const [password, setPassword] = useState(existing?.loginPassword || '');
  const [showPassword, setShowPassword] = useState(false);
  const [position, setPosition] = useState(existing?.position || (positions[0]?.name || ''));
  const [branch, setBranch] = useState(existing?.branch || '');
  const [birthDate, setBirthDate] = useState(existing?.birthDate?.slice(0, 10) || '');
  const [hireDate, setHireDate] = useState(existing?.hireDate?.slice(0, 10) || new Date().toISOString().slice(0, 10));
  const [contractStart, setContractStart] = useState(existing?.contractStart?.slice(0, 10) || new Date().toISOString().slice(0, 10));
  const [contractEnd, setContractEnd] = useState(existing?.contractEnd?.slice(0, 10) || '');
  const [photo, setPhoto] = useState(existing?.photo || '');
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!position) { setErr('Zəhmət olmasa vəzifə seçin (yoxdursa yuxarıda əlavə edin).'); return; }
    if (!existing && password.length < 6) { setErr('Şifrə ən az 6 simvol olmalıdır.'); return; }
    setBusy(true);
    try {
      if (existing) {
        // Şifrə dəyişibsə Firebase Auth-da da yenilə
        const newPw = (password || '').trim();
        const oldPw = (existing.loginPassword || '').trim();
        if (newPw && newPw !== oldPw) {
          try {
            await changeWorkerPassword(existing.email, oldPw, newPw);
          } catch (e: any) {
            setBusy(false);
            setErr(`Auth şifrəsi dəyişilə bilmədi: ${e?.message || e}. Firestore qeydi yenilənmədi.`);
            return;
          }
        }
        await updateWorker(existing.id, {
          name, surname, position, branch: branch || '', photo: photo.trim(),
          birthDate: birthDate || '',
          hireDate, contractStart, contractEnd,
          loginPassword: newPw || oldPw,
          isActive,
        });
      } else {
        await createWorker(email.trim().toLowerCase(), password, {
          name, surname, position, branch: branch || '',
          birthDate: birthDate || '',
          hireDate, contractStart, contractEnd,
          monthlyTarget: 0,
          photo: photo.trim(),
          isActive,
        });
      }
      onSaved();
    } catch (e: any) {
      setErr(e?.message || 'Saxlanmadı.');
    } finally { setBusy(false); }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold">{existing ? 'İşçini redaktə et' : 'Yeni işçi əlavə et'}</h2>
        <button onClick={onClose}><X className="h-5 w-5 text-gray-500" /></button>
      </div>
      {err && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{err}</div>}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Ad *"><input required value={name} onChange={(e) => setName(e.target.value)} className={inp} data-testid="workers-form-name" /></Field>
        <Field label="Soyad *"><input required value={surname} onChange={(e) => setSurname(e.target.value)} className={inp} data-testid="workers-form-surname" /></Field>
        <Field label="Email *"><input required type="email" value={email} disabled={!!existing} onChange={(e) => setEmail(e.target.value)} className={inp + (existing ? ' bg-gray-50 text-gray-500' : '')} data-testid="workers-form-email" /></Field>
        <Field label={existing ? 'Daxilolma şifrəsi' : 'Şifrə * (ən az 6 simvol)'}>
          <div className="flex items-stretch gap-2">
            <input
              required={!existing}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={existing ? 'Şifrə (saxlandıqda yenilənir)' : 'Şifrə daxil edin'}
              className={inp + ' flex-1'}
              data-testid="workers-form-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(s => !s)}
              className="px-3 border border-gray-300 rounded-lg text-xs hover:bg-gray-50"
              data-testid="workers-form-password-toggle"
            >
              {showPassword ? 'Gizlət' : 'Göstər'}
            </button>
          </div>
          {existing && (
            <p className="text-[11px] text-amber-700 mt-1">
              ⚠ Şifrəni dəyişmək yalnız bu ekrandakı qeydi yeniləyir. Firebase Auth-dakı əsas şifrə yaratma anında təyin olunduğu üçün avtomatik dəyişməyə bilər — işçi köhnə şifrə ilə daxil ola bilərsə, müvafiq olaraq Firebase Auth-da əl ilə yeniləyin.
            </p>
          )}
        </Field>
        <Field label="Vəzifə *">
          {positions.length === 0 ? (
            <div className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">Əvvəlcə yuxarıdakı bölmədən vəzifə əlavə edin.</div>
          ) : (
            <select required value={position} onChange={(e) => setPosition(e.target.value)} className={inp} data-testid="workers-form-position">
              <option value="">Vəzifə seç...</option>
              {positions.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          )}
        </Field>
        <Field label="Filial">
          {branches.length === 0 ? (
            <div className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">Əvvəlcə yuxarıdakı bölmədən filial əlavə edin.</div>
          ) : (
            <select value={branch} onChange={(e) => setBranch(e.target.value)} className={inp} data-testid="workers-form-branch">
              <option value="">— Filial seçin —</option>
              {branches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
            </select>
          )}
        </Field>
        <Field label="İşə başlama tarixi *"><input required type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} className={inp} /></Field>
        <Field label="Doğum tarixi"><input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={inp} data-testid="workers-form-birthdate" /></Field>
        <Field label="Müqavilə başlama"><input type="date" value={contractStart} onChange={(e) => setContractStart(e.target.value)} className={inp} /></Field>
        <Field label="Müqavilə bitmə"><input type="date" value={contractEnd} onChange={(e) => setContractEnd(e.target.value)} className={inp} /></Field>
        <Field label="Şəkil URL (link)">
          <div className="flex items-center gap-3">
            {photo && (
              <img src={photo} alt="" className="w-12 h-12 rounded-full object-cover border border-gray-200" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            )}
            <input type="url" value={photo} onChange={(e) => setPhoto(e.target.value)} placeholder="https://..." className={inp} data-testid="workers-form-photo-url" />
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Şəkilin açıq linkini yapışdırın (məs: imgur, postimage, firebase storage və s.)</p>
        </Field>
        <Field label="Status">
          <label className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <span className="text-sm">{isActive ? 'Aktiv' : 'Deaktiv'}</span>
          </label>
        </Field>
        <div className="md:col-span-2 flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Ləğv et</button>
          <button type="submit" disabled={busy} className="inline-flex items-center gap-2 px-5 py-2 bg-black text-white rounded-lg text-sm font-medium disabled:opacity-50" data-testid="workers-form-submit">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} <Save className="h-4 w-4" /> Saxla
          </button>
        </div>
      </form>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-xs uppercase tracking-wider text-gray-600 mb-1">{label}</label>
    {children}
  </div>
);
const inp = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent';

// ───────────────────── Worker Detail (edit + fines/rewards/sales/notify/total) ─────────────────────
const WorkerDetail: React.FC<{ worker: Worker; positions: Position[]; branches: Branch[]; onClose: () => void; onUpdated: () => Promise<void> }> = ({ worker, positions, branches, onClose, onUpdated }) => {
  const [tab, setTab] = useState<'info' | 'fines' | 'rewards' | 'total' | 'vacation' | 'notify'>('info');
  const [fines, setFines] = useState<Fine[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [sales, setSales] = useState<SalesEntry[]>([]);
  const [perf, setPerf] = useState<PerformanceBreakdown | null>(null);

  const reload = async () => {
    const [f, r, s, p] = await Promise.all([
      listFines(worker.id),
      listRewards(worker.id),
      listSales(worker.id),
      computePerformance(worker),
    ]);
    setFines(f); setRewards(r); setSales(s); setPerf(p);
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [worker.id]);

  const handleDelete = async () => {
    if (!await askEditPassword()) return;
    if (!await siteConfirm({ message: `${worker.name} ${worker.surname} işçisi silinsin?`, variant: 'danger', confirmLabel: 'Sil' })) return;
    await deleteWorker(worker.id);
    await onUpdated();
    onClose();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="h-4 w-4 text-gray-500" /></button>
          <div>
            <h2 className="text-xl font-bold">{worker.name} {worker.surname}</h2>
            <p className="text-xs text-gray-500">{worker.position} · {worker.email}</p>
          </div>
        </div>
        <button onClick={handleDelete} className="inline-flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50" data-testid="workers-delete">
          <Trash2 className="h-3.5 w-3.5" /> Sil
        </button>
      </div>

      {/* Performance summary */}
      {perf && (
        <div className="mb-5 grid grid-cols-2 md:grid-cols-4 gap-3">
          <PerfCard label="Performans" value={`${perf.total}%`} highlight />
          <PerfCard label="Satış" value={`${perf.salesScore}%`} />
          <PerfCard label="Mükafat" value={perf.rewardsBonus > 0 ? `+${perf.rewardsBonus}%` : '0%'} />
          <PerfCard label="Cərimə" value={perf.finesPenalty < 0 ? `${perf.finesPenalty}%` : '0%'} />
        </div>
      )}

      <div className="flex border-b border-gray-100 mb-5 overflow-x-auto">
        {([
          ['info', 'Məlumat'],
          ['fines', 'Cərimələr'],
          ['rewards', 'Mükafatlar'],
          ['total', 'Aylıq satış'],
          ['vacation', 'Məzuniyyət'],
          ['notify', 'Bildiriş'],
        ] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${tab === k ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'info' && <WorkerForm positions={positions} branches={branches} existing={worker} onClose={onClose} onSaved={async () => { await onUpdated(); }} />}
      {tab === 'fines' && <FinesPanel workerId={worker.id} items={fines} reload={reload} />}
      {tab === 'rewards' && <RewardsPanel workerId={worker.id} items={rewards} reload={reload} />}
      {tab === 'total' && (
        <div className="space-y-5">
          <MonthlyTotalPanel worker={worker} onSaved={onUpdated} />
          <MonthlyHistoryPanel worker={worker} onSaved={onUpdated} />
        </div>
      )}
      {tab === 'vacation' && <VacationPanel worker={worker} onUpdated={onUpdated} />}
      {tab === 'notify' && <NotifyPanel workerId={worker.id} />}
    </div>
  );
};

const PerfCard: React.FC<{ label: string; value: string; highlight?: boolean }> = ({ label, value, highlight }) => (
  <div className={`rounded-lg p-3 border ${highlight ? 'border-[#D4AF37] bg-[#FFF8E5]' : 'border-gray-100 bg-gray-50/60'}`}>
    <div className="text-[10px] uppercase tracking-wider text-gray-500 flex items-center gap-1"><Activity className="h-3 w-3" /> {label}</div>
    <div className={`mt-1 font-semibold ${highlight ? 'text-2xl text-[#8a6d10]' : 'text-lg text-gray-800'}`}>{value}</div>
  </div>
);

// ─── Monthly Total panel (admin enters worker's monthly total sales for leaderboard + monthly target)
// User tələbi: Admin konkret ay üçün (məs. April / May) hədəf və ümumi satış qeyd edə bilər.
// Lakin admin/işçi UI-də konkret ay etiketi GÖRÜNMƏMƏLİDİR — sadəcə "Aylıq hədəf" görünür.
// Ay seçici yalnız admin saxla zamanı istifadə üçün gizli düyməcik kimi xidmət edir.
const MonthlyTotalPanel: React.FC<{ worker: Worker; onSaved: () => Promise<void> }> = ({ worker, onSaved }) => {
  const currentYM = monthYM();
  // Ay seçimi silindi — həmişə cari ay istifadə olunur
  const selectedYM = currentYM;
  const isCurrent = worker.monthlyTotalMonth === selectedYM;
  const history = worker.salesHistory || {};
  const targetsHistory = (worker as any).targetsHistory as Record<string, number> | undefined;

  const initialTotal = (selectedYM === worker.monthlyTotalMonth && typeof worker.monthlyTotalSales === 'number')
    ? String(worker.monthlyTotalSales)
    : (typeof history[selectedYM] === 'number' ? String(history[selectedYM]) : '');
  const initialTarget = targetsHistory && typeof targetsHistory[selectedYM] === 'number'
    ? String(targetsHistory[selectedYM])
    : (selectedYM === currentYM ? String(worker.monthlyTarget || '') : '');

  const [total, setTotal] = useState<string>(initialTotal);
  const [target, setTarget] = useState<string>(initialTarget);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const initialTotalRef = useRef<string>(initialTotal);
  const initialTargetRef = useRef<string>(initialTarget);

  // worker / selectedYM dəyişəndə state-i yenilə
  useEffect(() => {
    const newInitTotal = (selectedYM === worker.monthlyTotalMonth && typeof worker.monthlyTotalSales === 'number')
      ? String(worker.monthlyTotalSales)
      : (typeof history[selectedYM] === 'number' ? String(history[selectedYM]) : '');
    const newInitTarget = targetsHistory && typeof targetsHistory[selectedYM] === 'number'
      ? String(targetsHistory[selectedYM])
      : (selectedYM === currentYM ? String(worker.monthlyTarget || '') : '');
    setTotal(newInitTotal);
    setTarget(newInitTarget);
    initialTotalRef.current = newInitTotal;
    initialTargetRef.current = newInitTarget;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worker.id, worker.monthlyTotalSales, worker.monthlyTotalMonth, worker.monthlyTarget, selectedYM]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg('');
    try {
      const targetChanged = target.trim() !== initialTargetRef.current.trim();
      const totalChanged = total.trim() !== initialTotalRef.current.trim();

      if (!targetChanged && !totalChanged) {
        setSaved(true); setTimeout(() => setSaved(false), 2000);
        return;
      }

      // Hədəf seçilmiş aya yazılır — eyni zamanda cari ay üçündürsə monthlyTarget də yenilənir
      if (targetChanged) {
        const tNum = Number(target) || 0;
        const patch: any = { [`targetsHistory.${selectedYM}`]: tNum };
        if (selectedYM === currentYM) patch.monthlyTarget = tNum;
        await updateWorker(worker.id, patch);
      }
      // Ümumi satış seçilmiş aya yazılır
      if (totalChanged) {
        await setMonthlySalesHistory(worker.id, selectedYM, Number(total) || 0);
      }

      initialTotalRef.current = total;
      initialTargetRef.current = target;
      setSaved(true); setTimeout(() => setSaved(false), 2500);
      await onSaved();
    } catch (err: any) {
      console.error('MonthlyTotal save failed:', err);
      setErrorMsg(err?.message || 'Saxlamaq mümkün olmadı. Yenidən cəhd edin.');
    } finally { setBusy(false); }
  };

  const totalNum = Number(total) || 0;
  const targetNum = Number(target) || 0;
  const percent = targetNum > 0 ? Math.round((totalNum / targetNum) * 100) : 0;

  return (
    <div className="bg-gray-50/60 rounded-lg p-5 border border-gray-100 space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-[#D4AF37]" />
        <h3 className="font-semibold text-gray-900">Aylıq satış</h3>
      </div>
      <p className="text-xs text-gray-600">
        İşçinin <strong>aylıq satış hədəfini</strong> və <strong>ümumi satışını</strong> daxil edin.
        İşçi panelində və ümumi cədvəldə ay etiketi göstərilmir, sadəcə "Aylıq hədəf" yazılır.
      </p>
      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs uppercase tracking-wider text-gray-600 mb-1">Aylıq satış hədəfi (₼)</label>
          <input type="number" min={0} value={target} onChange={(e) => setTarget(e.target.value)} className={inp} placeholder="0" data-testid="monthly-target-input" />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-gray-600 mb-1">Ümumi satış (₼)</label>
          <input type="number" min={0} value={total} onChange={(e) => setTotal(e.target.value)} className={inp} placeholder="0" data-testid="monthly-total-input" />
        </div>

        {targetNum > 0 && (
          <div className="md:col-span-2">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-600">Hədəfin yerinə yetirilməsi</span>
              <span className={`font-semibold ${percent >= 100 ? 'text-emerald-600' : 'text-[#8a6d10]'}`}>{percent}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full transition-all ${percent >= 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-[#D4AF37] to-[#F3E2A5]'}`} style={{ width: `${Math.min(100, percent)}%` }} />
            </div>
          </div>
        )}

        <div className="md:col-span-2 flex items-center gap-3 flex-wrap">
          <button disabled={busy} className="px-5 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 inline-flex items-center gap-2" data-testid="monthly-total-save">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} <Save className="h-4 w-4" /> Saxla
          </button>
          {saved && <span className="text-xs text-emerald-600 inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Saxlanıldı</span>}
          {errorMsg && <span className="text-xs text-red-600">{errorMsg}</span>}
        </div>
      </form>
    </div>
  );
};

// ─── Fines panel
const FinesPanel: React.FC<{ workerId: string; items: Fine[]; reload: () => Promise<void> }> = ({ workerId, items, reload }) => {
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ reason: string; amount: string }>({ reason: '', amount: '' });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!reason.trim()) { setErr('Səbəbi yazın.'); return; }
    if (!amount || Number(amount) <= 0) { setErr('Məbləğ daxil edin.'); return; }
    setBusy(true);
    try {
      await addFine({ workerId, reason: reason.trim(), amount: Number(amount), date: new Date().toISOString() });
      setReason(''); setAmount(''); setOk(true); setTimeout(() => setOk(false), 2000);
      await reload();
    } catch (e: any) {
      setErr(e?.message || 'Xəta baş verdi.');
    } finally { setBusy(false); }
  };

  const saveEdit = async (id: string) => {
    if (!await askEditPassword()) return;
    await updateFine(id, { reason: editData.reason.trim(), amount: Number(editData.amount) || 0 });
    setEditId(null);
    await reload();
  };

  return (
    <div>
      {err && <div className="mb-3 p-2 bg-red-50 text-red-700 text-xs rounded-lg" data-testid="fine-err">{err}</div>}
      {ok && <div className="mb-3 p-2 bg-emerald-50 text-emerald-700 text-xs rounded-lg inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Cərimə əlavə olundu</div>}
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-12 gap-2 mb-4">
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Səbəb (məs: Gec gəlmə)" className={inp + ' sm:col-span-6'} data-testid="fine-reason" />
        <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Məbləğ ₼" className={inp + ' sm:col-span-3'} data-testid="fine-amount" />
        <button type="submit" disabled={busy} className="sm:col-span-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 inline-flex items-center justify-center gap-1.5" data-testid="fine-submit">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Cərimə əlavə et
        </button>
      </form>
      {items.length === 0 ? <p className="text-sm text-gray-400">Cərimə yoxdur</p> : (
        <ul className="space-y-2">
          {items.map(f => (
            <li key={f.id} className="border border-gray-100 rounded-lg p-3 text-sm">
              {editId === f.id ? (
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <input value={editData.reason} onChange={(e) => setEditData(d => ({ ...d, reason: e.target.value }))} className={inp + ' sm:col-span-6 text-xs py-1.5'} />
                  <input type="number" value={editData.amount} onChange={(e) => setEditData(d => ({ ...d, amount: e.target.value }))} className={inp + ' sm:col-span-3 text-xs py-1.5'} />
                  <div className="sm:col-span-3 flex items-center gap-1 justify-end">
                    <button onClick={() => saveEdit(f.id)} className="p-1.5 hover:bg-emerald-50 rounded"><Save className="h-3.5 w-3.5 text-emerald-600" /></button>
                    <button onClick={() => setEditId(null)} className="p-1.5 hover:bg-gray-100 rounded"><X className="h-3.5 w-3.5 text-gray-500" /></button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-black flex items-center gap-1.5"><AlertOctagon className="h-3.5 w-3.5 text-red-500" /> {f.reason}</p>
                    <p className="text-xs text-gray-500">{fmt(f.date)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-red-600 font-medium">−{f.amount} ₼</span>
                    <button onClick={() => { setEditId(f.id); setEditData({ reason: f.reason, amount: String(f.amount) }); }} title="Redaktə"><Edit2 className="h-3.5 w-3.5 text-gray-400 hover:text-blue-500" /></button>
                    <button onClick={async () => { if (!await askEditPassword()) return; await deleteFine(f.id); await reload(); }} title="Sil"><Trash2 className="h-3.5 w-3.5 text-gray-400 hover:text-red-500" /></button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ─── Rewards panel
const RewardsPanel: React.FC<{ workerId: string; items: Reward[]; reload: () => Promise<void> }> = ({ workerId, items, reload }) => {
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'bonus' | 'thanks' | 'raise'>('bonus');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ reason: string; amount: string; type: 'bonus' | 'thanks' | 'raise' }>({ reason: '', amount: '', type: 'bonus' });

  const saveEdit = async (id: string) => {
    if (!await askEditPassword()) return;
    const patch: Partial<Reward> = { reason: editData.reason.trim(), type: editData.type };
    if (editData.amount) patch.amount = Number(editData.amount);
    await updateReward(id, patch);
    setEditId(null);
    await reload();
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!reason.trim()) { setErr('Səbəbi yazın.'); return; }
    if ((type === 'bonus' || type === 'raise') && (!amount || Number(amount) <= 0)) {
      setErr('Bonus / artım üçün məbləğ daxil edin.');
      return;
    }
    setBusy(true);
    try {
      const payload: any = { workerId, type, reason: reason.trim(), date: new Date().toISOString() };
      if (amount) payload.amount = Number(amount);
      await addReward(payload);
      setReason(''); setAmount(''); setOk(true); setTimeout(() => setOk(false), 2000);
      await reload();
    } catch (e: any) {
      setErr(e?.message || 'Xəta baş verdi.');
    } finally { setBusy(false); }
  };
  return (
    <div>
      {err && <div className="mb-3 p-2 bg-red-50 text-red-700 text-xs rounded-lg" data-testid="reward-err">{err}</div>}
      {ok && <div className="mb-3 p-2 bg-emerald-50 text-emerald-700 text-xs rounded-lg inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Mükafat əlavə olundu</div>}
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-12 gap-2 mb-4">
        <select value={type} onChange={(e) => setType(e.target.value as any)} className={inp + ' sm:col-span-3'} data-testid="reward-type">
          <option value="bonus">Bonus (₼)</option>
          <option value="thanks">Təşəkkür</option>
          <option value="raise">Maaş artımı (%)</option>
        </select>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Səbəb (məs: Yüksək satış)" className={inp + ' sm:col-span-4'} data-testid="reward-reason" />
        <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)}
          placeholder={type === 'thanks' ? 'Məbləğ (istəyə görə)' : 'Məbləğ'}
          className={inp + ' sm:col-span-2'} data-testid="reward-amount" />
        <button type="submit" disabled={busy} className="sm:col-span-3 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-1.5" data-testid="reward-submit">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Mükafat ver
        </button>
      </form>
      {items.length === 0 ? <p className="text-sm text-gray-400">Mükafat yoxdur</p> : (
        <ul className="space-y-2">
          {items.map(r => (
            <li key={r.id} className="border border-gray-100 rounded-lg p-3 text-sm">
              {editId === r.id ? (
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <select value={editData.type} onChange={(e) => setEditData(d => ({ ...d, type: e.target.value as any }))} className={inp + ' sm:col-span-3 text-xs py-1.5'}>
                    <option value="bonus">Bonus</option>
                    <option value="thanks">Təşəkkür</option>
                    <option value="raise">Artım %</option>
                  </select>
                  <input value={editData.reason} onChange={(e) => setEditData(d => ({ ...d, reason: e.target.value }))} className={inp + ' sm:col-span-4 text-xs py-1.5'} />
                  <input type="number" value={editData.amount} onChange={(e) => setEditData(d => ({ ...d, amount: e.target.value }))} className={inp + ' sm:col-span-3 text-xs py-1.5'} />
                  <div className="sm:col-span-2 flex items-center gap-1 justify-end">
                    <button onClick={() => saveEdit(r.id)} className="p-1.5 hover:bg-emerald-50 rounded"><Save className="h-3.5 w-3.5 text-emerald-600" /></button>
                    <button onClick={() => setEditId(null)} className="p-1.5 hover:bg-gray-100 rounded"><X className="h-3.5 w-3.5 text-gray-500" /></button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-black flex items-center gap-1.5"><AwardIcon className="h-3.5 w-3.5 text-[#D4AF37]" /> {r.reason}</p>
                    <p className="text-xs text-gray-500">{fmt(r.date)} · {r.type}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {r.amount ? <span className="text-emerald-600 font-medium">+{r.amount}{r.type === 'raise' ? '%' : ' ₼'}</span> : null}
                    <button onClick={() => { setEditId(r.id); setEditData({ reason: r.reason, amount: String(r.amount || ''), type: r.type }); }} title="Redaktə"><Edit2 className="h-3.5 w-3.5 text-gray-400 hover:text-blue-500" /></button>
                    <button onClick={async () => { if (!await askEditPassword()) return; await deleteReward(r.id); await reload(); }} title="Sil"><Trash2 className="h-3.5 w-3.5 text-gray-400 hover:text-red-500" /></button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ─── Sales panel (admin can record sales for worker — used for monthly target)
const SalesPanel: React.FC<{ workerId: string; target: number; items: SalesEntry[]; reload: () => Promise<void> }> = ({ workerId, target, items, reload }) => {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const monthSales = useMemo(() => items.filter(s => s.date.startsWith(monthYM())).reduce((s, x) => s + x.amount, 0), [items]);
  const pct = target ? Math.min(100, Math.round((monthSales / target) * 100)) : 0;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    await addSale({ workerId, amount: Number(amount), date: new Date().toISOString().slice(0, 10), note });
    setAmount(''); setNote(''); await reload();
  };
  return (
    <div>
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase tracking-wider text-gray-500 flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Bu ay</span>
          <span className="text-sm">{monthSales.toFixed(0)} / {target?.toLocaleString() || '—'} ₼ · <strong>{pct}%</strong></span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-[#D4AF37]" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
        <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Məbləğ ₼" className={inp} data-testid="sale-amount" />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Qeyd (istəyə görə)" className={inp + ' sm:col-span-1'} />
        <button className="px-4 bg-black text-white rounded-lg text-sm flex items-center justify-center gap-1.5"><Plus className="h-4 w-4" /> Satış əlavə et</button>
      </form>
      {items.length === 0 ? <p className="text-sm text-gray-400">Satış qeydi yoxdur</p> : (
        <ul className="space-y-1.5 max-h-72 overflow-y-auto">
          {items.slice(0, 50).map(s => (
            <li key={s.id} className="flex justify-between text-sm border-b border-gray-50 pb-1.5 last:border-0">
              <span className="text-gray-700">{fmt(s.date + 'T00:00:00')}{s.note ? ` · ${s.note}` : ''}</span>
              <span className="text-black font-medium">+{s.amount} ₼</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ─── Notification panel
const NotifyPanel: React.FC<{ workerId: string }> = ({ workerId }) => {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!msg.trim()) { setErr('Mesaj boşdur.'); return; }
    setBusy(true);
    try {
      await sendNotification(workerId, msg.trim());
      setMsg(''); setSent(true); setTimeout(() => setSent(false), 2500);
    } catch (e: any) {
      setErr(e?.message || 'Bildiriş göndərilmədi.');
    } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      {err && <div className="p-2 bg-red-50 text-red-700 text-xs rounded-lg" data-testid="notify-err">{err}</div>}
      <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={3}
        placeholder="İşçiyə göndəriləcək mesaj..."
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
        data-testid="notify-msg" />
      <div className="flex items-center justify-between">
        {sent && <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Göndərildi</span>}
        <button type="submit" disabled={busy} className="ml-auto inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-[#C99B1F] disabled:opacity-50"
          data-testid="notify-send">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellPlus className="h-4 w-4" />}
          Bildiriş göndər
        </button>
      </div>
    </form>
  );
};

// ─── Requests inbox (all workers)
const RequestsInbox: React.FC<{ items: WorkerRequest[]; workers: Worker[]; onUpdated: () => Promise<void> }> = ({ items, workers, onUpdated }) => {
  const [filter, setFilter] = useState<'all' | RequestStatus>('all');
  const [responseMap, setResponseMap] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const filtered = items.filter(i => filter === 'all' || i.status === filter);
  const findWorker = (id: string) => workers.find(w => w.id === id);

  // Yeni / həll olunmamış müraciətlərin sayı (qırmızı bildiriş üçün)
  const pendingCount = items.filter(i => i.status === 'sent' || i.status === 'review').length;

  const updateStatus = async (id: string, status: RequestStatus, currentRequest: WorkerRequest) => {
    const r = responseMap[id] ?? currentRequest.adminResponse ?? '';
    await updateRequestStatus(id, status, r);
    if (currentRequest.workerId && r && r !== currentRequest.adminResponse) {
      await sendNotification(currentRequest.workerId, `Müraciətinizə cavab: ${r}`);
    }
    await onUpdated();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Compact collapsible header */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
        data-testid="requests-inbox-toggle"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative">
            <Inbox className="h-5 w-5 text-gray-700" />
            {pendingCount > 0 && (
              <span
                className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-semibold rounded-full flex items-center justify-center ring-2 ring-white animate-pulse"
                data-testid="requests-pending-badge"
              >
                {pendingCount > 99 ? '99+' : pendingCount}
              </span>
            )}
          </div>
          <h2 className="text-base font-semibold text-black">Müraciətlər</h2>
          <span className="text-xs text-gray-500">({items.length})</span>
          {pendingCount > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1 ml-1 px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-[11px] font-medium">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              {pendingCount} yeni
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100">
          <div className="flex items-center justify-end mb-3">
            <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className={inp + ' w-44 text-sm'}>
              <option value="all">Hamısı</option>
              <option value="sent">Göndərildi</option>
              <option value="review">Baxılır</option>
              <option value="resolved">Təsdiq olundu</option>
            </select>
          </div>
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Müraciət yoxdur.</p>
          ) : (
            <ul className="space-y-2">
              {filtered.map(r => {
                const w = findWorker(r.workerId);
                const isPending = r.status === 'sent' || r.status === 'review';
                return (
                  <li
                    key={r.id}
                    className={`border rounded-lg p-3 text-sm ${isPending ? 'border-red-100 bg-red-50/30' : 'border-gray-100'}`}
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-black flex items-center gap-1.5 flex-wrap">
                          {isPending && <span className="w-2 h-2 bg-red-500 rounded-full" />}
                          {w ? `${w.name} ${w.surname}` : '—'}
                          <span className="text-xs text-gray-500">· {r.type}</span>
                        </p>
                        <p className="text-gray-700 mt-1 whitespace-pre-line break-words">{r.description}</p>
                        {r.signature && (
                          <div className="mt-2 inline-block bg-white border border-gray-200 rounded-md p-1.5">
                            <div className="text-[9px] uppercase tracking-wider text-gray-500 mb-0.5">İşçinin imzası</div>
                            <img src={r.signature} alt="İmza" className="h-14 max-w-[200px] object-contain" />
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400 shrink-0">{fmtDateTime(r.createdAt)}</span>
                    </div>

                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <input
                        placeholder="Cavab..."
                        defaultValue={r.adminResponse || ''}
                        onChange={(e) => setResponseMap(m => ({ ...m, [r.id]: e.target.value }))}
                        className={inp + ' flex-1 min-w-[180px] text-sm py-1.5'}
                      />
                      <button onClick={() => updateStatus(r.id, 'review', r)}
                        className="px-2.5 py-1 text-xs border border-blue-200 text-blue-700 rounded-md hover:bg-blue-50 inline-flex items-center gap-1">
                        <Hourglass className="h-3 w-3" /> Baxılır
                      </button>
                      <button onClick={() => updateStatus(r.id, 'resolved', r)}
                        className="px-2.5 py-1 text-xs border border-emerald-200 text-emerald-700 rounded-md hover:bg-emerald-50 inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Təsdiq
                      </button>
                      <button onClick={async () => {
                        if (!await siteConfirm({ message: 'Bu müraciəti silmək istədiyinizə əminsiniz?', variant: 'danger', confirmLabel: 'Sil' })) return;
                        await deleteRequest(r.id);
                        await onUpdated();
                      }}
                        className="px-2.5 py-1 text-xs border border-red-200 text-red-700 rounded-md hover:bg-red-50 inline-flex items-center gap-1"
                        data-testid={`request-delete-${r.id}`}>
                        <Trash2 className="h-3 w-3" /> Sil
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default WorkersTab;

// ─── 12 aylıq satış tarixçəsi paneli (admin)
// Admin cari ilin 12 ayı (Yanvar-Dekabr) üçün satış məbləğlərini daxil edə / dəyişə bilər.
// Cari ay daxil edildikdə monthlyTotalSales/Month də yenilənir.
const AZ_MONTHS_LONG_ADM = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun', 'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];

const buildCurrentYearMonthsAdm = (): { ym: string; label: string }[] => {
  const arr: { ym: string; label: string }[] = [];
  const y = new Date().getFullYear();
  for (let m = 0; m < 12; m++) {
    arr.push({
      ym: `${y}-${String(m + 1).padStart(2, '0')}`,
      label: `${AZ_MONTHS_LONG_ADM[m]} ${y}`,
    });
  }
  return arr;
};

const MonthlyHistoryPanel: React.FC<{ worker: Worker; onSaved: () => Promise<void> }> = ({ worker, onSaved }) => {
  const months = useMemo(() => buildCurrentYearMonthsAdm(), []);
  const currentYM = monthYM();
  const initial: Record<string, string> = useMemo(() => {
    const h = worker.salesHistory || {};
    const m: Record<string, string> = {};
    months.forEach(({ ym }) => {
      const v = h[ym];
      m[ym] = typeof v === 'number' && v > 0 ? String(v) : '';
    });
    return m;
  }, [worker.salesHistory, months]);

  const [values, setValues] = useState<Record<string, string>>(initial);
  const [busy, setBusy] = useState(false);
  const [savedYM, setSavedYM] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // worker dəyişəndə state-i yenilə
  useEffect(() => {
    setValues(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worker.id]);

  // Live preview üçün hazırkı dəyərlərdən salesHistory düzəlt
  const livePreview = useMemo(() => {
    const out: Record<string, number> = { ...(worker.salesHistory || {}) };
    Object.entries(values).forEach(([k, v]) => {
      const n = Number(v);
      if (!Number.isNaN(n) && v !== '') out[k] = n;
    });
    return out;
  }, [values, worker.salesHistory]);

  const saveAll = async () => {
    setBusy(true);
    setErrorMsg('');
    try {
      const changed = months.filter(({ ym }) => (values[ym] || '') !== (initial[ym] || ''));
      if (changed.length === 0) {
        setSavedYM('all');
        setTimeout(() => setSavedYM(''), 2000);
        return;
      }
      for (const { ym } of changed) {
        const n = Number(values[ym] || 0) || 0;
        await setMonthlySalesHistory(worker.id, ym, n);
      }
      setSavedYM('all');
      setTimeout(() => setSavedYM(''), 2500);
      await onSaved();
    } catch (err: any) {
      console.error('Monthly history save failed:', err);
      setErrorMsg(err?.message || 'Saxlamaq mümkün olmadı.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-100 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#D4AF37]" /> 12 Aylıq Satış Tarixçəsi
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Hər ayın ümumi satışını ₼ ilə daxil edin. İşçi öz panelində eyni rəqəmləri qrafik kimi görəcək.
          </p>
        </div>
        <button
          onClick={saveAll}
          disabled={busy}
          className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 inline-flex items-center gap-2"
          data-testid="monthly-history-save"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} <Save className="h-4 w-4" /> Hamısını saxla
        </button>
      </div>

      {/* Mini chart preview */}
      <MonthlySalesChart
        salesHistory={livePreview}
        target={worker.monthlyTarget || 0}
        title="Önizləmə"
        height={140}
        mode="currentYear"
        showAverage={false}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {months.map(({ ym, label }) => {
          const isCurrent = ym === currentYM;
          return (
            <div key={ym} className={`rounded-lg border p-3 ${isCurrent ? 'border-[#D4AF37] bg-[#FFF8E5]/60' : 'border-gray-100 bg-gray-50/40'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-gray-700">{label}</label>
                {isCurrent && <span className="text-[9px] uppercase tracking-wider text-[#8a6d10] font-semibold">cari</span>}
              </div>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  value={values[ym] ?? ''}
                  onChange={(e) => setValues(v => ({ ...v, [ym]: e.target.value }))}
                  className="w-full pl-2 pr-7 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 focus:border-[#D4AF37] bg-white"
                  placeholder="0"
                  data-testid={`history-input-${ym}`}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">₼</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 text-xs">
        {savedYM === 'all' && <span className="text-emerald-600 inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Saxlanıldı</span>}
        {errorMsg && <span className="text-red-600">{errorMsg}</span>}
      </div>
    </div>
  );
};
