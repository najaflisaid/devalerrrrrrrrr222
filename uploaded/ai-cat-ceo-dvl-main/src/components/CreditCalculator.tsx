import React, { useEffect, useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import {
  getCreditConfig,
  getRatesForBrand,
  calcMonthly,
  type CreditCalculatorConfig,
  type BrandRate,
  type InstallmentCard,
} from '../services/creditCalculatorService';

interface CreditCalculatorProps {
  price: number;
  brand: string;
}

const formatAzn = (n: number): string => {
  return n.toLocaleString('az-AZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const CreditCalculator: React.FC<CreditCalculatorProps> = ({ price, brand }) => {
  const [config, setConfig] = useState<CreditCalculatorConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonths, setSelectedMonths] = useState<number | null>(null);
  const [cardSelectedMonths, setCardSelectedMonths] = useState<
    Record<string, number>
  >({});

  useEffect(() => {
    (async () => {
      try {
        const cfg = await getCreditConfig();
        setConfig(cfg);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const rates: BrandRate[] = useMemo(() => {
    if (!config) return [];
    return getRatesForBrand(config, brand);
  }, [config, brand]);

  // Default seçim: ən kiçik ay
  useEffect(() => {
    if (rates.length > 0 && selectedMonths == null) {
      setSelectedMonths(rates[0].months);
    }
  }, [rates, selectedMonths]);

  const activeRate: BrandRate | null = useMemo(() => {
    if (!rates.length) return null;
    return rates.find((r) => r.months === selectedMonths) || rates[0];
  }, [rates, selectedMonths]);

  const monthlyAmount = useMemo(() => {
    if (!activeRate) return 0;
    return calcMonthly(price, activeRate.months, activeRate.percent);
  }, [price, activeRate]);

  if (loading || !config || !config.enabled) {
    return null;
  }

  const activeCards: InstallmentCard[] = (config.installmentCards || []).filter(
    (c) => c.isActive && c.months && c.months.length > 0
  );

  return (
    <div className="space-y-5" data-testid="credit-calculator">
      {/* Kredit kalkulyatoru */}
      <section data-testid="installment-calculator">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          Kredit kalkulyatoru
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          Şərtlər endirimli qiymətə tətbiq olunmur
        </p>

        <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
          <div className="flex items-start gap-1.5 sm:gap-2">
            {/* Ay düymələri */}
            {rates.map((r) => {
              const isActive = r.months === activeRate?.months;
              return (
                <div key={r.months} className="flex-1 min-w-0 flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => setSelectedMonths(r.months)}
                    className="relative group focus:outline-none w-full"
                    data-testid={`cc-month-${r.months}`}
                  >
                    {/* Faiz etiketi */}
                    <span
                      className={`absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] font-semibold whitespace-nowrap text-red-500 ${
                        isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'
                      }`}
                    >
                      {r.percent > 0 ? `${r.percent}%` : '0%'}
                    </span>
                    <span
                      className={`flex items-center justify-center rounded-full transition-all w-full h-9 px-2 tabular-nums text-[12px] sm:text-[13px] font-semibold ${
                        isActive
                          ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                    >
                      {r.months} ay
                    </span>
                  </button>
                  <span className="mt-1.5 text-[9px] uppercase tracking-[0.16em] text-gray-500">
                    Müddət
                  </span>
                </div>
              );
            })}

            {/* Aylıq — eyni stil, kreditlə al rənginin yaşıl tonu, klikləməz */}
            <div className="flex-1 min-w-0 flex flex-col items-center">
              <div
                className="w-full h-9 px-2 rounded-full flex items-center justify-center
                           bg-emerald-600 text-white shadow-sm tabular-nums
                           text-[12px] sm:text-[13px] font-semibold whitespace-nowrap"
                data-testid="cc-monthly-amount"
              >
                {formatAzn(monthlyAmount)} AZN
              </div>
              <span className="mt-1.5 text-[9px] uppercase tracking-[0.16em] text-gray-500">
                Ayda
              </span>
            </div>
          </div>
        </div>

        <p className="mt-2 text-[11px] text-gray-500 flex items-start gap-1.5">
          <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
          Sifarişin rəsmiləşdirilməsi zamanı komissiya əlavə oluna bilər
        </p>
      </section>

      {/* Taksitlə al */}
      {activeCards.length > 0 && (
        <section data-testid="installment-cards">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Taksitlə al</h3>
          <div className="grid grid-cols-2 gap-2">
            {activeCards.map((c) => {
              const sortedMonths = [...c.months].sort((a, b) => a - b);
              const sel = cardSelectedMonths[c.id] ?? sortedMonths[sortedMonths.length - 1];
              const monthly = calcMonthly(price, sel, 0);
              const hasMultiple = sortedMonths.length > 1;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    if (!hasMultiple) return;
                    const idx = sortedMonths.indexOf(sel);
                    const next = sortedMonths[(idx + 1) % sortedMonths.length];
                    setCardSelectedMonths((m) => ({ ...m, [c.id]: next }));
                  }}
                  className={`group flex items-center gap-2.5 rounded-lg border border-gray-200 bg-white p-2.5 text-left transition-all ${
                    hasMultiple ? 'hover:border-gray-900 cursor-pointer' : 'cursor-default'
                  }`}
                  data-testid={`cc-card-${c.id}`}
                  title={hasMultiple ? 'Ay dəyişmək üçün klikləyin' : c.name}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
                    style={{ backgroundColor: c.bgColor || '#000000' }}
                  >
                    {c.logoUrl ? (
                      <img
                        src={c.logoUrl}
                        alt={c.name}
                        className="max-w-full max-h-full object-contain p-0.5"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-white text-[9px] font-bold leading-none text-center px-0.5">
                        {(c.name || '?').slice(0, 3).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 leading-tight">
                    <div className="text-[12px] font-semibold text-gray-900 tabular-nums">
                      {sel} ay {formatAzn(monthly)} AZN
                    </div>
                    <div className="text-[10px] text-gray-500 truncate">
                      {c.name} ilə faizsiz ödə!
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};

export default CreditCalculator;
