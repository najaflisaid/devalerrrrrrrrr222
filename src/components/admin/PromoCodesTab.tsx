import React, { useEffect, useState } from 'react';
import { Ticket, Plus, Copy, Trash2, Check, Loader2, X } from 'lucide-react';
import {
  createPromoCode,
  listPromoCodes,
  deletePromoCode,
  type PromoCode,
} from '../../services/promoCodeService';

const DISCOUNT_OPTIONS = [5, 10, 15, 20];

const formatDate = (raw: any): string => {
  if (!raw) return '';
  const d = raw?.toDate ? raw.toDate() : new Date(raw);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const PromoCodesTab: React.FC = () => {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<number | null>(null);
  const [recent, setRecent] = useState<PromoCode | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unused' | 'used'>('all');

  useEffect(() => {
    void load();
  }, []);

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

  const handleCreate = async (discount: number) => {
    setCreating(discount);
    try {
      const adminEmail = localStorage.getItem('userEmail') || '';
      const created = await createPromoCode(discount, adminEmail);
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

  const filtered = codes.filter((c) => {
    if (filter === 'unused') return !c.used;
    if (filter === 'used') return c.used;
    return true;
  });

  const unusedCount = codes.filter((c) => !c.used).length;
  const usedCount = codes.length - unusedCount;

  return (
    <div className="space-y-5" data-testid="promo-codes-tab">
      {/* Header & generate buttons */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-2">
          <Ticket className="h-5 w-5 text-gray-700" />
          <h2 className="text-xl font-bold text-gray-900">Promo Kodlar</h2>
        </div>
        <p className="text-sm text-gray-600 mb-5">
          Pərakəndə müştərilər üçün birdəfəlik istifadəyə yararlı promo kodlar yaradın.
          Düymələrdən birini sıxın — sistem 6 rəqəmli unikal kod yaradacaq.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {DISCOUNT_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => handleCreate(d)}
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

        {/* Recent generated code popup */}
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
          <h3 className="text-base font-bold text-gray-900">Bütün Kodlar ({codes.length})</h3>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {([
              ['all', `Hamısı (${codes.length})`],
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
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            {codes.length === 0 ? 'Hələ promo kod yoxdur. Yuxarıdan yaradın.' : 'Bu filtərdə kod yoxdur.'}
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
                  <th className="text-left px-2 py-2 font-medium">İstifadəçi</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((c) => (
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
                      {c.usedBy?.userEmail || c.usedBy?.userId || (c.used ? '—' : '—')}
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
    </div>
  );
};

export default PromoCodesTab;
