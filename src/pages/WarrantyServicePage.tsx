import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Wrench, ShieldCheck, Loader2, PlusCircle, CheckCircle2, Clock,
  Package, Truck, Bell, ChevronRight, X, PenLine,
} from 'lucide-react';
import InlineSignaturePad from '../components/InlineSignaturePad';
import CustomerLogin from '../components/auth/CustomerLogin';
import { listBranches } from '../services/workerService';
import { productService } from '../services/productService';
import {
  subscribeMyWarrantyServices,
  createWarrantyService,
  customerPickupWarranty,
  formatWarrantyDate,
  WARRANTY_STATUS_LABELS,
  WARRANTY_STATUS_ORDER,
  type WarrantyService,
  type WarrantyStatus,
} from '../services/warrantyService';

const statusStyle: Record<WarrantyStatus, { dot: string; text: string; bg: string; border: string }> = {
  submitted: { dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  accepted: { dot: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  in_service: { dot: 'bg-indigo-500', text: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  at_branch: { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  completed: { dot: 'bg-gray-500', text: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' },
};

const StatusBadge: React.FC<{ status: WarrantyStatus }> = ({ status }) => {
  const s = statusStyle[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${s.bg} ${s.text} border ${s.border}`}
      data-testid={`warranty-status-badge-${status}`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${s.dot} ${status !== 'completed' ? 'animate-pulse' : ''}`} />
      {WARRANTY_STATUS_LABELS[status]}
    </span>
  );
};

const WarrantyServicePage: React.FC = () => {
  const [userId, setUserId] = useState<string | null>(() => localStorage.getItem('userId'));
  const userName = localStorage.getItem('userName') || '';
  const userSurname = localStorage.getItem('userSurname') || '';
  const userPhone = localStorage.getItem('userPhone') || '';
  const [showLogin, setShowLogin] = useState(false);

  const [branches, setBranches] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [services, setServices] = useState<WarrantyService[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [fault, setFault] = useState('');
  const [branch, setBranch] = useState('');
  const [signature, setSignature] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Pickup state (per-service)
  const [pickupFor, setPickupFor] = useState<string | null>(null);
  const [pickupSignature, setPickupSignature] = useState('');
  const [pickupSubmitting, setPickupSubmitting] = useState(false);

  useEffect(() => {
    listBranches()
      .then((b) => setBranches(b.map((x) => x.name)))
      .catch(() => setBranches([]));
    productService
      .getAll()
      .then((prods) => {
        const set = new Set<string>();
        prods.forEach((p: any) => { if (p.brand) set.add(String(p.brand).trim()); });
        setBrands(Array.from(set).sort((a, b) => a.localeCompare(b, 'az')));
      })
      .catch(() => setBrands([]));
  }, []);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    const unsub = subscribeMyWarrantyServices(
      userId,
      (items) => { setServices(items); setLoading(false); },
      () => setLoading(false)
    );
    return () => unsub();
  }, [userId]);

  const resetForm = () => {
    setBrand(''); setModel(''); setFault(''); setBranch(''); setSignature(''); setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!brand.trim() || !model.trim() || !fault.trim() || !branch.trim()) {
      setError('Bütün sahələri doldurun: brend, model, nasazlıq və filial.');
      return;
    }
    if (!signature) { setError('Zəhmət olmasa imza atın.'); return; }
    try {
      setSubmitting(true);
      await createWarrantyService({
        userId: userId!,
        customerName: userName,
        customerSurname: userSurname,
        customerPhone: userPhone,
        brand, model, faultDescription: fault, branch,
        handoverSignature: signature,
      });
      resetForm();
      setShowForm(false);
    } catch (err: any) {
      setError(err?.message || 'Yaradıla bilmədi. Yenidən cəhd edin.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePickup = async (id: string) => {
    if (!pickupSignature) return;
    try {
      setPickupSubmitting(true);
      await customerPickupWarranty(id, { pickupSignature });
      setPickupFor(null);
      setPickupSignature('');
    } catch {
      alert('Təsdiq alınmadı. Yenidən cəhd edin.');
    } finally {
      setPickupSubmitting(false);
    }
  };

  const activeCount = useMemo(
    () => services.filter((s) => s.status !== 'completed').length,
    [services]
  );

  // ─────────── Not logged in ───────────
  if (!userId) {
    return (
      <div className="min-h-[70vh] bg-gradient-to-b from-gray-50 to-white flex items-center justify-center px-4 py-16 font-playfair">
        <div className="max-w-md w-full text-center bg-white rounded-3xl border border-gray-200 p-10 shadow-sm">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-black text-white flex items-center justify-center mb-5">
            <ShieldCheck className="h-8 w-8" strokeWidth={1.4} />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Zəmanət xidməti</h1>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            Məhsulunuzu servisə təhvil vermək və vəziyyətini izləmək üçün əvvəlcə hesabınıza daxil olun.
          </p>
          <button
            onClick={() => setShowLogin(true)}
            className="w-full bg-black text-white py-3 rounded-xl font-semibold hover:bg-gray-800 transition-colors"
            data-testid="warranty-login-btn"
          >
            Daxil ol / Qeydiyyat
          </button>
          <Link to="/" className="block mt-4 text-xs text-gray-500 hover:text-gray-900">Əsas səhifəyə qayıt</Link>
        </div>
        {showLogin && (
          <CustomerLogin
            onClose={() => { setShowLogin(false); setUserId(localStorage.getItem('userId')); }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] bg-gradient-to-b from-gray-50 to-white font-playfair pb-24" data-testid="warranty-page">
      {/* Hero */}
      <div className="bg-black text-white">
        <div className="max-w-3xl mx-auto px-4 py-10 sm:py-14">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center">
              <Wrench className="h-6 w-6" strokeWidth={1.4} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold leading-tight">Zəmanət xidməti</h1>
              <p className="text-white/60 text-xs sm:text-sm">Təhvil-təslim aktı.</p>
            </div>
          </div>
          <p className="text-white/70 text-sm leading-relaxed max-w-xl">
            Servisdə təmir müddəti 14 iş günü təşkil edir.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 -mt-6">
        {/* New request button */}
        {!showForm && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="w-full bg-white border border-gray-200 shadow-sm rounded-2xl p-5 flex items-center justify-between hover:border-black transition-colors group"
            data-testid="warranty-new-btn"
          >
            <span className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center group-hover:scale-105 transition-transform">
                <PlusCircle className="h-5 w-5" />
              </span>
              <span className="text-left">
                <span className="block font-semibold text-gray-900">Yeni təhvil-təslim aktı</span>
                <span className="block text-xs text-gray-500">Məhsulu servisə təhvil ver</span>
              </span>
            </span>
            <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-black transition-colors" />
          </button>
        )}

        {/* Create form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="bg-white border-2 border-black rounded-2xl p-5 sm:p-6 shadow-sm"
            data-testid="warranty-form"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Təhvil-təslim aktı</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-700" data-testid="warranty-form-close">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Customer info (read-only from account) */}
            <div className="bg-gray-50 rounded-xl p-3 mb-4 text-sm">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">Müştəri</p>
              <p className="font-semibold text-gray-900">
                {userName} {userSurname}
              </p>
              {userPhone && <p className="text-xs text-gray-500">{userPhone}</p>}
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm" data-testid="warranty-form-error">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Brend</label>
                <input
                  list="warranty-brands"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="Brendi seçin və ya yazın"
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                  data-testid="warranty-brand-input"
                  required
                />
                <datalist id="warranty-brands">
                  {brands.map((b) => <option key={b} value={b} />)}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Modelin nömrəsi</label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Məs.: F20694/6"
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                  data-testid="warranty-model-input"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Nasazlığın təsviri</label>
                <textarea
                  value={fault}
                  onChange={(e) => setFault(e.target.value)}
                  rows={3}
                  placeholder="Problemi qısaca izah edin"
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none resize-none"
                  data-testid="warranty-fault-input"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Hansı filiala təhvil verirsiniz?</label>
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none bg-white"
                  data-testid="warranty-branch-select"
                  required
                >
                  <option value="">Filial seçin</option>
                  {branches.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
                {branches.length === 0 && (
                  <p className="text-[11px] text-gray-400 mt-1">Filiallar yüklənir...</p>
                )}
              </div>

              <div>
                <InlineSignaturePad
                  label="Müştəri imzası (təhvil verən)"
                  value={signature}
                  onChange={setSignature}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-5 inline-flex items-center justify-center gap-2 py-3 bg-black hover:bg-gray-800 disabled:bg-gray-400 text-white font-bold rounded-xl transition-colors"
              data-testid="warranty-submit-btn"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
              Təhvil ver və təsdiqlə
            </button>
          </form>
        )}

        {/* My services list */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Müraciətlərim</h2>
            {activeCount > 0 && (
              <span className="text-xs text-gray-500">{activeCount} aktiv</span>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : services.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300">
              <Package className="h-10 w-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Hələ heç bir müraciətiniz yoxdur.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {services.map((s) => (
                <WarrantyCard
                  key={s.id}
                  service={s}
                  pickupOpen={pickupFor === s.id}
                  pickupSignature={pickupSignature}
                  pickupSubmitting={pickupSubmitting}
                  onOpenPickup={() => { setPickupFor(s.id); setPickupSignature(''); }}
                  onClosePickup={() => { setPickupFor(null); setPickupSignature(''); }}
                  onPickupSign={setPickupSignature}
                  onPickupConfirm={() => handlePickup(s.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const WarrantyCard: React.FC<{
  service: WarrantyService;
  pickupOpen: boolean;
  pickupSignature: string;
  pickupSubmitting: boolean;
  onOpenPickup: () => void;
  onClosePickup: () => void;
  onPickupSign: (v: string) => void;
  onPickupConfirm: () => void;
}> = ({ service: s, pickupOpen, pickupSignature, pickupSubmitting, onOpenPickup, onClosePickup, onPickupSign, onPickupConfirm }) => {
  const activeIdx = WARRANTY_STATUS_ORDER.indexOf(s.status);
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden" data-testid={`warranty-card-${s.id}`}>
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-gray-400">Akt №{s.serviceNumber}</p>
            <h3 className="font-semibold text-gray-900 truncate">{s.brand} — {s.model}</h3>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{s.faultDescription}</p>
          </div>
          <StatusBadge status={s.status} />
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500 mb-3">
          <span>Filial: <b className="text-gray-700">{s.branch}</b></span>
          <span>Tarix: <b className="text-gray-700">{formatWarrantyDate(s.createdAt)}</b></span>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-1 mb-1">
          {WARRANTY_STATUS_ORDER.map((st, i) => (
            <React.Fragment key={st}>
              <div className={`h-1.5 flex-1 rounded-full ${i <= activeIdx ? 'bg-black' : 'bg-gray-200'}`} />
            </React.Fragment>
          ))}
        </div>
        <div className="flex justify-between text-[9px] uppercase tracking-wide text-gray-400">
          <span>Təhvil</span><span>Qəbul</span><span>Servis</span><span>Filial</span><span>Alındı</span>
        </div>

        {/* Accepted info */}
        {s.acceptedWorkerName && (
          <div className="mt-4 flex items-center gap-2 text-sm bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
            <span className="text-blue-800">
              Servisə qəbul etdi: <b>{s.acceptedWorkerName}</b>
              {s.acceptedAt && <span className="text-blue-500 text-xs"> · {formatWarrantyDate(s.acceptedAt)}</span>}
            </span>
          </div>
        )}

        {/* At branch notification + pickup */}
        {s.status === 'at_branch' && (
          <div className="mt-4 bg-emerald-50 border-2 border-emerald-300 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="h-5 w-5 text-emerald-600" />
              <p className="font-bold text-emerald-900 text-sm">Məhsulunuz filialdadır — təhvil ala bilərsiniz!</p>
            </div>
            <p className="text-xs text-emerald-700 mb-3">
              {s.branch} filialına yaxınlaşın. Təhvil alarkən aşağıda imza ataraq təsdiqləyin.
            </p>
            {!pickupOpen ? (
              <button
                onClick={onOpenPickup}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-2"
                data-testid={`warranty-open-pickup-${s.id}`}
              >
                <PenLine className="h-4 w-4" /> Təhvil al və imzala
              </button>
            ) : (
              <div className="bg-white rounded-lg p-3 border border-emerald-200">
                <InlineSignaturePad
                  label="Təhvil alma imzası"
                  value={pickupSignature}
                  onChange={onPickupSign}
                  height={150}
                />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={onClosePickup}
                    className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
                    data-testid={`warranty-cancel-pickup-${s.id}`}
                  >
                    Ləğv et
                  </button>
                  <button
                    onClick={onPickupConfirm}
                    disabled={!pickupSignature || pickupSubmitting}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-bold inline-flex items-center justify-center gap-2"
                    data-testid={`warranty-confirm-pickup-${s.id}`}
                  >
                    {pickupSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Təsdiqlə
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* In service info */}
        {s.status === 'in_service' && (
          <div className="mt-4 flex items-center gap-2 text-sm bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
            <Truck className="h-4 w-4 text-indigo-600 flex-shrink-0" />
            <span className="text-indigo-800">Məhsulunuz servisdədir. Hazır olduqda sizə bildiriləcək.</span>
          </div>
        )}

        {/* Completed */}
        {s.status === 'completed' && (
          <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5 text-gray-700" />
              <p className="font-bold text-gray-900 text-sm">Təhvil alındı</p>
              {s.completedAt && <span className="text-xs text-gray-400">· {formatWarrantyDate(s.completedAt)}</span>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {s.handoverSignature && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Təhvil verən imza</p>
                  <img src={s.handoverSignature} alt="İmza" className="bg-white border border-gray-200 rounded max-h-20" />
                </div>
              )}
              {s.pickupSignature && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Təhvil alan imza</p>
                  <img src={s.pickupSignature} alt="İmza" className="bg-white border border-gray-200 rounded max-h-20" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Submitted waiting */}
        {s.status === 'submitted' && (
          <div className="mt-4 flex items-center gap-2 text-sm bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            <Clock className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <span className="text-amber-800">Mağaza tərəfindən servisə qəbul gözlənilir.</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default WarrantyServicePage;
