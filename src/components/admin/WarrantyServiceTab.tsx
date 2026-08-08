import React, { useEffect, useMemo, useState } from 'react';
import {
  Wrench, Loader2, CheckCircle2, Truck, Package, Trash2, ChevronDown, ChevronUp,
  User as UserIcon, Phone, Building2, PenLine, Clock, X,
} from 'lucide-react';
import InlineSignaturePad from '../InlineSignaturePad';
import { listWorkers, listBranches } from '../../services/workerService';
import type { Worker } from '../../types/worker';
import {
  subscribeAllWarrantyServices,
  acceptWarrantyService,
  setWarrantyStatus,
  deleteWarrantyService,
  formatWarrantyDate,
  WARRANTY_STATUS_LABELS,
  type WarrantyService,
  type WarrantyStatus,
} from '../../services/warrantyService';

const statusStyle: Record<WarrantyStatus, string> = {
  submitted: 'bg-amber-100 text-amber-800 border-amber-200',
  accepted: 'bg-blue-100 text-blue-800 border-blue-200',
  in_service: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  at_branch: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  completed: 'bg-gray-100 text-gray-700 border-gray-200',
};

const FILTERS: { id: 'all' | WarrantyStatus; label: string }[] = [
  { id: 'all', label: 'Hamısı' },
  { id: 'submitted', label: 'Yeni' },
  { id: 'accepted', label: 'Qəbul olundu' },
  { id: 'in_service', label: 'Servisdə' },
  { id: 'at_branch', label: 'Filialda' },
  { id: 'completed', label: 'Tamamlandı' },
];

const WarrantyServiceTab: React.FC = () => {
  const [services, setServices] = useState<WarrantyService[]>([]);
  const [loading, setLoading] = useState(true);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [branches, setBranches] = useState<string[]>([]);
  const [filter, setFilter] = useState<'all' | WarrantyStatus>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  // Accept panel state
  const [acceptFor, setAcceptFor] = useState<string | null>(null);
  const [acceptWorker, setAcceptWorker] = useState('');
  const [acceptSignature, setAcceptSignature] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeAllWarrantyServices(
      (items) => { setServices(items); setLoading(false); },
      () => setLoading(false)
    );
    listWorkers().then((w) => setWorkers(w.filter((x) => x.isActive))).catch(() => setWorkers([]));
    listBranches().then((b) => setBranches(b.map((x) => x.name))).catch(() => setBranches([]));
    return () => unsub();
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: services.length };
    services.forEach((s) => { c[s.status] = (c[s.status] || 0) + 1; });
    return c;
  }, [services]);

  const filtered = useMemo(() => {
    return services.filter((s) => {
      if (filter !== 'all' && s.status !== filter) return false;
      if (branchFilter !== 'all' && s.branch !== branchFilter) return false;
      return true;
    });
  }, [services, filter, branchFilter]);

  const handleAccept = async (id: string) => {
    if (!acceptWorker) { alert('İşçini seçin.'); return; }
    try {
      setBusyId(id);
      await acceptWarrantyService(id, { workerName: acceptWorker, workerSignature: acceptSignature });
      setAcceptFor(null); setAcceptWorker(''); setAcceptSignature('');
    } catch (e: any) {
      alert(e?.message || 'Xəta baş verdi.');
    } finally { setBusyId(null); }
  };

  const handleStatus = async (id: string, status: WarrantyStatus) => {
    try {
      setBusyId(id);
      await setWarrantyStatus(id, status);
    } catch {
      alert('Status dəyişdirilə bilmədi.');
    } finally { setBusyId(null); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu aktı silmək istədiyinizə əminsiniz?')) return;
    try {
      setBusyId(id);
      await deleteWarrantyService(id);
    } catch {
      alert('Silinə bilmədi.');
    } finally { setBusyId(null); }
  };

  return (
    <div data-testid="warranty-admin-tab">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-black text-white flex items-center justify-center">
          <Wrench className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Zəmanət Servisi</h2>
          <p className="text-sm text-gray-500">Təhvil-təslim aktları və servis izləmə</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              filter === f.id ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
            }`}
            data-testid={`warranty-filter-${f.id}`}
          >
            {f.label}
            <span className="ml-1.5 text-xs opacity-70">{counts[f.id] || 0}</span>
          </button>
        ))}
        {branches.length > 0 && (
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="ml-auto px-3 py-1.5 rounded-full text-sm border border-gray-300 bg-white text-gray-700"
            data-testid="warranty-branch-filter"
          >
            <option value="all">Bütün filiallar</option>
            {branches.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
          <Package className="h-10 w-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Bu bölmədə akt yoxdur.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => {
            const isOpen = expanded === s.id;
            const isBusy = busyId === s.id;
            return (
              <div key={s.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden" data-testid={`warranty-admin-card-${s.id}`}>
                {/* Header row */}
                <div className="p-4 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[10px] uppercase tracking-wider text-gray-400">Akt №{s.serviceNumber}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusStyle[s.status]}`}>
                        {WARRANTY_STATUS_LABELS[s.status]}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900 truncate">{s.brand} — {s.model}</h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500 mt-1">
                      <span className="inline-flex items-center gap-1"><UserIcon className="h-3 w-3" />{s.customerName} {s.customerSurname}</span>
                      {s.customerPhone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{s.customerPhone}</span>}
                      <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{s.branch}</span>
                      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{formatWarrantyDate(s.createdAt)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setExpanded(isOpen ? null : s.id)}
                    className="p-1.5 text-gray-400 hover:text-gray-700"
                    data-testid={`warranty-expand-${s.id}`}
                  >
                    {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </button>
                </div>

                {/* Quick actions */}
                <div className="px-4 pb-4 flex flex-wrap gap-2">
                  {s.status === 'submitted' && acceptFor !== s.id && (
                    <button
                      onClick={() => { setAcceptFor(s.id); setAcceptWorker(''); setAcceptSignature(''); }}
                      disabled={isBusy}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-1.5"
                      data-testid={`warranty-accept-open-${s.id}`}
                    >
                      <CheckCircle2 className="h-4 w-4" /> Servisə qəbul et
                    </button>
                  )}
                  {(s.status === 'accepted' || s.status === 'in_service') && (
                    <>
                      {s.status === 'accepted' && (
                        <button
                          onClick={() => handleStatus(s.id, 'in_service')}
                          disabled={isBusy}
                          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-1.5"
                          data-testid={`warranty-inservice-${s.id}`}
                        >
                          <Truck className="h-4 w-4" /> Servisə göndərildi
                        </button>
                      )}
                      <button
                        onClick={() => handleStatus(s.id, 'at_branch')}
                        disabled={isBusy}
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-1.5"
                        data-testid={`warranty-atbranch-${s.id}`}
                      >
                        <Building2 className="h-4 w-4" /> Filiala qaytarıldı
                      </button>
                    </>
                  )}
                  {s.status === 'at_branch' && (
                    <span className="px-3 py-2 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-lg inline-flex items-center gap-1.5 border border-emerald-200">
                      <Clock className="h-4 w-4" /> Müştərinin təhvil alması gözlənilir
                    </span>
                  )}
                  <button
                    onClick={() => handleDelete(s.id)}
                    disabled={isBusy}
                    className="ml-auto px-3 py-2 text-red-600 hover:bg-red-50 text-sm font-medium rounded-lg inline-flex items-center gap-1.5"
                    data-testid={`warranty-delete-${s.id}`}
                  >
                    {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>

                {/* Accept panel */}
                {acceptFor === s.id && (
                  <div className="mx-4 mb-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-semibold text-blue-900 text-sm">Servisə qəbul — işçi seçin</p>
                      <button onClick={() => setAcceptFor(null)} className="text-blue-400 hover:text-blue-700"><X className="h-4 w-4" /></button>
                    </div>
                    <select
                      value={acceptWorker}
                      onChange={(e) => setAcceptWorker(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-blue-300 rounded-lg bg-white mb-3"
                      data-testid={`warranty-accept-worker-${s.id}`}
                    >
                      <option value="">Qəbul edən işçini seçin</option>
                      {workers.map((w) => (
                        <option key={w.id} value={`${w.name} ${w.surname}`}>
                          {w.name} {w.surname}{w.branch ? ` — ${w.branch}` : ''}
                        </option>
                      ))}
                    </select>
                    <div className="bg-white rounded-lg p-3 border border-blue-200">
                      <InlineSignaturePad
                        label="İşçi imzası (istəyə bağlı)"
                        value={acceptSignature}
                        onChange={setAcceptSignature}
                        height={140}
                      />
                    </div>
                    <button
                      onClick={() => handleAccept(s.id)}
                      disabled={!acceptWorker || isBusy}
                      className="w-full mt-3 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold rounded-lg inline-flex items-center justify-center gap-2"
                      data-testid={`warranty-accept-confirm-${s.id}`}
                    >
                      {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Qəbul et
                    </button>
                  </div>
                )}

                {/* Expanded detail */}
                {isOpen && (
                  <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Nasazlığın təsviri</p>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{s.faultDescription}</p>
                    </div>

                    {s.acceptedWorkerName && (
                      <div className="text-sm">
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Servisə qəbul edən</p>
                        <p className="text-gray-800 font-medium">{s.acceptedWorkerName}
                          {s.acceptedAt && <span className="text-gray-400 text-xs"> · {formatWarrantyDate(s.acceptedAt)}</span>}
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {s.handoverSignature && (
                        <SignatureBox label="Təhvil verən (müştəri)" src={s.handoverSignature} testid={`warranty-sig-handover-${s.id}`} />
                      )}
                      {s.acceptedWorkerSignature && (
                        <SignatureBox label="Qəbul edən (işçi)" src={s.acceptedWorkerSignature} />
                      )}
                      {s.pickupSignature && (
                        <SignatureBox label="Təhvil alan (müştəri)" src={s.pickupSignature} testid={`warranty-sig-pickup-${s.id}`} />
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const SignatureBox: React.FC<{ label: string; src: string; testid?: string }> = ({ label, src, testid }) => (
  <div>
    <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1 inline-flex items-center gap-1">
      <PenLine className="h-3 w-3" />{label}
    </p>
    <img src={src} alt={label} className="bg-white border border-gray-200 rounded-lg max-h-24 w-full object-contain p-1" data-testid={testid} />
  </div>
);

export default WarrantyServiceTab;
