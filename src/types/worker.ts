// Worker management system — types
export interface Worker {
  id: string;            // firebase auth uid
  email: string;
  name: string;
  surname: string;
  photo?: string;        // URL
  position: string;      // matches Position.name
  branch?: string;       // matches Branch.name (filial)
  birthDate?: string;        // ISO date — doğum tarixi
  hireDate: string;          // ISO date — işə başlama tarixi
  contractStart: string;     // ISO
  contractEnd: string;       // ISO
  vacationResetAt?: string;  // ISO — məzuniyyət sayğacı bu tarixdən hesablanır (admin sıfırlaya bilər)
  rating: number;            // 0-100 — auto-computed performance score (%)
  isActive: boolean;
  monthlyTarget: number;     // current month's sales target ₼
  monthlyTotalSales?: number;
  monthlyTotalMonth?: string;
  salesHistory?: Record<string, number>;
  birthdayGreetedYear?: number;
  loginPassword?: string;    // adminin görə bilməsi üçün saxlanan şifrə (Firebase Auth-da əsas şifrə)
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

export interface Training {
  id: string;
  title: string;
  description?: string;
  url: string;
  createdAt: string;
}

export interface BranchLeaderboardEntry {
  name: string;
  workerCount: number;
  totalSales: number;
  rank: number;
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
export type RequestType = 'leave' | 'complaint' | 'suggestion' | 'explanation' | 'other';

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
  salesScore: number;
  hitBonus: number;
  attendance: number;
  finesPenalty: number;
  leavesPenalty: number;
  rewardsBonus: number;
  total: number;
}
