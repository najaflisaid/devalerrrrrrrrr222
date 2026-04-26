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
  WorkerRequest, RequestStatus, WorkerNotification,
} from '../types/worker';

const WORKERS = 'workers';
const ATTENDANCE = 'worker_attendance';
const FINES = 'worker_fines';
const REWARDS = 'worker_rewards';
const SALES = 'worker_sales';
const REQUESTS = 'worker_requests';
const NOTIFICATIONS = 'worker_notifications';

const todayStr = () => new Date().toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();

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
    hireDate: data.hireDate,
    contractStart: data.contractStart,
    contractEnd: data.contractEnd,
    rating: data.rating ?? 5,
    isActive: data.isActive ?? true,
    monthlyTarget: data.monthlyTarget ?? 0,
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
  const q = query(
    collection(db, ATTENDANCE),
    where('workerId', '==', workerId),
    where('date', '>=', since)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as AttendanceEntry).sort((a, b) => b.date.localeCompare(a.date));
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
export const monthYM = (d = new Date()) => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const daysSince = (iso: string): number => {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
};

export const computeAttendancePercent = async (workerId: string): Promise<number> => {
  const ym = monthYM();
  const items = await listAttendance(workerId, 31);
  const monthDays = items.filter(a => a.date.startsWith(ym) && a.startTime);
  const today = new Date();
  const workingDaysSoFar = today.getDate(); // simple proxy
  const present = monthDays.length;
  return workingDaysSoFar === 0 ? 0 : Math.min(100, Math.round((present / workingDaysSoFar) * 100));
};

export type { Timestamp };
export { onSnapshot };
