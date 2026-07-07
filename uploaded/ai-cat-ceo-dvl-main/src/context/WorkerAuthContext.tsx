import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User as FbUser } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { getWorker } from '../services/workerService';
import type { Worker } from '../types/worker';

interface Ctx {
  worker: Worker | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const WorkerAuthContext = createContext<Ctx | null>(null);

export const WorkerAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [worker, setWorker] = useState<Worker | null>(null);
  const [loading, setLoading] = useState(true);

  const loadWorkerForUser = async (u: FbUser | null) => {
    if (!u) { setWorker(null); setLoading(false); return; }
    try {
      const w = await getWorker(u.uid);
      setWorker(w && w.isActive ? w : null);
    } catch { setWorker(null); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, loadWorkerForUser);
    return () => unsub();
  }, []);

  const login = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const w = await getWorker(cred.user.uid);
    if (!w || !w.isActive) {
      await signOut(auth);
      throw new Error('Bu hesab işçi kimi qeydiyyatda deyil və ya deaktivdir.');
    }
    setWorker(w);
  };

  const logout = async () => {
    await signOut(auth);
    setWorker(null);
  };

  const refresh = async () => {
    if (!auth.currentUser) return;
    await loadWorkerForUser(auth.currentUser);
  };

  return (
    <WorkerAuthContext.Provider value={{ worker, loading, login, logout, refresh }}>
      {children}
    </WorkerAuthContext.Provider>
  );
};

export const useWorkerAuth = () => {
  const ctx = useContext(WorkerAuthContext);
  if (!ctx) throw new Error('useWorkerAuth must be used inside WorkerAuthProvider');
  return ctx;
};
