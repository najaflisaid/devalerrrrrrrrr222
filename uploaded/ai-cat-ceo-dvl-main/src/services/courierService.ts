import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * Courier authentication & management service.
 *
 * Couriers are managed by the admin from the admin panel ("Çatdırılma — Kuryerlər").
 * Email + password are stored in Firestore (`couriers` collection). Passwords are kept
 * as plaintext to allow the admin to read / edit them — same approach used for the
 * `workers` collection's `loginPassword` field. This is acceptable because the admin
 * UI is gated behind admin auth.
 */

export interface Courier {
  id: string;
  email: string;
  password: string; // plaintext, admin-managed
  name: string;
  phone?: string;
  isActive: boolean;
  createdAt: any;
  lastLoginAt?: any;
}

const COURIERS = 'couriers';
const SESSION_KEY = 'dv_courier_session';

export interface CourierSession {
  id: string;
  email: string;
  name: string;
  loggedInAt: number;
}

// ───────────────────── CRUD ─────────────────────

export const listCouriers = async (): Promise<Courier[]> => {
  const snap = await getDocs(collection(db, COURIERS));
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as Courier));
  list.sort((a, b) => {
    const ta = (a.createdAt as any)?.toMillis ? (a.createdAt as any).toMillis() : 0;
    const tb = (b.createdAt as any)?.toMillis ? (b.createdAt as any).toMillis() : 0;
    return tb - ta;
  });
  return list;
};

export const addCourier = async (data: {
  email: string;
  password: string;
  name: string;
  phone?: string;
}): Promise<Courier> => {
  const email = data.email.trim().toLowerCase();
  if (!email || !data.password.trim() || !data.name.trim()) {
    throw new Error('Email, şifrə və ad sahələri məcburidir.');
  }
  // Ensure unique email
  const dup = await getDocs(query(collection(db, COURIERS), where('email', '==', email)));
  if (!dup.empty) {
    throw new Error('Bu email ilə kuryer artıq mövcuddur.');
  }
  const payload = {
    email,
    password: data.password.trim(),
    name: data.name.trim(),
    phone: data.phone?.trim() || '',
    isActive: true,
    createdAt: Timestamp.now(),
  };
  const ref = await addDoc(collection(db, COURIERS), payload);
  return { id: ref.id, ...payload } as Courier;
};

export const updateCourier = async (
  id: string,
  patch: Partial<Pick<Courier, 'email' | 'password' | 'name' | 'phone' | 'isActive'>>
): Promise<void> => {
  const data: any = { ...patch };
  if (data.email) data.email = String(data.email).trim().toLowerCase();
  if (data.name) data.name = String(data.name).trim();
  if (data.phone !== undefined) data.phone = String(data.phone || '').trim();
  if (data.password) data.password = String(data.password).trim();
  await updateDoc(doc(db, COURIERS, id), data);
};

export const deleteCourier = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, COURIERS, id));
};

// ───────────────────── Auth ─────────────────────

export const loginCourier = async (
  email: string,
  password: string
): Promise<CourierSession> => {
  const e = email.trim().toLowerCase();
  if (!e || !password) throw new Error('Email və şifrə daxil edin.');
  const snap = await getDocs(query(collection(db, COURIERS), where('email', '==', e)));
  if (snap.empty) throw new Error('Email və ya şifrə yanlışdır.');
  const docSnap = snap.docs[0];
  const c = { id: docSnap.id, ...(docSnap.data() as any) } as Courier;
  if (!c.isActive) throw new Error('Bu kuryer hesabı deaktiv edilib.');
  if (c.password !== password) throw new Error('Email və ya şifrə yanlışdır.');

  // best-effort lastLoginAt update
  try {
    await updateDoc(doc(db, COURIERS, c.id), { lastLoginAt: Timestamp.now() });
  } catch {
    /* ignore */
  }

  const session: CourierSession = {
    id: c.id,
    email: c.email,
    name: c.name,
    loggedInAt: Date.now(),
  };
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* ignore */
  }
  return session;
};

export const getCurrentCourierSession = (): CourierSession | null => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CourierSession;
  } catch {
    return null;
  }
};

export const logoutCourier = (): void => {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
};

export const getCourier = async (id: string): Promise<Courier | null> => {
  const snap = await getDoc(doc(db, COURIERS, id));
  return snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as Courier) : null;
};
