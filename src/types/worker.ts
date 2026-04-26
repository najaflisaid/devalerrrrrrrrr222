// Worker management system — types
export interface Worker {
  id: string;            // firebase auth uid
  email: string;
  name: string;
  surname: string;
  photo?: string;
  position: string;
  hireDate: string;          // ISO date — işə başlama tarixi
  contractStart: string;     // ISO
  contractEnd: string;       // ISO
  rating: number;            // 0-5
  isActive: boolean;
  monthlyTarget: number;     // current month's sales target ₼
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
