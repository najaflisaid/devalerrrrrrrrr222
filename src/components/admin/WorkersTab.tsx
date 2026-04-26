import React, { useEffect, useMemo, useState } from 'react';
import {
  Loader2, Plus, Search, Users, X, Edit2, Trash2, Star, Save,
  AlertOctagon, Award as AwardIcon, TrendingUp, MailIcon,
  Inbox, CheckCircle2, Hourglass, Paperclip, BellPlus,
} from 'lucide-react';
import {
  createWorker, listWorkers, updateWorker, deleteWorker, uploadWorkerPhoto,
  addFine, listFines, deleteFine,
  addReward, listRewards, deleteReward,
  addSale, listSales,
  listRequests, updateRequestStatus,
  sendNotification,
  monthYM,
} from '../../services/workerService';
import type {
  Worker, Fine, Reward, SalesEntry, WorkerRequest, RequestStatus,
} from '../../types/worker';

type Mode = 'list' | 'create' | 'edit';

const fmt = (iso: string) => iso ? new Date(iso).toLocaleDateString('az-AZ') : '—';

const WorkersTab: React.FC = () => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<Mode>('list');
  const [editing, setEditing] = useState<Worker | null>(null);

  const [allRequests, setAllRequests] = useState<WorkerRequest[]>([]);

  const refresh = async () => {
    setLoading(true);
    try {
      const [w, r] = await Promise.all([listWorkers(), listRequests()]);
      setWorkers(w); setAllRequests(r);
    } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return workers;
    return workers.filter(w =>
      `${w.name} ${w.surname} ${w.email} ${w.position}`.toLowerCase().includes(q)
    );
  }, [workers, search]);

  if (loading) {
    return <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-gray-500" /></div>;
  }

  if (mode === 'create') {
    return <WorkerForm onClose={() => setMode('list')} onSaved={async () => { setMode('list'); await refresh(); }} />;
  }
  if (mode === 'edit' && editing) {
    return <WorkerDetail worker={editing} onClose={() => { setEditing(null); setMode('list'); }} onUpdated={async () => { await refresh(); }} />;
  }

  return (
    <div className="space-y-6">
      {/* Workers list */}
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
                <th className="py-3 pr-4">Email</th>
                <th className="py-3 pr-4">İşə başlama</th>
                <th className="py-3 pr-4">Reytinq</th>
                <th className="py-3 pr-4">Hədəf (₼)</th>
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
                    <td className="py-3 pr-4 text-gray-600 text-xs">{w.email}</td>
                    <td className="py-3 pr-4 text-gray-600">{fmt(w.hireDate)}</td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-3 w-3 ${i < Math.round(w.rating) ? 'fill-[#D4AF37] text-[#D4AF37]' : 'text-gray-300'}`} />
                        ))}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-gray-700">{w.monthlyTarget?.toLocaleString() || '—'}</td>
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
    </div>
  );
};

// ───────────────────── Worker Form (create) ─────────────────────
const WorkerForm: React.FC<{ onClose: () => void; onSaved: () => void; existing?: Worker }> = ({ onClose, onSaved, existing }) => {
  const [name, setName] = useState(existing?.name || '');
  const [surname, setSurname] = useState(existing?.surname || '');
  const [email, setEmail] = useState(existing?.email || '');
  const [password, setPassword] = useState('');
  const [position, setPosition] = useState(existing?.position || '');
  const [hireDate, setHireDate] = useState(existing?.hireDate?.slice(0, 10) || new Date().toISOString().slice(0, 10));
  const [contractStart, setContractStart] = useState(existing?.contractStart?.slice(0, 10) || new Date().toISOString().slice(0, 10));
  const [contractEnd, setContractEnd] = useState(existing?.contractEnd?.slice(0, 10) || '');
  const [rating, setRating] = useState(existing?.rating ?? 5);
  const [monthlyTarget, setMonthlyTarget] = useState(existing?.monthlyTarget?.toString() || '');
  const [photo, setPhoto] = useState(existing?.photo || '');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!existing && password.length < 6) { setErr('Şifrə ən az 6 simvol olmalıdır.'); return; }
    setBusy(true);
    try {
      let photoUrl = photo;
      if (existing) {
        if (photoFile) photoUrl = await uploadWorkerPhoto(existing.id, photoFile);
        await updateWorker(existing.id, {
          name, surname, position, photo: photoUrl,
          hireDate, contractStart, contractEnd,
          rating: Number(rating),
          monthlyTarget: Number(monthlyTarget) || 0,
        });
      } else {
        const w = await createWorker(email.trim().toLowerCase(), password, {
          name, surname, position,
          hireDate, contractStart, contractEnd,
          rating: Number(rating),
          monthlyTarget: Number(monthlyTarget) || 0,
          photo: '',
        });
        if (photoFile) {
          const url = await uploadWorkerPhoto(w.id, photoFile);
          await updateWorker(w.id, { photo: url });
        }
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
        {!existing && <Field label="Şifrə * (ən az 6 simvol)"><input required type="text" value={password} onChange={(e) => setPassword(e.target.value)} className={inp} data-testid="workers-form-password" /></Field>}
        <Field label="Vəzifə *"><input required value={position} onChange={(e) => setPosition(e.target.value)} className={inp} data-testid="workers-form-position" /></Field>
        <Field label="İşə başlama tarixi *"><input required type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} className={inp} /></Field>
        <Field label="Müqavilə başlama"><input type="date" value={contractStart} onChange={(e) => setContractStart(e.target.value)} className={inp} /></Field>
        <Field label="Müqavilə bitmə"><input type="date" value={contractEnd} onChange={(e) => setContractEnd(e.target.value)} className={inp} /></Field>
        <Field label="Reytinq (0–5)"><input type="number" min={0} max={5} step={0.1} value={rating} onChange={(e) => setRating(Number(e.target.value))} className={inp} /></Field>
        <Field label="Aylıq satış hədəfi (₼)"><input type="number" min={0} value={monthlyTarget} onChange={(e) => setMonthlyTarget(e.target.value)} className={inp} /></Field>
        <Field label="Şəkil">
          <div className="flex items-center gap-3">
            {(photoFile || photo) && (
              <img src={photoFile ? URL.createObjectURL(photoFile) : photo} alt="" className="w-12 h-12 rounded-full object-cover" />
            )}
            <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} className="text-sm" />
          </div>
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

// ───────────────────── Worker Detail (edit + fines/rewards/sales/notify) ─────────────────────
const WorkerDetail: React.FC<{ worker: Worker; onClose: () => void; onUpdated: () => Promise<void> }> = ({ worker, onClose, onUpdated }) => {
  const [tab, setTab] = useState<'info' | 'fines' | 'rewards' | 'sales' | 'notify'>('info');
  const [fines, setFines] = useState<Fine[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [sales, setSales] = useState<SalesEntry[]>([]);

  const reload = async () => {
    const [f, r, s] = await Promise.all([
      listFines(worker.id),
      listRewards(worker.id),
      listSales(worker.id),
    ]);
    setFines(f); setRewards(r); setSales(s);
  };
  useEffect(() => { reload(); }, [worker.id]);

  const handleDelete = async () => {
    if (!confirm(`${worker.name} ${worker.surname} işçisi silinsin?`)) return;
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

      <div className="flex border-b border-gray-100 mb-5">
        {([
          ['info', 'Məlumat'], ['fines', 'Cərimələr'], ['rewards', 'Mükafatlar'], ['sales', 'Satışlar'], ['notify', 'Bildiriş'],
        ] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === k ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'info' && <WorkerForm existing={worker} onClose={onClose} onSaved={async () => { await onUpdated(); }} />}
      {tab === 'fines' && <FinesPanel workerId={worker.id} items={fines} reload={reload} />}
      {tab === 'rewards' && <RewardsPanel workerId={worker.id} items={rewards} reload={reload} />}
      {tab === 'sales' && <SalesPanel workerId={worker.id} target={worker.monthlyTarget} items={sales} reload={reload} />}
      {tab === 'notify' && <NotifyPanel workerId={worker.id} />}
    </div>
  );
};

// ─── Fines panel
const FinesPanel: React.FC<{ workerId: string; items: Fine[]; reload: () => Promise<void> }> = ({ workerId, items, reload }) => {
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason || !amount) return;
    setBusy(true);
    try {
      await addFine({ workerId, reason, amount: Number(amount), date: new Date().toISOString() });
      setReason(''); setAmount(''); await reload();
    } finally { setBusy(false); }
  };
  return (
    <div>
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Səbəb" className={inp + ' sm:col-span-2'} data-testid="fine-reason" />
        <div className="flex gap-2">
          <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Məbləğ ₼" className={inp} data-testid="fine-amount" />
          <button disabled={busy} className="px-4 bg-red-600 text-white rounded-lg text-sm flex items-center gap-1.5"><Plus className="h-4 w-4" /></button>
        </div>
      </form>
      {items.length === 0 ? <p className="text-sm text-gray-400">Cərimə yoxdur</p> : (
        <ul className="space-y-2">
          {items.map(f => (
            <li key={f.id} className="flex justify-between items-center text-sm border-b border-gray-50 pb-2 last:border-0">
              <div><p className="font-medium text-black flex items-center gap-1.5"><AlertOctagon className="h-3.5 w-3.5 text-red-500" /> {f.reason}</p>
                <p className="text-xs text-gray-500">{fmt(f.date)}</p></div>
              <div className="flex items-center gap-3">
                <span className="text-red-600 font-medium">−{f.amount} ₼</span>
                <button onClick={async () => { await deleteFine(f.id); await reload(); }}><Trash2 className="h-3.5 w-3.5 text-gray-400 hover:text-red-500" /></button>
              </div>
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
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    setBusy(true);
    try {
      await addReward({ workerId, type, amount: amount ? Number(amount) : undefined, reason, date: new Date().toISOString() });
      setReason(''); setAmount(''); await reload();
    } finally { setBusy(false); }
  };
  return (
    <div>
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-4">
        <select value={type} onChange={(e) => setType(e.target.value as any)} className={inp}>
          <option value="bonus">Bonus (₼)</option><option value="thanks">Təşəkkür</option><option value="raise">Maaş artımı (%)</option>
        </select>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Səbəb" className={inp + ' sm:col-span-2'} data-testid="reward-reason" />
        <div className="flex gap-2">
          <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Məbləğ" className={inp} data-testid="reward-amount" />
          <button disabled={busy} className="px-4 bg-emerald-600 text-white rounded-lg text-sm flex items-center"><Plus className="h-4 w-4" /></button>
        </div>
      </form>
      {items.length === 0 ? <p className="text-sm text-gray-400">Mükafat yoxdur</p> : (
        <ul className="space-y-2">
          {items.map(r => (
            <li key={r.id} className="flex justify-between items-center text-sm border-b border-gray-50 pb-2 last:border-0">
              <div><p className="font-medium text-black flex items-center gap-1.5"><AwardIcon className="h-3.5 w-3.5 text-[#D4AF37]" /> {r.reason}</p>
                <p className="text-xs text-gray-500">{fmt(r.date)} · {r.type}</p></div>
              <div className="flex items-center gap-3">
                {r.amount ? <span className="text-emerald-600 font-medium">+{r.amount}{r.type === 'raise' ? '%' : ' ₼'}</span> : null}
                <button onClick={async () => { await deleteReward(r.id); await reload(); }}><Trash2 className="h-3.5 w-3.5 text-gray-400 hover:text-red-500" /></button>
              </div>
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
  const [sent, setSent] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msg.trim()) return;
    await sendNotification(workerId, msg.trim());
    setMsg(''); setSent(true); setTimeout(() => setSent(false), 2500);
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={3}
        placeholder="İşçiyə göndəriləcək mesaj..."
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
        data-testid="notify-msg" />
      <div className="flex items-center justify-between">
        {sent && <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Göndərildi</span>}
        <button className="ml-auto inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-[#C99B1F]"
          data-testid="notify-send"><BellPlus className="h-4 w-4" /> Bildiriş göndər</button>
      </div>
    </form>
  );
};

// ─── Requests inbox (all workers)
const RequestsInbox: React.FC<{ items: WorkerRequest[]; workers: Worker[]; onUpdated: () => Promise<void> }> = ({ items, workers, onUpdated }) => {
  const [filter, setFilter] = useState<'all' | RequestStatus>('all');
  const [responseMap, setResponseMap] = useState<Record<string, string>>({});
  const filtered = items.filter(i => filter === 'all' || i.status === filter);
  const findWorker = (id: string) => workers.find(w => w.id === id);

  const updateStatus = async (id: string, status: RequestStatus, currentRequest: WorkerRequest) => {
    const r = responseMap[id] ?? currentRequest.adminResponse ?? '';
    await updateRequestStatus(id, status, r);
    if (currentRequest.workerId && r && r !== currentRequest.adminResponse) {
      await sendNotification(currentRequest.workerId, `Müraciətinizə cavab: ${r}`);
    }
    await onUpdated();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Inbox className="h-5 w-5 text-gray-700" />
          <h2 className="text-xl font-bold">Müraciətlər ({items.length})</h2>
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className={inp + ' w-44'}>
          <option value="all">Hamısı</option>
          <option value="sent">Göndərildi</option>
          <option value="review">Baxılır</option>
          <option value="resolved">Həll olundu</option>
        </select>
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">Müraciət yoxdur.</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map(r => {
            const w = findWorker(r.workerId);
            return (
              <li key={r.id} className="border border-gray-100 rounded-lg p-4 text-sm">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-black flex items-center gap-1.5">
                      {w ? `${w.name} ${w.surname}` : '—'} <span className="text-xs text-gray-500">· {r.type}</span>
                    </p>
                    <p className="text-gray-700 mt-1">{r.description}</p>
                    {r.attachmentUrl && (
                      <a href={r.attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-[#C99B1F] mt-1.5 hover:underline">
                        <Paperclip className="h-3 w-3" /> Əlavə fayl
                      </a>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400">{new Date(r.createdAt).toLocaleString('az-AZ')}</span>
                </div>

                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <input
                    placeholder="Admin cavabı..."
                    defaultValue={r.adminResponse || ''}
                    onChange={(e) => setResponseMap(m => ({ ...m, [r.id]: e.target.value }))}
                    className={inp + ' flex-1 min-w-[200px]'}
                  />
                  <button onClick={() => updateStatus(r.id, 'review', r)}
                    className="px-3 py-1.5 text-xs border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 inline-flex items-center gap-1">
                    <Hourglass className="h-3 w-3" /> Baxılır
                  </button>
                  <button onClick={() => updateStatus(r.id, 'resolved', r)}
                    className="px-3 py-1.5 text-xs border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-50 inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Həll olundu
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default WorkersTab;
