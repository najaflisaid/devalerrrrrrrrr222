// Worker management system — types
export interface Worker {
  id: string;            // firebase auth uid
  email: string;
  name: string;
  surname: string;
  photo?: string;        // URL
  position: string;      // matches Position.name
  branch?: string;       // matches Branch.name (filial)
  hireDate: string;          // ISO date — işə başlama tarixi
  contractStart: string;     // ISO
  contractEnd: string;       // ISO
  rating: number;            // 0-100 — auto-computed performance score (%)
  isActive: boolean;
  monthlyTarget: number;     // current month's sales target ₼
  monthlyTotalSales?: number;   // admin-entered monthly total sales (for leaderboard)
  monthlyTotalMonth?: string;   // YYYY-MM — which month total applies to
  salesHistory?: Record<string, number>; // { 'YYYY-MM': total } — historical totals for leaderboard fallback
  createdAt: string;
}

export interface Position {
  id: string;
  name: string;
  createdAt: string;
}

export interface Branch {
  id: string;
  name: string;
  createdAt: string;
}

export interface AttendanceEntry {
  id: string;
  workerId: string;
  date: string;          // YYYY-MM-DD
  startTime?: string;    // ISO timestamp
  endTime?: string;      // ISO timestamp
  durationMs?: number;   // computed
}

export interface Fine {
  id: string;
  workerId: string;
  amount: number;
  reason: string;
  date: string;          // ISO
  createdBy?: string;
}

export interface Reward {
  id: string;
  workerId: string;
  type: 'bonus' | 'thanks' | 'raise';
  amount?: number;       // for bonus / raise %
  reason: string;
  date: string;
  createdBy?: string;
}

export interface SalesEntry {
  id: string;
  workerId: string;
  amount: number;        // ₼ sale amount
  date: string;          // YYYY-MM-DD
  note?: string;
}

export type RequestStatus = 'sent' | 'review' | 'resolved';
export type RequestType = 'leave' | 'complaint' | 'suggestion' | 'other';

export interface WorkerRequest {
  id: string;
  workerId: string;
  type: RequestType;
  description: string;
  attachmentUrl?: string;
  status: RequestStatus;
  adminResponse?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface WorkerNotification {
  id: string;
  workerId: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface PerformanceBreakdown {
  salesScore: number;     // % aylıq hədəfin yerinə yetirilməsi (0-100)
  hitBonus: number;       // hədəfi vuranlara bonus (+15 əgər hədəf 100%+)
  attendance: number;     // % davamiyyət (0-100)
  finesPenalty: number;   // mənfi dəyər (cərimələrə görə)
  leavesPenalty: number;  // mənfi dəyər (məzuniyyət/icazə müraciətlərinə görə)
  rewardsBonus: number;   // müsbət dəyər (mükafatlara görə)
  total: number;          // 0-100 yekun reytinq
}
