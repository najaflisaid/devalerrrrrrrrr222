import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  addDoc, query, where, orderBy, Timestamp, onSnapshot, limit,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, getSecondaryAuth } from '../lib/firebase';
import {
  createUserWithEmailAndPassword, signOut as fbSignOut,
} from 'firebase/auth';
import type {
  Worker, AttendanceEntry, Fine, Reward, SalesEntry,
  WorkerRequest, RequestStatus, WorkerNotification, Position, Branch, Training, BranchLeaderboardEntry, PerformanceBreakdown,
} from '../types/worker';

const WORKERS = 'workers';
const POSITIONS = 'worker_positions';
const BRANCHES = 'worker_branches';
const TRAININGS = 'worker_trainings';
const ATTENDANCE = 'worker_attendance';
const FINES = 'worker_fines';
const REWARDS = 'worker_rewards';
const SALES = 'worker_sales';
const REQUESTS = 'worker_requests';
const NOTIFICATIONS = 'worker_notifications';

const TZ = 'Asia/Baku';

// Bakıdakı tarixi YYYY-MM-DD formatında qaytarır
const todayStr = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  return parts; // en-CA verir YYYY-MM-DD
};
const nowIso = () => new Date().toISOString();

// Bakı saatına görə YYYY-MM (ay) qaytarır
const bakuMonthYM = (d = new Date()) => {
  const y = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric' }).format(d);
  const m = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, month: '2-digit' }).format(d);
  return `${y}-${m}`;
};

// Bakı saatına görə günün tarixinin günü (1-31)
const bakuDay = (d = new Date()) => {
  return Number(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, day: '2-digit' }).format(d));
};

// Bakı saatına görə saat (0-23)
const bakuHour = (iso: string) => {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(new Date(iso)));
};

// ───────────────────── Workers ─────────────────────
export const createWorker = async (
  email: string,
  password: string,
  data: Omit<Worker, 'id' | 'email' | 'createdAt' | 'rating' | 'isActive' | 'monthlyTarget'> & {
    rating?: number; isActive?: boolean; monthlyTarget?: number;
  }
): Promise<Worker> => {
  // Use secondary auth so the admin's session is not affected
  const sAuth = getSecondaryAuth();
  const cred = await createUserWithEmailAndPassword(sAuth, email, password);
  const uid = cred.user.uid;
  await fbSignOut(sAuth);

  const worker: Worker = {
    id: uid,
    email,
    name: data.name,
    surname: data.surname,
    photo: data.photo || '',
    position: data.position,
    branch: data.branch || '',
    hireDate: data.hireDate,
    contractStart: data.contractStart,
    contractEnd: data.contractEnd,
    rating: data.rating ?? 5,
    isActive: data.isActive ?? true,
    monthlyTarget: data.monthlyTarget ?? 0,
    loginPassword: password, // admin görə bilsin (Firebase Auth-da əsas şifrə bu, sonradan dəyişdirilə bilməz)
    createdAt: nowIso(),
  };
  await setDoc(doc(db, WORKERS, uid), worker);
  return worker;
};

export const getWorker = async (id: string): Promise<Worker | null> => {
  const snap = await getDoc(doc(db, WORKERS, id));
  return snap.exists() ? (snap.data() as Worker) : null;
};

export const getWorkerByEmail = async (email: string): Promise<Worker | null> => {
  const q = query(collection(db, WORKERS), where('email', '==', email), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data() as Worker;
};

export const listWorkers = async (): Promise<Worker[]> => {
  const snap = await getDocs(query(collection(db, WORKERS), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => d.data() as Worker);
};

export const updateWorker = async (id: string, patch: Partial<Worker>) => {
  await updateDoc(doc(db, WORKERS, id), patch as any);
};

export const deleteWorker = async (id: string) => {
  await deleteDoc(doc(db, WORKERS, id));
};

export const uploadWorkerPhoto = async (workerId: string, file: File): Promise<string> => {
  const path = `workers/${workerId}/${Date.now()}_${file.name}`;
  const r = storageRef(storage, path);
  await uploadBytes(r, file);
  return await getDownloadURL(r);
};

export const uploadRequestAttachment = async (workerId: string, file: File): Promise<string> => {
  const path = `workers/${workerId}/requests/${Date.now()}_${file.name}`;
  const r = storageRef(storage, path);
  await uploadBytes(r, file);
  return await getDownloadURL(r);
};

// ───────────────────── Attendance ─────────────────────
export const startWork = async (workerId: string): Promise<AttendanceEntry> => {
  const date = todayStr();
  const id = `${workerId}_${date}`;
  const ref = doc(db, ATTENDANCE, id);
  const existing = await getDoc(ref);
  if (existing.exists() && (existing.data() as AttendanceEntry).startTime) {
    return existing.data() as AttendanceEntry;
  }
  const entry: AttendanceEntry = { id, workerId, date, startTime: nowIso() };
  await setDoc(ref, entry);
  return entry;
};

export const endWork = async (workerId: string): Promise<AttendanceEntry | null> => {
  const date = todayStr();
  const id = `${workerId}_${date}`;
  const ref = doc(db, ATTENDANCE, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const e = snap.data() as AttendanceEntry;
  if (!e.startTime) return null;
  const endTime = nowIso();
  const durationMs = new Date(endTime).getTime() - new Date(e.startTime).getTime();
  const updated: AttendanceEntry = { ...e, endTime, durationMs };
  await setDoc(ref, updated);
  return updated;
};

export const getTodayAttendance = async (workerId: string): Promise<AttendanceEntry | null> => {
  const id = `${workerId}_${todayStr()}`;
  const snap = await getDoc(doc(db, ATTENDANCE, id));
  return snap.exists() ? (snap.data() as AttendanceEntry) : null;
};

export const listAttendance = async (workerId: string, days = 60): Promise<AttendanceEntry[]> => {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  // Composite index tələbindən qaçmaq üçün yalnız workerId üzrə sorğu, tarix in-memory filtrlənir.
  const q = query(collection(db, ATTENDANCE), where('workerId', '==', workerId));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => d.data() as AttendanceEntry)
    .filter(a => a.date >= since)
    .sort((a, b) => b.date.localeCompare(a.date));
};

export const listAllAttendanceToday = async (): Promise<AttendanceEntry[]> => {
  const q = query(collection(db, ATTENDANCE), where('date', '==', todayStr()));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as AttendanceEntry);
};

// ───────────────────── Fines / Rewards ─────────────────────
export const addFine = async (data: Omit<Fine, 'id'>): Promise<Fine> => {
  const ref = await addDoc(collection(db, FINES), data);
  return { id: ref.id, ...data };
};

export const listFines = async (workerId: string): Promise<Fine[]> => {
  const q = query(collection(db, FINES), where('workerId', '==', workerId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Fine, 'id'>) }))
    .sort((a, b) => b.date.localeCompare(a.date));
};

export const deleteFine = async (id: string) => deleteDoc(doc(db, FINES, id));

export const addReward = async (data: Omit<Reward, 'id'>): Promise<Reward> => {
  const ref = await addDoc(collection(db, REWARDS), data);
  return { id: ref.id, ...data };
};

export const listRewards = async (workerId: string): Promise<Reward[]> => {
  const q = query(collection(db, REWARDS), where('workerId', '==', workerId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Reward, 'id'>) }))
    .sort((a, b) => b.date.localeCompare(a.date));
};

export const deleteReward = async (id: string) => deleteDoc(doc(db, REWARDS, id));

// ───────────────────── Sales (for performance) ─────────────────────
export const addSale = async (data: Omit<SalesEntry, 'id'>): Promise<SalesEntry> => {
  const ref = await addDoc(collection(db, SALES), data);
  return { id: ref.id, ...data };
};

export const listSales = async (workerId: string, monthYM?: string): Promise<SalesEntry[]> => {
  const q = query(collection(db, SALES), where('workerId', '==', workerId));
  const snap = await getDocs(q);
  const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<SalesEntry, 'id'>) }));
  if (monthYM) return items.filter(s => s.date.startsWith(monthYM));
  return items.sort((a, b) => b.date.localeCompare(a.date));
};

// ───────────────────── Requests ─────────────────────
export const submitRequest = async (
  data: Omit<WorkerRequest, 'id' | 'status' | 'createdAt'>
): Promise<WorkerRequest> => {
  const payload = { ...data, status: 'sent' as RequestStatus, createdAt: nowIso() };
  const ref = await addDoc(collection(db, REQUESTS), payload);
  return { id: ref.id, ...payload };
};

export const listRequests = async (workerId?: string): Promise<WorkerRequest[]> => {
  const q = workerId
    ? query(collection(db, REQUESTS), where('workerId', '==', workerId))
    : query(collection(db, REQUESTS));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<WorkerRequest, 'id'>) }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

export const updateRequestStatus = async (
  id: string, status: RequestStatus, adminResponse?: string
) => {
  await updateDoc(doc(db, REQUESTS, id), {
    status, adminResponse: adminResponse || '', updatedAt: nowIso(),
  });
};

// ───────────────────── Notifications ─────────────────────
export const sendNotification = async (workerId: string, message: string) => {
  const data: Omit<WorkerNotification, 'id'> = {
    workerId, message, read: false, createdAt: nowIso(),
  };
  const ref = await addDoc(collection(db, NOTIFICATIONS), data);
  return { id: ref.id, ...data } as WorkerNotification;
};

export const listNotifications = async (workerId: string): Promise<WorkerNotification[]> => {
  const q = query(collection(db, NOTIFICATIONS), where('workerId', '==', workerId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<WorkerNotification, 'id'>) }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

export const markNotificationRead = async (id: string) => {
  await updateDoc(doc(db, NOTIFICATIONS, id), { read: true });
};

// ───────────────────── Helpers ─────────────────────
export const monthYM = (d = new Date()) => bakuMonthYM(d);

export const daysSince = (iso: string): number => {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
};

export const computeAttendancePercent = async (workerId: string): Promise<number> => {
  const ym = monthYM();
  const items = await listAttendance(workerId, 31);
  const monthDays = items.filter(a => a.date.startsWith(ym) && a.startTime);
  const workingDaysSoFar = bakuDay(); // bu günün tarixi (Bakı vaxtı ilə)
  const present = monthDays.length;
  return workingDaysSoFar === 0 ? 0 : Math.min(100, Math.round((present / workingDaysSoFar) * 100));
};

// ───────────────────── Positions ─────────────────────
export const listPositions = async (): Promise<Position[]> => {
  const snap = await getDocs(collection(db, POSITIONS));
  return snap.docs
    .map(d => ({ id: d.id, ...(d.data() as Omit<Position, 'id'>) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'az'));
};

export const addPosition = async (name: string): Promise<Position> => {
  const data = { name: name.trim(), createdAt: nowIso() };
  const ref = await addDoc(collection(db, POSITIONS), data);
  return { id: ref.id, ...data };
};

export const updatePosition = async (id: string, name: string) => {
  await updateDoc(doc(db, POSITIONS, id), { name: name.trim() });
};

export const deletePosition = async (id: string) => deleteDoc(doc(db, POSITIONS, id));

// ───────────────────── Monthly total + salesHistory helper ─────────────────────
export const setMonthlyTotal = async (workerId: string, total: number, ym: string) => {
  // salesHistory.${ym}-i nested update ilə yenilə (digər ayları silmədən)
  await updateDoc(doc(db, WORKERS, workerId), {
    monthlyTotalSales: total,
    monthlyTotalMonth: ym,
    [`salesHistory.${ym}`]: total,
  } as any);
};

// ───────────────────── Branches (Filiallar) ─────────────────────
export const listBranches = async (): Promise<Branch[]> => {
  const snap = await getDocs(collection(db, BRANCHES));
  return snap.docs
    .map(d => ({ id: d.id, ...(d.data() as Omit<Branch, 'id'>) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'az'));
};

export const addBranch = async (name: string): Promise<Branch> => {
  const data = { name: name.trim(), createdAt: nowIso() };
  const ref = await addDoc(collection(db, BRANCHES), data);
  return { id: ref.id, ...data };
};

export const updateBranch = async (id: string, name: string) => {
  await updateDoc(doc(db, BRANCHES, id), { name: name.trim() });
};

export const deleteBranch = async (id: string) => deleteDoc(doc(db, BRANCHES, id));

// ───────────────────── Trainings (Təlimlər) ─────────────────────
export const listTrainings = async (): Promise<Training[]> => {
  const snap = await getDocs(collection(db, TRAININGS));
  return snap.docs
    .map(d => ({ id: d.id, ...(d.data() as Omit<Training, 'id'>) }))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
};

export const addTraining = async (data: Omit<Training, 'id' | 'createdAt'>): Promise<Training> => {
  const payload = { ...data, createdAt: nowIso() };
  const ref = await addDoc(collection(db, TRAININGS), payload);
  return { id: ref.id, ...payload };
};

export const updateTraining = async (id: string, patch: Partial<Training>) => {
  await updateDoc(doc(db, TRAININGS, id), patch as any);
};

export const deleteTraining = async (id: string) => deleteDoc(doc(db, TRAININGS, id));

// ───────────────────── Vacation reset ─────────────────────
// Admin işçinin məzuniyyətə çıxdığını qeyd edib sayğacı sıfırlayır → 6 ay yenidən hesablanır.
export const resetVacation = async (workerId: string) => {
  await updateDoc(doc(db, WORKERS, workerId), { vacationResetAt: nowIso() } as any);
};

// ───────────────────── Birthday greeting ─────────────────────
// İşçi giriş etdiyində dashboard çağırır. Bugün ad-günüdürsə və hələ tebrik bildirişi
// göndərilməyibsə, bildiriş yaradır və işarələyir.
export const ensureBirthdayGreeting = async (worker: Worker): Promise<void> => {
  if (!worker.birthDate) return;
  const today = new Date();
  const todayMD = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const bd = new Date(worker.birthDate);
  if (Number.isNaN(bd.getTime())) return;
  const bdMD = `${String(bd.getMonth() + 1).padStart(2, '0')}-${String(bd.getDate()).padStart(2, '0')}`;
  if (todayMD !== bdMD) return;
  if (worker.birthdayGreetedYear === today.getFullYear()) return;

  await sendNotification(
    worker.id,
    `🎉 Ad gününüz mübarək, ${worker.name}!\n\nDe Valeur ailəsi olaraq sizi səmimi qəlbdən təbrik edirik. Sağlam, uğurlu və xoşbəxt bir il arzulayırıq!`
  );
  await updateDoc(doc(db, WORKERS, worker.id), { birthdayGreetedYear: today.getFullYear() } as any);
};

// ───────────────────── Performance / Rating ─────────────────────
// Reytinq emsalları:
//   - 70%-i aylıq satış hədəfinə görə
//   - +15 bonus hədəfi vuranda
//   - hər mükafata +5 (max +20)
//   - hər cəriməyə −8 (max −40)
//   - hər təsdiqlənmiş məzuniyyət / icazəyə −5 (max −20)
//   - Hədəf 0-dırsa, yalnız aktivlik baxımından qiymətləndirilir

export const computePerformance = async (worker: Worker): Promise<PerformanceBreakdown> => {
  const ym = monthYM();
  const [fines, rewards, sales, requests, attendance] = await Promise.all([
    listFines(worker.id),
    listRewards(worker.id),
    listSales(worker.id, ym),
    listRequests(worker.id),
    computeAttendancePercent(worker.id),
  ]);

  // Bu ay üzrə satış
  const monthSales = sales.reduce((s, x) => s + (x.amount || 0), 0);
  const target = worker.monthlyTarget || 0;

  // Aylıq cəm satış (admin daxil etmişsə) prioritetli olsun
  const monthlyTotal = (worker.monthlyTotalMonth === ym && typeof worker.monthlyTotalSales === 'number')
    ? worker.monthlyTotalSales
    : monthSales;

  // Sales score (ümumi reytinqin 70%-i)
  let salesScore = 0;
  if (target > 0) {
    salesScore = Math.min(100, (monthlyTotal / target) * 100);
  } else if (monthlyTotal > 0) {
    salesScore = 70; // hədəf yoxdur amma satış var
  } else {
    salesScore = 60; // baseline (yeni işçi və ya satış üçün məsul deyil)
  }

  // Target hit bonus
  const hitBonus = (target > 0 && monthlyTotal >= target) ? 15 : 0;

  // Fines penalty (bu ay)
  const monthFinesCount = fines.filter(f => (f.date || '').startsWith(ym)).length;
  const finesPenalty = -Math.min(40, monthFinesCount * 8);

  // Rewards bonus (bu ay)
  const monthRewardsCount = rewards.filter(r => (r.date || '').startsWith(ym)).length;
  const rewardsBonus = Math.min(20, monthRewardsCount * 5);

  // Leave/permission penalty — bu ay üzrə təsdiqlənmiş `leave` müraciətləri
  const monthLeavesCount = requests.filter(r =>
    r.type === 'leave' &&
    r.status === 'resolved' &&
    (r.createdAt || '').startsWith(ym)
  ).length;
  const leavesPenalty = -Math.min(20, monthLeavesCount * 5);

  // Yekun = satış 60% + davamiyyət 25% + bonuslar - cərimələr
  const total = Math.max(0, Math.min(100, Math.round(
    salesScore * 0.60 +
    attendance * 0.25 +
    hitBonus +
    rewardsBonus +
    finesPenalty +
    leavesPenalty
  )));

  return {
    salesScore: Math.round(salesScore),
    hitBonus,
    attendance,
    finesPenalty,
    leavesPenalty,
    rewardsBonus,
    total,
  };
};

// İş stajı — illər və aylar
export const computeExperience = (hireDate: string): { years: number; months: number; days: number; label: string } => {
  if (!hireDate) return { years: 0, months: 0, days: 0, label: '—' };
  const start = new Date(hireDate);
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  let days = now.getDate() - start.getDate();
  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) { years -= 1; months += 12; }
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} il`);
  if (months > 0) parts.push(`${months} ay`);
  if (years === 0 && months === 0) parts.push(`${Math.max(0, days)} gün`);
  return { years, months, days, label: parts.join(' ') || '0 gün' };
};

// ───────────────────── Leaderboard (monthly total sales) ─────────────────────
export interface LeaderboardEntry {
  workerId: string;
  name: string;
  surname: string;
  photo?: string;
  position: string;
  branch?: string;
  rank: number;
  total: number;        // sales total used for ranking
  fromMonth: string;    // hansı aydan götürülüb
  hasTotal: boolean;
}

// Helper: ən son mövcud satış total-ını və ayını qaytarır.
// Cari ay üçün admin daxil etmişsə cari ay götürür; yoxsa salesHistory-dən ən son ayı seçir.
const lastTotalForWorker = (w: Worker, currentYM: string): { total: number; fromMonth: string; hasTotal: boolean } => {
  if (w.monthlyTotalMonth === currentYM && typeof w.monthlyTotalSales === 'number') {
    return { total: w.monthlyTotalSales, fromMonth: currentYM, hasTotal: true };
  }
  const history = w.salesHistory || {};
  const months = Object.keys(history).sort().reverse(); // ən yeni öncə
  if (months.length > 0) {
    const m = months[0];
    return { total: history[m] || 0, fromMonth: m, hasTotal: true };
  }
  // Fallback: bəlkə monthlyTotalSales var amma ayı keçmişdir
  if (typeof w.monthlyTotalSales === 'number' && w.monthlyTotalMonth) {
    return { total: w.monthlyTotalSales, fromMonth: w.monthlyTotalMonth, hasTotal: true };
  }
  return { total: 0, fromMonth: '', hasTotal: false };
};

export const getMonthlyLeaderboard = async (): Promise<LeaderboardEntry[]> => {
  const ym = monthYM();
  const workers = await listWorkers();
  const active = workers.filter(w => w.isActive);
  const withTotals = active.map(w => {
    const { total, fromMonth, hasTotal } = lastTotalForWorker(w, ym);
    return { worker: w, total, fromMonth, hasTotal };
  });
  // Sıralama: total-ı olanlar əvvəl total desc, sonra qalanlar əlifba sırası ilə
  withTotals.sort((a, b) => {
    if (a.hasTotal && !b.hasTotal) return -1;
    if (!a.hasTotal && b.hasTotal) return 1;
    if (a.hasTotal && b.hasTotal) return b.total - a.total;
    return `${a.worker.name} ${a.worker.surname}`.localeCompare(`${b.worker.name} ${b.worker.surname}`, 'az');
  });
  return withTotals.map((x, i) => ({
    workerId: x.worker.id,
    name: x.worker.name,
    surname: x.worker.surname,
    photo: x.worker.photo,
    position: x.worker.position,
    branch: x.worker.branch || '',
    rank: i + 1,
    total: x.total,
    fromMonth: x.fromMonth,
    hasTotal: x.hasTotal,
  }));
};

// ───────────────────── Branch leaderboard (filial reytinqi) ─────────────────────
export const getBranchLeaderboard = async (): Promise<BranchLeaderboardEntry[]> => {
  const ym = monthYM();
  const workers = await listWorkers();
  const active = workers.filter(w => w.isActive);
  const byBranch = new Map<string, { workerCount: number; totalSales: number }>();

  for (const w of active) {
    const branchName = (w.branch || '').trim();
    if (!branchName) continue; // filialı təyin olunmayanları reytinqdə göstərmirik
    const { total } = lastTotalForWorker(w, ym);
    const cur = byBranch.get(branchName) || { workerCount: 0, totalSales: 0 };
    cur.workerCount += 1;
    cur.totalSales += total || 0;
    byBranch.set(branchName, cur);
  }

  const list = Array.from(byBranch.entries()).map(([name, v]) => ({
    name,
    workerCount: v.workerCount,
    totalSales: v.totalSales,
    rank: 0,
  }));
  list.sort((a, b) => b.totalSales - a.totalSales);
  list.forEach((x, i) => { x.rank = i + 1; });
  return list;
};

export type { Timestamp };
export { onSnapshot };
