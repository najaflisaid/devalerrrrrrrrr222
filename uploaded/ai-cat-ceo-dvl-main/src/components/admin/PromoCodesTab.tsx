import React, { useEffect, useState, useMemo } from 'react';
import {
  Ticket,
  Plus,
  Copy,
  Trash2,
  Check,
  Loader2,
  X,
  Search,
  User as UserIcon,
  Megaphone,
  Calendar,
  Power,
  ChevronDown,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import {
  createPromoCode,
  listPromoCodes,
  deletePromoCode,
  createCampaignPromoCode,
  setPromoCodeActive,
  cleanupExpiredCampaignCodes,
  type PromoCode,
} from '../../services/promoCodeService';
import { userService } from '../../services/userService';
import type { User } from '../../types';

const DISCOUNT_OPTIONS = [5, 10, 15, 20];

const formatDate = (raw: any): string => {
  if (!raw) return '';
  const d = raw?.toDate ? raw.toDate() : new Date(raw);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatDateShort = (raw: any): string => {
  if (!raw) return '—';
  const d = raw?.toDate ? raw.toDate() : new Date(raw);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
};

// datetime-local input üçün ISO formatı
const toLocalInputValue = (date: Date): string => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const PromoCodesTab: React.FC = () => {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<'single' | 'campaign'>('single');

  // --- Birdəfəlik (single-use) state ---
  const [creating, setCreating] = useState<number | null>(null);
  const [recent, setRecent] = useState<PromoCode | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unused' | 'used'>('all');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [userSearch, setUserSearch] = useState('');

  // --- Kampaniya state ---
  const defaultStart = useMemo(() => new Date(), []);
  const defaultEnd = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d;
  }, []);
  const [campCode, setCampCode] = useState('');
  const [campDiscount, setCampDiscount] = useState<number>(10);
  const [campDiscountCustom, setCampDiscountCustom] = useState<string>('');
  const [campStart, setCampStart] = useState<string>(toLocalInputValue(defaultStart));
  const [campEnd, setCampEnd] = useState<string>(toLocalInputValue(defaultEnd));
  const [campLimit, setCampLimit] = useState<string>('');
  const [campInfluencer, setCampInfluencer] = useState('');
  const [campCreating, setCampCreating] = useState(false);
  const [campError, setCampError] = useState('');
  const [campRecent, setCampRecent] = useState<PromoCode | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    void load();
    // Müştəriləri də paralel yükləyirik
    userService
      .getAllUsers()
      .then((all) => {
        const customers = all.filter((u) => (u as any).role === 'customer' || !(u as any).role);
        setUsers(customers);
      })
      .catch(() => setUsers([]));
    // Müddəti bitmiş kampaniya kodlarını avtomatik təmizlə
    cleanupExpiredCampaignCodes()
      .then((n) => {
        if (n > 0) void load();
      })
      .catch(() => {});
  }, []);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users.slice(0, 30);
    return users
      .filter((u) => {
        const name = ((u as any).name || '').toLowerCase();
        const email = ((u as any).email || '').toLowerCase();
        return name.includes(q) || email.includes(q);
      })
      .slice(0, 30);
  }, [users, userSearch]);

  const selectedUser = users.find((u) => (u as any).id === selectedUserId);

  const load = async () => {
    setLoading(true);
    try {
      setCodes(await listPromoCodes());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSingle = async (discount: number) => {
    setCreating(discount);
    try {
      const adminEmail = localStorage.getItem('userEmail') || '';
      const assignedTo = selectedUser
        ? {
            userId: (selectedUser as any).id as string,
            userEmail: (selectedUser as any).email as string | undefined,
            userName: (selectedUser as any).name as string | undefined,
          }
        : undefined;
      const created = await createPromoCode(discount, adminEmail, assignedTo);
      setRecent(created);
      await load();
    } catch (e) {
      alert('Yaradılmadı: ' + (e as Error).message);
    } finally {
      setCreating(null);
    }
  };

  const handleDelete = async (code: string) => {
    if (!confirm(`Promo kod "${code}" silinsin?`)) return;
    try {
      await deletePromoCode(code);
      setCodes((prev) => prev.filter((c) => c.code !== code));
    } catch (e) {
      alert('Silinmədi: ' + (e as Error).message);
    }
  };

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  };

  const handleCreateCampaign = async () => {
    setCampError('');
    setCampCreating(true);
    try {
      const customDiscount = campDiscountCustom.trim() ? parseInt(campDiscountCustom, 10) : campDiscount;
      if (isNaN(customDiscount) || customDiscount < 1 || customDiscount > 99) {
        throw new Error('Endirim faizi 1-99 arası olmalıdır');
      }
      if (!campStart || !campEnd) {
        throw new Error('Başlama və bitmə tarixi mütləqdir');
      }
      const startDate = new Date(campStart);
      const endDate = new Date(campEnd);
      const adminEmail = localStorage.getItem('userEmail') || '';
      const limit = campLimit.trim() ? parseInt(campLimit, 10) : 0;
      const created = await createCampaignPromoCode({
        code: campCode,
        discount: customDiscount,
        startsAt: startDate,
        expiresAt: endDate,
        usageLimit: isNaN(limit) ? 0 : limit,
        influencerName: campInfluencer,
        createdBy: adminEmail,
      });
      setCampRecent(created);
      // Forma sıfırla
      setCampCode('');
      setCampInfluencer('');
      setCampLimit('');
      setCampDiscountCustom('');
      await load();
    } catch (e) {
      setCampError((e as Error).message);
    } finally {
      setCampCreating(false);
    }
  };

  const handleToggleActive = async (code: PromoCode) => {
    const next = !(code.active !== false); // default true
    try {
      await setPromoCodeActive(code.code, next);
      setCodes((prev) => prev.map((c) => (c.code === code.code ? { ...c, active: next } : c)));
    } catch (e) {
      alert('Yenilənmədi: ' + (e as Error).message);
    }
  };

  const singleCodes = codes.filter((c) => c.kind !== 'campaign');
  const campaignCodes = codes.filter((c) => c.kind === 'campaign');

  const filteredSingle = singleCodes.filter((c) => {
    if (filter === 'unused') return !c.used;
    if (filter === 'used') return c.used;
    return true;
  });

  const unusedCount = singleCodes.filter((c) => !c.used).length;
  const usedCount = singleCodes.length - unusedCount;

  return (
    <div className="space-y-5" data-testid="promo-codes-tab">
      {/* Sub-tab toggle */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1.5 inline-flex gap-1">
        <button
          onClick={() => setSection('single')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2 ${
            section === 'single' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'
          }`}
          data-testid="promo-section-single"
        >
          <Ticket className="h-4 w-4" />
          Birdəfəlik kodlar ({singleCodes.length})
        </button>
        <button
          onClick={() => setSection('campaign')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2 ${
            section === 'campaign' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'
          }`}
          data-testid="promo-section-campaign"
        >
          <Megaphone className="h-4 w-4" />
          Kampaniya kodları ({campaignCodes.length})
        </button>
      </div>

      {section === 'single' && (
        <>
          {/* Header & generate buttons */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-2">
              <Ticket className="h-5 w-5 text-gray-700" />
              <h2 className="text-xl font-bold text-gray-900">Birdəfəlik Promo Kodlar</h2>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              Pərakəndə müştərilər üçün birdəfəlik istifadəyə yararlı promo kodlar yaradın.
              Düymələrdən birini sıxın — sistem 6 rəqəmli unikal kod yaradacaq.
              {selectedUser ? (
                <span className="block mt-1 text-emerald-700">
                  Bu kod yalnız <b>{(selectedUser as any).name || (selectedUser as any).email}</b> müştərisi üçün etibarlı olacaq.
                </span>
              ) : (
                <span className="block mt-1 text-gray-500 text-xs">
                  Müştəri seçməsəz, kod hər kəs tərəfindən istifadə edilə biləndir.
                </span>
              )}
            </p>

            {/* Müştəri seçim paneli (istəyə bağlı) */}
            <div className="mb-5 bg-gray-50 rounded-lg border border-gray-200 p-4">
              <label className="text-xs uppercase tracking-wider text-gray-600 font-semibold flex items-center gap-1.5 mb-2">
                <UserIcon className="h-3.5 w-3.5" /> Konkret müştəriyə təyin et (istəyə bağlı)
              </label>
              {selectedUser ? (
                <div className="flex items-center justify-between gap-3 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg" data-testid="promo-selected-user">
                  <div className="text-sm">
                    <p className="font-semibold text-emerald-900">{(selectedUser as any).name || 'Adsız'}</p>
                    <p className="text-xs text-emerald-700">{(selectedUser as any).email}</p>
                  </div>
                  <button
                    onClick={() => { setSelectedUserId(''); setUserSearch(''); }}
                    className="text-xs text-emerald-700 hover:text-emerald-900 underline"
                    data-testid="promo-clear-user"
                  >
                    Sil
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Ad və ya e-poçtla axtar..."
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
                      data-testid="promo-user-search"
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
                    {filteredUsers.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4">
                        {userSearch ? 'Uyğun müştəri tapılmadı' : 'Müştəri yüklənir...'}
                      </p>
                    ) : (
                      filteredUsers.map((u) => (
                        <button
                          key={(u as any).id}
                          type="button"
                          onClick={() => setSelectedUserId((u as any).id)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                          data-testid={`promo-pick-user-${(u as any).id}`}
                        >
                          <UserIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-gray-900 truncate">{(u as any).name || 'Adsız'}</p>
                            <p className="text-xs text-gray-500 truncate">{(u as any).email}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {DISCOUNT_OPTIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => handleCreateSingle(d)}
                  disabled={creating !== null}
                  className="group relative flex flex-col items-center justify-center gap-1 px-4 py-5 rounded-xl border-2 border-gray-200 hover:border-gray-900 hover:bg-gray-900 hover:text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  data-testid={`generate-promo-${d}`}
                >
                  {creating === d ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <>
                      <span className="text-3xl font-bold tabular-nums">{d}%</span>
                      <span className="text-[11px] uppercase tracking-wider opacity-70 group-hover:opacity-100 flex items-center gap-1">
                        <Plus className="h-3 w-3" /> Kod yarat
                      </span>
                    </>
                  )}
                </button>
              ))}
            </div>

            {recent && (
              <div className="mt-5 p-5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-wider text-emerald-700 mb-1">Yeni kod yaradıldı ({recent.discount}% endirim)</p>
                  <p className="font-mono text-3xl font-bold text-emerald-900 tabular-nums">{recent.code}</p>
                </div>
                <button
                  onClick={() => handleCopy(recent.code)}
                  className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 inline-flex items-center gap-2 text-sm font-medium"
                  data-testid="copy-recent-code"
                >
                  {copied === recent.code ? <><Check className="h-4 w-4" /> Köçürüldü</> : <><Copy className="h-4 w-4" /> Köçür</>}
                </button>
                <button
                  onClick={() => setRecent(null)}
                  className="p-2 text-emerald-700 hover:bg-emerald-100 rounded-lg"
                  aria-label="Bağla"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Codes list */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="text-base font-bold text-gray-900">Bütün Kodlar ({singleCodes.length})</h3>
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                {([
                  ['all', `Hamısı (${singleCodes.length})`],
                  ['unused', `İstifadə olunmamış (${unusedCount})`],
                  ['used', `İstifadə olunmuş (${usedCount})`],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      filter === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                    }`}
                    data-testid={`filter-${key}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : filteredSingle.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                {singleCodes.length === 0 ? 'Hələ promo kod yoxdur. Yuxarıdan yaradın.' : 'Bu filtərdə kod yoxdur.'}
              </div>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
                      <th className="text-left px-2 py-2 font-medium">Kod</th>
                      <th className="text-center px-2 py-2 font-medium">Endirim</th>
                      <th className="text-left px-2 py-2 font-medium">Status</th>
                      <th className="text-left px-2 py-2 font-medium">Yaradılıb</th>
                      <th className="text-left px-2 py-2 font-medium">Təyinat / İstifadə</th>
                      <th className="px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredSingle.map((c) => (
                      <tr key={c.code} className="hover:bg-gray-50/60" data-testid={`promo-row-${c.code}`}>
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-base font-bold text-gray-900 tabular-nums">{c.code}</span>
                            <button
                              onClick={() => handleCopy(c.code)}
                              className="p-1 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded"
                              title="Kodu köçür"
                            >
                              {copied === c.code ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </td>
                        <td className="px-2 py-3 text-center">
                          <span className="inline-block px-2 py-0.5 bg-gray-900 text-white text-xs font-bold rounded">
                            {c.discount}%
                          </span>
                        </td>
                        <td className="px-2 py-3">
                          {c.used ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                              İstifadə olunub
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded-full">
                              Aktiv
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(c.createdAt)}</td>
                        <td className="px-2 py-3 text-xs text-gray-600">
                          {c.assignedTo?.userId ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] rounded-full" title={c.assignedTo.userEmail}>
                              <UserIcon className="h-3 w-3" />
                              {c.assignedTo.userName || c.assignedTo.userEmail || 'müştəri'}
                            </span>
                          ) : (
                            <span className="text-gray-400">Hamı üçün</span>
                          )}
                          {c.usedBy?.userEmail && (
                            <p className="text-[10px] text-gray-400 mt-0.5">İstifadə: {c.usedBy.userEmail}</p>
                          )}
                          {c.usedAt && <p className="text-[10px] text-gray-400">{formatDate(c.usedAt)}</p>}
                        </td>
                        <td className="px-2 py-3 text-right">
                          <button
                            onClick={() => handleDelete(c.code)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Sil"
                            data-testid={`delete-promo-${c.code}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {section === 'campaign' && (
        <>
          {/* Campaign create form */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-2">
              <Megaphone className="h-5 w-5 text-gray-700" />
              <h2 className="text-xl font-bold text-gray-900">Kampaniya Promo Kodu (Bloger / Influencer)</h2>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              Bloger və ya influencer üçün müddətli kod yaradın. Onun izləyiciləri bu kodu sayt üzərində istifadə edərək endirim ala bilərlər.
              Müddət bitdikdə kod avtomatik silinir.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs uppercase tracking-wider text-gray-600 font-semibold mb-1.5 block">
                  Promo kod *
                </label>
                <input
                  type="text"
                  value={campCode}
                  onChange={(e) => setCampCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  placeholder="BLOGER10"
                  maxLength={20}
                  className="w-full px-3 py-2.5 text-sm font-mono uppercase tracking-wider border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  data-testid="campaign-code-input"
                />
                <p className="text-[11px] text-gray-500 mt-1">Yalnız hərf və rəqəm, 3-20 simvol.</p>
              </div>

              <div>
                <label className="text-xs uppercase tracking-wider text-gray-600 font-semibold mb-1.5 block">
                  Influencer / bloger adı
                </label>
                <input
                  type="text"
                  value={campInfluencer}
                  onChange={(e) => setCampInfluencer(e.target.value)}
                  placeholder="məs: @username"
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  data-testid="campaign-influencer-input"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs uppercase tracking-wider text-gray-600 font-semibold mb-1.5 block">
                  Endirim faizi *
                </label>
                <div className="flex flex-wrap gap-2 items-center">
                  {DISCOUNT_OPTIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => { setCampDiscount(d); setCampDiscountCustom(''); }}
                      className={`px-4 py-2 rounded-lg border-2 text-sm font-bold transition-colors ${
                        !campDiscountCustom && campDiscount === d
                          ? 'border-gray-900 bg-gray-900 text-white'
                          : 'border-gray-200 text-gray-700 hover:border-gray-400'
                      }`}
                      data-testid={`campaign-discount-${d}`}
                    >
                      {d}%
                    </button>
                  ))}
                  <div className="flex items-center gap-1.5 ml-1">
                    <span className="text-xs text-gray-500">və ya</span>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={campDiscountCustom}
                      onChange={(e) => setCampDiscountCustom(e.target.value)}
                      placeholder="özün yaz"
                      className="w-24 px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      data-testid="campaign-discount-custom"
                    />
                    <span className="text-sm text-gray-600">%</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs uppercase tracking-wider text-gray-600 font-semibold mb-1.5 block flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Başlama tarixi *
                </label>
                <input
                  type="datetime-local"
                  value={campStart}
                  onChange={(e) => setCampStart(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  data-testid="campaign-start-input"
                />
              </div>

              <div>
                <label className="text-xs uppercase tracking-wider text-gray-600 font-semibold mb-1.5 block flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Bitmə tarixi *
                </label>
                <input
                  type="datetime-local"
                  value={campEnd}
                  onChange={(e) => setCampEnd(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  data-testid="campaign-end-input"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs uppercase tracking-wider text-gray-600 font-semibold mb-1.5 block">
                  İstifadə limiti (max neçə dəfə)
                </label>
                <input
                  type="number"
                  min={0}
                  value={campLimit}
                  onChange={(e) => setCampLimit(e.target.value)}
                  placeholder="Boş qoyun = limitsiz"
                  className="w-full md:w-64 px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  data-testid="campaign-limit-input"
                />
                <p className="text-[11px] text-gray-500 mt-1">Boş qoysanız kod limitsiz dəfə istifadə edilə bilər.</p>
              </div>
            </div>

            {campError && (
              <div className="mt-4 px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg" data-testid="campaign-error">
                {campError}
              </div>
            )}

            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={handleCreateCampaign}
                disabled={campCreating || !campCode.trim()}
                className="px-5 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-black inline-flex items-center gap-2 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                data-testid="campaign-create-btn"
              >
                {campCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Kampaniya kodu yarat
              </button>
            </div>

            {campRecent && (
              <div className="mt-5 p-5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-wider text-emerald-700 mb-1">
                    Yeni kampaniya kodu ({campRecent.discount}% endirim)
                    {campRecent.influencerName && ` • ${campRecent.influencerName}`}
                  </p>
                  <p className="font-mono text-3xl font-bold text-emerald-900 tracking-wider">{campRecent.code}</p>
                  <p className="text-[11px] text-emerald-700 mt-1">
                    {formatDateShort(campRecent.startsAt)} → {formatDateShort(campRecent.expiresAt)}
                    {campRecent.usageLimit ? ` • limit: ${campRecent.usageLimit}` : ' • limitsiz'}
                  </p>
                </div>
                <button
                  onClick={() => handleCopy(campRecent.code)}
                  className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 inline-flex items-center gap-2 text-sm font-medium"
                  data-testid="copy-campaign-code"
                >
                  {copied === campRecent.code ? <><Check className="h-4 w-4" /> Köçürüldü</> : <><Copy className="h-4 w-4" /> Köçür</>}
                </button>
                <button
                  onClick={() => setCampRecent(null)}
                  className="p-2 text-emerald-700 hover:bg-emerald-100 rounded-lg"
                  aria-label="Bağla"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Campaign codes list */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-base font-bold text-gray-900 mb-4">
              Kampaniya Kodları ({campaignCodes.length})
            </h3>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : campaignCodes.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                Hələ kampaniya kodu yoxdur. Yuxarıdan yaradın.
              </div>
            ) : (
              <div className="space-y-2">
                {campaignCodes.map((c) => {
                  const isActive = c.active !== false;
                  const now = Date.now();
                  const startMs = c.startsAt?.toMillis ? c.startsAt.toMillis() : 0;
                  const expMs = c.expiresAt?.toMillis ? c.expiresAt.toMillis() : 0;
                  const isExpired = expMs && now > expMs;
                  const isPending = startMs && now < startMs;
                  const limitReached = c.usageLimit && c.usageLimit > 0 && (c.usageCount || 0) >= c.usageLimit;
                  const isOpen = expanded === c.code;
                  const usagePercent =
                    c.usageLimit && c.usageLimit > 0
                      ? Math.min(100, Math.round(((c.usageCount || 0) / c.usageLimit) * 100))
                      : 0;

                  return (
                    <div
                      key={c.code}
                      className={`border rounded-xl overflow-hidden transition-colors ${
                        isExpired ? 'border-red-200 bg-red-50/30' :
                        !isActive ? 'border-gray-200 bg-gray-50/30' :
                        'border-gray-200 hover:border-gray-300'
                      }`}
                      data-testid={`campaign-row-${c.code}`}
                    >
                      <div className="p-4 flex items-center gap-4">
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : c.code)}
                          className="p-1 text-gray-400 hover:text-gray-900"
                          aria-label="Statistika"
                        >
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-lg font-bold text-gray-900 tracking-wider">{c.code}</span>
                            <span className="px-2 py-0.5 bg-gray-900 text-white text-xs font-bold rounded">
                              {c.discount}%
                            </span>
                            {c.influencerName && (
                              <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded-full inline-flex items-center gap-1">
                                <Megaphone className="h-3 w-3" />
                                {c.influencerName}
                              </span>
                            )}
                            {isExpired ? (
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                                Müddət bitib
                              </span>
                            ) : isPending ? (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                                Hələ başlayıb
                              </span>
                            ) : limitReached ? (
                              <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded-full">
                                Limit dolub
                              </span>
                            ) : isActive ? (
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded-full">
                                Aktiv
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                                Deaktiv
                              </span>
                            )}
                          </div>
                          <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDateShort(c.startsAt)} → {formatDateShort(c.expiresAt)}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" />
                              {c.usageCount || 0} istifadə
                              {c.usageLimit && c.usageLimit > 0 ? ` / ${c.usageLimit}` : ' (limitsiz)'}
                            </span>
                          </div>
                          {c.usageLimit && c.usageLimit > 0 && (
                            <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all ${usagePercent >= 100 ? 'bg-red-500' : 'bg-emerald-500'}`}
                                style={{ width: `${usagePercent}%` }}
                              />
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleCopy(c.code)}
                            className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                            title="Kodu köçür"
                            data-testid={`campaign-copy-${c.code}`}
                          >
                            {copied === c.code ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => handleToggleActive(c)}
                            className={`p-2 rounded-lg ${
                              isActive ? 'text-emerald-600 hover:bg-emerald-50' : 'text-gray-400 hover:bg-gray-100'
                            }`}
                            title={isActive ? 'Deaktiv et' : 'Aktiv et'}
                            data-testid={`campaign-toggle-${c.code}`}
                          >
                            <Power className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(c.code)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            title="Sil"
                            data-testid={`campaign-delete-${c.code}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {isOpen && (
                        <div className="border-t border-gray-200 bg-gray-50/50 px-4 py-3">
                          <p className="text-xs uppercase tracking-wider text-gray-600 font-semibold mb-2">
                            İstifadə tarixçəsi
                          </p>
                          {!c.usageHistory || c.usageHistory.length === 0 ? (
                            <p className="text-xs text-gray-400 py-2">Hələ heç kim istifadə etməyib.</p>
                          ) : (
                            <div className="space-y-1">
                              {c.usageHistory.slice().reverse().map((u, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between gap-2 text-xs bg-white border border-gray-200 rounded-lg px-3 py-1.5"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <UserIcon className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                    <span className="font-medium text-gray-900 truncate">
                                      {u.userName || u.userEmail || 'Qonaq'}
                                    </span>
                                    {u.userEmail && u.userName && (
                                      <span className="text-gray-500 truncate">({u.userEmail})</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    {u.orderId && (
                                      <span className="text-gray-400 font-mono text-[10px]">#{u.orderId.slice(-8)}</span>
                                    )}
                                    <span className="text-gray-500">{formatDate(u.usedAt)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default PromoCodesTab;
