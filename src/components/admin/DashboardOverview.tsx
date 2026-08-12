import React, { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp, ShoppingBag, Users, MessageSquare, Calendar, ChevronRight, Phone, Loader2,
} from 'lucide-react';
import { getAllCustomerOrders, type CustomerOrder } from '../../services/customerOrderService';
import { getDailyVisits, type DailyVisitStat } from '../../services/analyticsService';
import { subscribeAllSessions, sessionShortCode, type ChatSessionMeta } from '../../services/chatSessionService';

type RangeKey = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'all' | 'custom';

const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Bugün' },
  { key: 'yesterday', label: 'Dünən' },
  { key: 'week', label: 'Bu həftə' },
  { key: 'month', label: 'Bu ay' },
  { key: 'year', label: 'Bu il' },
  { key: 'all', label: 'Hamısı' },
];

const NON_SALE = new Set(['pending_payment', 'payment_failed', 'cancelled']);

const pad = (n: number) => n.toString().padStart(2, '0');
const dateId = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toMs = (v: any): number => {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (v instanceof Date) return v.getTime();
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return 0;
};

const azn = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' ₼';

interface Props {
  onNavigate: (tabId: string) => void;
}

const DashboardOverview: React.FC<Props> = ({ onNavigate }) => {
  const [range, setRange] = useState<RangeKey>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [visits, setVisits] = useState<DailyVisitStat[]>([]);
  const [sessions, setSessions] = useState<ChatSessionMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [o, v] = await Promise.all([getAllCustomerOrders(), getDailyVisits(400)]);
        if (mounted) {
          setOrders(o);
          setVisits(v);
        }
      } catch {
        /* ignore */
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    const unsub = subscribeAllSessions((s) => mounted && setSessions(s));
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  // Seçilmiş aralığın [start, end] ms sərhədləri
  const [startMs, endMs, startDateStr, endDateStr] = useMemo(() => {
    const now = new Date();
    const end = now.getTime();
    let start = new Date();
    if (range === 'today') {
      start.setHours(0, 0, 0, 0);
    } else if (range === 'yesterday') {
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      const e = new Date(start);
      e.setHours(23, 59, 59, 999);
      return [start.getTime(), e.getTime(), dateId(start), dateId(start)];
    } else if (range === 'week') {
      const day = (start.getDay() + 6) % 7; // Bazar ertəsi = 0
      start.setDate(start.getDate() - day);
      start.setHours(0, 0, 0, 0);
    } else if (range === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (range === 'year') {
      start = new Date(now.getFullYear(), 0, 1);
    } else if (range === 'all') {
      return [0, end, '0000-01-01', dateId(now)];
    } else if (range === 'custom') {
      const s = customFrom ? new Date(customFrom + 'T00:00:00') : new Date(now.getFullYear(), now.getMonth(), 1);
      const e = customTo ? new Date(customTo + 'T23:59:59') : now;
      return [s.getTime(), e.getTime(), dateId(s), dateId(e)];
    }
    return [start.getTime(), end, dateId(start), dateId(now)];
  }, [range, customFrom, customTo]);

  const inRange = (ms: number) => ms >= startMs && ms <= endMs;

  const stats = useMemo(() => {
    let salesTotal = 0;
    let orderCount = 0;
    for (const o of orders) {
      const ms = toMs((o as any).paidAt) || toMs((o as any).createdAt);
      if (!inRange(ms)) continue;
      if (NON_SALE.has(o.status as any)) continue;
      salesTotal += Number(o.totalAmount) || 0;
      orderCount += 1;
    }
    let visitors = 0;
    for (const v of visits) {
      if (v.date >= startDateStr && v.date <= endDateStr) visitors += Number(v.count) || 0;
    }
    const chatWriters = sessions.filter((s) => {
      const ms = toMs((s as any).startedAt) || toMs((s as any).lastActive);
      return inRange(ms) && (Number(s.userMessageCount) || 0) > 0;
    });
    const contacts = chatWriters.filter((s) => s.contactCaptured).length;
    return { salesTotal, orderCount, visitors, chatCount: chatWriters.length, contacts, chatWriters };
  }, [orders, visits, sessions, startMs, endMs, startDateStr, endDateStr]);

  const cards = [
    { key: 'sales', label: 'Satış', value: azn(stats.salesTotal), sub: `${stats.orderCount} sifariş`, icon: TrendingUp, tab: 'customerOrders', accent: 'text-emerald-600', ring: 'bg-emerald-50' },
    { key: 'orders', label: 'Sifarişlər', value: String(stats.orderCount), sub: 'ödənişli', icon: ShoppingBag, tab: 'customerOrders', accent: 'text-blue-600', ring: 'bg-blue-50' },
    { key: 'visitors', label: 'Ziyarətçilər', value: stats.visitors.toLocaleString('en-US'), sub: 'sayta giriş', icon: Users, tab: 'analytics', accent: 'text-violet-600', ring: 'bg-violet-50' },
    { key: 'chat', label: 'AI söhbətlər', value: String(stats.chatCount), sub: `${stats.contacts} əlaqə paylaşdı`, icon: MessageSquare, tab: 'aiConsultant', accent: 'text-amber-600', ring: 'bg-amber-50' },
  ];

  const fmtTime = (ts: any) => {
    const ms = toMs(ts);
    if (!ms) return '';
    return new Date(ms).toLocaleString('az-AZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="mb-8" data-testid="dashboard-overview">
      {/* Başlıq + tarix aralığı seçimi */}
      <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-gray-900 text-white">
            <Calendar className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-base font-bold text-gray-900 leading-tight">Analitika icmalı</h3>
            <p className="text-xs text-gray-400">Satış, ziyarət və söhbət göstəriciləri</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5" data-testid="dashboard-range-picker">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                range === r.key ? 'bg-gray-900 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-400'
              }`}
              data-testid={`range-${r.key}`}
            >
              {r.label}
            </button>
          ))}
          <button
            onClick={() => setRange('custom')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              range === 'custom' ? 'bg-gray-900 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-400'
            }`}
            data-testid="range-custom"
          >
            Tarix seç
          </button>
        </div>
      </div>

      {range === 'custom' && (
        <div className="flex flex-wrap items-center gap-2 mb-4 bg-white border border-gray-200 rounded-xl p-3">
          <label className="text-xs text-gray-500">Başlanğıc</label>
          <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200" data-testid="custom-from" />
          <label className="text-xs text-gray-500">Son</label>
          <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200" data-testid="custom-to" />
        </div>
      )}

      {/* Stat kartları */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.key}
              onClick={() => onNavigate(c.tab)}
              className="group text-left bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5 hover:shadow-md hover:border-gray-900 transition-all"
              data-testid={`stat-card-${c.key}`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`inline-flex items-center justify-center h-9 w-9 rounded-xl ${c.ring} ${c.accent}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-900 transition-colors" />
              </div>
              <div className="text-2xl font-bold text-gray-900 leading-none tabular-nums" data-testid={`stat-value-${c.key}`}>
                {loading ? <Loader2 className="h-5 w-5 animate-spin text-gray-300" /> : c.value}
              </div>
              <div className="mt-1.5 text-xs font-medium text-gray-500">{c.label}</div>
              <div className="text-[11px] text-gray-400">{c.sub}</div>
            </button>
          );
        })}
      </div>

      {/* AI chat yazanlar */}
      <div className="mt-4 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden" data-testid="dashboard-chat-writers">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-amber-500" /> AI chat-də yazanlar
          </h4>
          <button onClick={() => onNavigate('aiConsultant')} className="text-xs font-semibold text-gray-500 hover:text-gray-900 inline-flex items-center gap-1" data-testid="chat-writers-all">
            Hamısı <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        {stats.chatWriters.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">Bu aralıqda söhbət yoxdur</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {stats.chatWriters.slice(0, 6).map((s) => (
              <button
                key={s.id}
                onClick={() => onNavigate('aiConsultant')}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                data-testid={`chat-writer-${s.id}`}
              >
                <span className={`flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold ${
                  s.contactCaptured ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {s.contactCaptured && s.contactName ? s.contactName.trim().slice(0, 2).toUpperCase() : sessionShortCode(s.id).slice(0, 2)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {s.contactCaptured && s.contactName ? s.contactName : `#${sessionShortCode(s.id)}`}
                    </span>
                    {s.contactCaptured && s.contactPhone && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-600">
                        <Phone className="h-2.5 w-2.5" /> {s.contactPhone}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 truncate">{s.lastMessage || '—'}</div>
                </div>
                <div className="text-[11px] text-gray-400 flex-shrink-0 tabular-nums">{fmtTime((s as any).startedAt || (s as any).lastActive)}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardOverview;
