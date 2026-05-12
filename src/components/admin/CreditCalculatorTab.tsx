import React, { useEffect, useState } from 'react';
import {
  Loader2,
  Plus,
  Trash2,
  Upload,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  Percent,
  CreditCard,
} from 'lucide-react';
import {
  getCreditConfig,
  saveCreditConfig,
  uploadCardLogo,
  defaultConfig,
  type CreditCalculatorConfig,
  type BrandCreditConfig,
  type InstallmentCard,
  type BrandRate,
} from '../../services/creditCalculatorService';
import { productService } from '../../services/productService';

const newCardId = () =>
  `card_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const CreditCalculatorTab: React.FC = () => {
  const [data, setData] = useState<CreditCalculatorConfig>(defaultConfig());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingCardId, setUploadingCardId] = useState<string | null>(null);
  const [allBrands, setAllBrands] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [defaultMonthsInput, setDefaultMonthsInput] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [cfg, prods] = await Promise.all([
          getCreditConfig(),
          productService.getAll().catch(() => [] as any[]),
        ]);
        setData(cfg);
        setDefaultMonthsInput((cfg.defaultMonths || []).join(', '));
        const uniq = Array.from(
          new Set(prods.map((p: any) => (p.brand || '').trim()).filter(Boolean))
        ).sort();
        setAllBrands(uniq as string[]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ===== Default months =====
  const parseMonths = (s: string): number[] => {
    return Array.from(
      new Set(
        s
          .split(/[,\s]+/)
          .map((x) => parseInt(x, 10))
          .filter((n) => !isNaN(n) && n > 0 && n <= 60)
      )
    ).sort((a, b) => a - b);
  };

  // ===== Brand rates =====
  const addBrandConfig = () => {
    setData((d) => ({
      ...d,
      brandRates: [...d.brandRates, { brand: '', rates: [] }],
    }));
  };
  const removeBrandConfig = (idx: number) => {
    setData((d) => ({
      ...d,
      brandRates: d.brandRates.filter((_, i) => i !== idx),
    }));
  };
  const updateBrandConfig = (idx: number, patch: Partial<BrandCreditConfig>) => {
    setData((d) => {
      const arr = [...d.brandRates];
      arr[idx] = { ...arr[idx], ...patch };
      return { ...d, brandRates: arr };
    });
  };
  const addRate = (brandIdx: number) => {
    setData((d) => {
      const arr = [...d.brandRates];
      arr[brandIdx] = {
        ...arr[brandIdx],
        rates: [...(arr[brandIdx].rates || []), { months: 6, percent: 18 }],
      };
      return { ...d, brandRates: arr };
    });
  };
  const updateRate = (
    brandIdx: number,
    rateIdx: number,
    patch: Partial<BrandRate>
  ) => {
    setData((d) => {
      const arr = [...d.brandRates];
      const rates = [...(arr[brandIdx].rates || [])];
      rates[rateIdx] = { ...rates[rateIdx], ...patch };
      arr[brandIdx] = { ...arr[brandIdx], rates };
      return { ...d, brandRates: arr };
    });
  };
  const removeRate = (brandIdx: number, rateIdx: number) => {
    setData((d) => {
      const arr = [...d.brandRates];
      arr[brandIdx] = {
        ...arr[brandIdx],
        rates: (arr[brandIdx].rates || []).filter((_, i) => i !== rateIdx),
      };
      return { ...d, brandRates: arr };
    });
  };

  // ===== Installment cards =====
  const addCard = () => {
    setData((d) => ({
      ...d,
      installmentCards: [
        ...d.installmentCards,
        {
          id: newCardId(),
          name: '',
          logoUrl: '',
          months: [6, 12, 18],
          bgColor: '#000000',
          isActive: true,
        },
      ],
    }));
  };
  const removeCard = (id: string) => {
    setData((d) => ({
      ...d,
      installmentCards: d.installmentCards.filter((c) => c.id !== id),
    }));
  };
  const updateCard = (id: string, patch: Partial<InstallmentCard>) => {
    setData((d) => ({
      ...d,
      installmentCards: d.installmentCards.map((c) =>
        c.id === id ? { ...c, ...patch } : c
      ),
    }));
  };
  const handleCardLogo = async (
    id: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      setMsg({ type: 'err', text: 'Loqo 3MB-dan böyük ola bilməz' });
      return;
    }
    setUploadingCardId(id);
    try {
      const url = await uploadCardLogo(file);
      updateCard(id, { logoUrl: url });
      setMsg({ type: 'ok', text: 'Loqo yükləndi' });
    } catch (err: any) {
      setMsg({
        type: 'err',
        text: 'Yükləmə xətası: ' + (err?.message || 'naməlum'),
      });
    } finally {
      setUploadingCardId(null);
    }
  };

  const handleSave = async () => {
    setMsg(null);
    setSaving(true);
    try {
      const cleaned: CreditCalculatorConfig = {
        ...data,
        defaultMonths: parseMonths(defaultMonthsInput),
        brandRates: data.brandRates
          .filter((b) => (b.brand || '').trim())
          .map((b) => ({
            brand: b.brand.trim(),
            rates: (b.rates || [])
              .filter((r) => r.months > 0)
              .map((r) => ({ months: +r.months, percent: +r.percent || 0 }))
              .sort((a, b) => a.months - b.months),
          })),
        installmentCards: data.installmentCards.map((c) => ({
          ...c,
          name: (c.name || '').trim(),
          months: Array.from(new Set((c.months || []).filter((m) => m > 0))).sort(
            (a, b) => a - b
          ),
        })),
      };
      await saveCreditConfig(cleaned);
      setData(cleaned);
      setDefaultMonthsInput(cleaned.defaultMonths.join(', '));
      setMsg({ type: 'ok', text: 'Yadda saxlanıldı' });
    } catch (err: any) {
      setMsg({
        type: 'err',
        text: 'Yadda saxlama xətası: ' + (err?.message || 'naməlum'),
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="credit-calculator-tab">
      {msg && (
        <div
          className={`rounded-lg border px-4 py-3 flex items-center gap-2 text-sm ${
            msg.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {msg.type === 'ok' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Enable + default months */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Hissəli alış kalkulyatoru
          </h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={data.enabled}
              onChange={(e) => setData((d) => ({ ...d, enabled: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
              data-testid="cc-enabled"
            />
            <span className="text-sm font-medium text-gray-900">Aktiv</span>
          </label>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1.5">
            Default ay seçimləri (faiz təyin edilməmiş brendlər üçün — faizsiz)
          </label>
          <input
            type="text"
            value={defaultMonthsInput}
            onChange={(e) => setDefaultMonthsInput(e.target.value)}
            placeholder="məs: 6, 9, 12, 15, 18, 24"
            className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:border-gray-900 focus:outline-none"
            data-testid="cc-default-months"
          />
          <p className="text-[11px] text-gray-500 mt-1">
            Vergüllə ayırın. Bu siyahıdakı bütün aylar 0% (faizsiz) göstərilir.
          </p>
        </div>
      </div>

      {/* Brand rates */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              Brend üzrə faizlər
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Burada qeyd olunmayan brendlərin məhsulları FAİZSİZ kateqoriyada
              göstərilir.
            </p>
          </div>
          <button
            type="button"
            onClick={addBrandConfig}
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800"
            data-testid="cc-add-brand"
          >
            <Plus className="h-4 w-4" />
            Brend əlavə et
          </button>
        </div>

        {data.brandRates.length === 0 ? (
          <p className="text-sm text-gray-400 italic text-center py-6">
            Hələ brend əlavə edilməyib — bütün məhsullar faizsiz göstərilir.
          </p>
        ) : (
          <div className="space-y-4">
            {data.brandRates.map((bc, bIdx) => (
              <div
                key={bIdx}
                className="rounded-lg border border-gray-200 p-4 bg-gray-50"
              >
                <div className="flex items-center gap-3 mb-3">
                  <input
                    type="text"
                    list={`brands-list-${bIdx}`}
                    value={bc.brand}
                    onChange={(e) =>
                      updateBrandConfig(bIdx, { brand: e.target.value })
                    }
                    placeholder="Brend adı (məs: Apple)"
                    className="flex-1 h-10 px-3 border border-gray-300 rounded-lg text-sm bg-white focus:border-gray-900 focus:outline-none"
                    data-testid={`cc-brand-name-${bIdx}`}
                  />
                  <datalist id={`brands-list-${bIdx}`}>
                    {allBrands.map((b) => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                  <button
                    type="button"
                    onClick={() => removeBrandConfig(bIdx)}
                    className="h-10 w-10 inline-flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50 border border-red-200"
                    data-testid={`cc-brand-remove-${bIdx}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-2">
                  {(bc.rates || []).map((r, rIdx) => (
                    <div key={rIdx} className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={1}
                          max={60}
                          value={r.months}
                          onChange={(e) =>
                            updateRate(bIdx, rIdx, { months: +e.target.value })
                          }
                          className="w-20 h-9 px-2 border border-gray-300 rounded-lg text-sm text-center bg-white focus:border-gray-900 focus:outline-none"
                          data-testid={`cc-rate-months-${bIdx}-${rIdx}`}
                        />
                        <span className="text-xs text-gray-500">ay</span>
                      </div>
                      <span className="text-gray-300">→</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          max={99}
                          step={0.1}
                          value={r.percent}
                          onChange={(e) =>
                            updateRate(bIdx, rIdx, {
                              percent: +e.target.value,
                            })
                          }
                          className="w-20 h-9 px-2 border border-gray-300 rounded-lg text-sm text-center bg-white focus:border-gray-900 focus:outline-none"
                          data-testid={`cc-rate-percent-${bIdx}-${rIdx}`}
                        />
                        <span className="text-xs text-gray-500">%</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeRate(bIdx, rIdx)}
                        className="ml-auto h-9 w-9 inline-flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addRate(bIdx)}
                    className="inline-flex items-center gap-1 px-2.5 h-8 rounded-lg border border-dashed border-gray-300 text-xs text-gray-700 hover:bg-white"
                    data-testid={`cc-rate-add-${bIdx}`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Ay/faiz əlavə et
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Installment cards */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Taksitlə al kartları (faizsiz)
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Bank kartları (Birbank, LeoBank və s.) — burada faiz yoxdur, qiymət
              aylara bölünür.
            </p>
          </div>
          <button
            type="button"
            onClick={addCard}
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800"
            data-testid="cc-add-card"
          >
            <Plus className="h-4 w-4" />
            Kart əlavə et
          </button>
        </div>

        {data.installmentCards.length === 0 ? (
          <p className="text-sm text-gray-400 italic text-center py-6">
            Hələ kart əlavə edilməyib.
          </p>
        ) : (
          <div className="space-y-3">
            {data.installmentCards.map((c) => (
              <div
                key={c.id}
                className="rounded-lg border border-gray-200 p-4 bg-gray-50"
              >
                <div className="flex items-start gap-4">
                  {/* Logo */}
                  <div className="flex-shrink-0">
                    <div
                      className="w-16 h-16 rounded-xl border border-gray-200 flex items-center justify-center overflow-hidden"
                      style={{ backgroundColor: c.bgColor || '#fff' }}
                    >
                      {c.logoUrl ? (
                        <img
                          src={c.logoUrl}
                          alt={c.name}
                          className="max-w-full max-h-full object-contain"
                        />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-gray-300" />
                      )}
                    </div>
                    <label className="mt-2 inline-flex items-center gap-1 px-2 h-7 rounded border border-gray-300 bg-white text-[11px] text-gray-700 cursor-pointer hover:bg-gray-50">
                      <Upload className="h-3 w-3" />
                      {uploadingCardId === c.id ? 'Yüklənir...' : 'Loqo'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleCardLogo(c.id, e)}
                        className="hidden"
                        data-testid={`cc-card-logo-${c.id}`}
                      />
                    </label>
                  </div>

                  {/* Inputs */}
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1">
                        Kart adı
                      </label>
                      <input
                        type="text"
                        value={c.name}
                        onChange={(e) =>
                          updateCard(c.id, { name: e.target.value })
                        }
                        placeholder="məs: Birbank"
                        className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm bg-white focus:border-gray-900 focus:outline-none"
                        data-testid={`cc-card-name-${c.id}`}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1">
                        Loqo arxa fon rəngi
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={c.bgColor || '#000000'}
                          onChange={(e) =>
                            updateCard(c.id, { bgColor: e.target.value })
                          }
                          className="h-9 w-12 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={c.bgColor || ''}
                          onChange={(e) =>
                            updateCard(c.id, { bgColor: e.target.value })
                          }
                          placeholder="#000000"
                          className="flex-1 h-9 px-3 border border-gray-300 rounded-lg text-sm bg-white focus:border-gray-900 focus:outline-none font-mono"
                        />
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs font-medium text-gray-700 block mb-1">
                        Dəstəklənən aylar (vergüllə)
                      </label>
                      <input
                        type="text"
                        value={(c.months || []).join(', ')}
                        onChange={(e) => {
                          const arr = e.target.value
                            .split(/[,\s]+/)
                            .map((x) => parseInt(x, 10))
                            .filter((n) => !isNaN(n) && n > 0 && n <= 60);
                          updateCard(c.id, { months: arr });
                        }}
                        placeholder="məs: 3, 6, 12, 18"
                        className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm bg-white focus:border-gray-900 focus:outline-none"
                        data-testid={`cc-card-months-${c.id}`}
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col items-end gap-2">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={c.isActive}
                        onChange={(e) =>
                          updateCard(c.id, { isActive: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                      />
                      <span className="text-xs text-gray-700">Aktiv</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => removeCard(c.id)}
                      className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50 border border-red-200"
                      data-testid={`cc-card-remove-${c.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 h-11 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
          data-testid="cc-save"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Yadda saxla
        </button>
      </div>
    </div>
  );
};

export default CreditCalculatorTab;
