import React, { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

// İşçinin son 12 aylıq satışını bar qrafiki kimi göstərir.
// Hər ayın yanında əvvəlki aya nisbətən artma (↑ yaşıl), azalma (↓ qırmızı) və ya
// stabillik (→ boz) ox işarəsi göstərilir.

const AZ_MONTHS = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'İyn', 'İyl', 'Avq', 'Sen', 'Okt', 'Noy', 'Dek'];
const AZ_MONTHS_LONG = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun', 'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];

export interface MonthlySalesChartProps {
  salesHistory: Record<string, number> | undefined;
  target?: number; // hədəf xətti ( AZN)
  monthsCount?: number; // default 12
  height?: number; // default 180
  className?: string;
  title?: string;
  /** "rolling" — son 12 ay (default), "currentYear" — Yanvardan Dekabra qədər cari il */
  mode?: 'rolling' | 'currentYear';
  /** Orta satış göstərici. Default false. */
  showAverage?: boolean;
}

interface MonthCell {
  ym: string;       // YYYY-MM
  shortLabel: string;
  longLabel: string;
  value: number;
}

const buildLastNMonths = (n: number): MonthCell[] => {
  const arr: MonthCell[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = d.getMonth();
    const y = d.getFullYear();
    const ym = `${y}-${String(m + 1).padStart(2, '0')}`;
    arr.push({
      ym,
      shortLabel: AZ_MONTHS[m],
      longLabel: `${AZ_MONTHS_LONG[m]} ${y}`,
      value: 0,
    });
  }
  return arr;
};

const buildCurrentYearMonths = (): MonthCell[] => {
  const arr: MonthCell[] = [];
  const y = new Date().getFullYear();
  for (let m = 0; m < 12; m++) {
    const ym = `${y}-${String(m + 1).padStart(2, '0')}`;
    arr.push({
      ym,
      shortLabel: AZ_MONTHS[m],
      longLabel: `${AZ_MONTHS_LONG[m]} ${y}`,
      value: 0,
    });
  }
  return arr;
};

const fmt = (n: number) => n.toLocaleString();

const trendOf = (cur: number, prev: number): 'up' | 'down' | 'flat' | 'none' => {
  if (prev === 0 && cur === 0) return 'none';
  if (prev === 0 && cur > 0) return 'up';
  if (cur === 0 && prev > 0) return 'down';
  const diff = cur - prev;
  const pct = Math.abs(diff) / Math.max(prev, 1);
  if (pct < 0.03) return 'flat'; // <3% dəyişiklik = stabil
  return diff > 0 ? 'up' : 'down';
};

const TrendArrow: React.FC<{ trend: ReturnType<typeof trendOf> }> = ({ trend }) => {
  if (trend === 'up') return <TrendingUp className="h-3 w-3 text-emerald-500" />;
  if (trend === 'down') return <TrendingDown className="h-3 w-3 text-red-500" />;
  if (trend === 'flat') return <Minus className="h-3 w-3 text-gray-400" />;
  return null;
};

export const MonthlySalesChart: React.FC<MonthlySalesChartProps> = ({
  salesHistory,
  target = 0,
  monthsCount = 12,
  height = 180,
  className = '',
  title = '12 Aylıq Satış',
  mode = 'rolling',
  showAverage = false,
}) => {
  const cells = useMemo(() => {
    const months = mode === 'currentYear' ? buildCurrentYearMonths() : buildLastNMonths(monthsCount);
    const hist = salesHistory || {};
    return months.map(m => ({ ...m, value: Number(hist[m.ym] || 0) }));
  }, [salesHistory, monthsCount, mode]);

  const maxVal = useMemo(
    () => Math.max(target || 0, ...cells.map(c => c.value), 1),
    [cells, target]
  );

  const [hovered, setHovered] = useState<number | null>(null);

  // İşçinin trend xülasəsi: son ay vs ondan əvvəlki ay
  const lastIdx = cells.length - 1;
  const overallTrend = trendOf(cells[lastIdx]?.value || 0, cells[lastIdx - 1]?.value || 0);
  const total12m = cells.reduce((s, c) => s + c.value, 0);
  const avg = Math.round(total12m / cells.length);

  return (
    <div className={`bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 shadow-sm ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h3 className="font-playfair text-lg sm:text-xl text-black">{title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {mode === 'currentYear' ? 'Yanvar — Dekabr' : `Son ${monthsCount} ayın satış göstəriciləri`}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 rounded-full">
            <TrendArrow trend={overallTrend} />
            <span className="text-gray-700">
              {overallTrend === 'up' && 'Artım'}
              {overallTrend === 'down' && 'Azalma'}
              {overallTrend === 'flat' && 'Stabil'}
              {overallTrend === 'none' && 'Məlumat yoxdur'}
            </span>
          </span>
          {showAverage && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-[#8a6d10] rounded-full">
              Orta: <strong>{fmt(avg)} AZN</strong>
            </span>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="relative" style={{ height }}>
        {/* Hədəf xətti */}
        {target > 0 && (
          <div
            className="absolute left-0 right-0 border-t border-dashed border-[#D4AF37]/60 pointer-events-none z-10"
            style={{ bottom: `${(target / maxVal) * 100}%` }}
          >
            <span className="absolute -top-2 right-0 text-[9px] bg-[#FFF8E5] text-[#8a6d10] px-1.5 py-0.5 rounded border border-[#D4AF37]/40">
              Hədəf: {fmt(target)} AZN
            </span>
          </div>
        )}

        <div className="absolute inset-0 flex items-end gap-1.5 sm:gap-2 pb-6">
          {cells.map((c, i) => {
            const prev = i > 0 ? cells[i - 1].value : 0;
            const trend = trendOf(c.value, prev);
            const heightPct = c.value > 0 ? Math.max(2, (c.value / maxVal) * 100) : 0;
            const isHover = hovered === i;
            const isTargetHit = target > 0 && c.value >= target;
            return (
              <div
                key={c.ym}
                className="flex-1 flex flex-col items-center justify-end h-full relative group cursor-default"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => setHovered(prev2 => prev2 === i ? null : i)}
              >
                {/* Trend arrow at top */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1">
                  {i > 0 && c.value > 0 && <TrendArrow trend={trend} />}
                </div>

                {/* Bar */}
                <div
                  className={`w-full rounded-t-md transition-all duration-500 ${
                    c.value === 0
                      ? 'bg-gray-100'
                      : isTargetHit
                        ? 'bg-gradient-to-t from-emerald-400 to-emerald-300'
                        : 'bg-gradient-to-t from-[#D4AF37] to-[#F3E2A5]'
                  } ${isHover ? 'opacity-90 ring-2 ring-[#D4AF37]/40' : ''}`}
                  style={{ height: `${heightPct}%`, minHeight: c.value > 0 ? 4 : 2 }}
                />

                {/* Tooltip */}
                {isHover && c.value > 0 && (
                  <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 rounded-md shadow-lg whitespace-nowrap z-20">
                    <div className="font-medium">{c.longLabel}</div>
                    <div className="text-amber-200">{fmt(c.value)} AZN</div>
                  </div>
                )}

                {/* Month label */}
                <div className="absolute bottom-0 left-0 right-0 text-center">
                  <span className="text-[9px] sm:text-[10px] text-gray-500 font-medium">{c.shortLabel}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-3 text-[10px] text-gray-500 flex-wrap">
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-gradient-to-t from-[#D4AF37] to-[#F3E2A5]" /> Aylıq satış
        </span>
        {target > 0 && (
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-gradient-to-t from-emerald-400 to-emerald-300" /> Hədəfə çatdı
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <TrendingUp className="h-3 w-3 text-emerald-500" /> artım
          <TrendingDown className="h-3 w-3 text-red-500 ml-1" /> azalma
          <Minus className="h-3 w-3 text-gray-400 ml-1" /> stabil
        </span>
      </div>
    </div>
  );
};

export default MonthlySalesChart;
