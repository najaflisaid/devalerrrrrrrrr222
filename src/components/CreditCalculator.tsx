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
  // 53.33 formatına uyğun (iki onluq nöqtə ilə)
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
    <div className="space-y-8" data-testid="credit-calculator">
      {/* Hissəli alış kalkulyatoru */}
      <section data-testid="installment-calculator">
        <h3 className="text-xl font-semibold text-gray-900 mb-1">
          Hissəli alış kalkulyatoru
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Şərtlər ilk dəfə olaraq endirimli qiymətə tətbiq olunur
        </p>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            {/* Ay düymələri */}
            <div className="flex-1 flex flex-wrap items-end gap-3 sm:gap-4">
              {rates.map((r) => {
                const isActive = r.months === activeRate?.months;
                return (
                  <button
                    key={r.months}
                    type="button"
                    onClick={() => setSelectedMonths(r.months)}
                    className="relative group focus:outline-none"
                    data-testid={`cc-month-${r.months}`}
                  >
                    {/* Faiz etiketi */}
                    <span
                      className={`absolute -top-5 left-1/2 -translate-x-1/2 text-[12px] font-semibold whitespace-nowrap ${
                        r.percent > 0 ? 'text-red-500' : 'text-red-500'
                      } ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`}
                    >
                      {r.percent > 0 ? `${r.percent}%` : '0%'}
                    </span>
                    <span
                      className={`flex items-center justify-center rounded-full text-sm font-medium transition-all w-[68px] h-[68px] sm:w-[72px] sm:h-[72px] ${
                        isActive
                          ? 'bg-gray-900 text-white shadow-md'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                    >
                      {r.months} ay
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Aylıq */}
            <div className="sm:border-l sm:border-gray-200 sm:pl-6 text-center sm:text-left sm:min-w-[120px]">
              <div className="text-sm text-gray-500 mb-1">Aylıq</div>
              <div
                className="text-2xl font-bold text-gray-900"
                data-testid="cc-monthly-amount"
              >
                {formatAzn(monthlyAmount)} ₼
              </div>
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs text-gray-500 flex items-start gap-1.5">
          <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          Sifarişin rəsmiləşdirilməsi zamanı komissiya əlavə oluna bilər
        </p>
      </section>

      {/* Taksitlə al */}
      {activeCards.length > 0 && (
        <section data-testid="installment-cards">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Taksitlə al</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  className={`group flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left transition-all ${
                    hasMultiple ? 'hover:border-gray-900 cursor-pointer' : 'cursor-default'
                  }`}
                  data-testid={`cc-card-${c.id}`}
                  title={hasMultiple ? 'Ay dəyişmək üçün klikləyin' : c.name}
                >
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                    style={{ backgroundColor: c.bgColor || '#000000' }}
                  >
                    {c.logoUrl ? (
                      <img
                        src={c.logoUrl}
                        alt={c.name}
                        className="max-w-full max-h-full object-contain p-1"
                      />
                    ) : (
                      <span className="text-white text-xs font-bold">
                        {(c.name || '?').slice(0, 2)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-base font-semibold text-gray-900">
                      {sel} ay {formatAzn(monthly)} ₼
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate">
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
