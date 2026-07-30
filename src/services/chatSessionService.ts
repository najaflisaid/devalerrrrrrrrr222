/**
 * De Valeur — AI Chat Session Firestore logging service.
 *
 * Collections:
 *   chatSessions/{sessionId}          -> session metadata
 *   chatSessions/{sessionId}/messages -> individual messages (ordered by ts)
 */
import {
  doc,
  setDoc,
  updateDoc,
  addDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  increment,
  getDocs,
  Timestamp,
  writeBatch,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface ChatSessionMeta {
  id: string;
  startedAt?: any;
  lastActive?: any;
  messageCount: number;
  userMessageCount: number;
  aiEnabled: boolean;              // Admin can turn off AI for this session (live takeover)
  lastMessage: string;
  lastRole: 'user' | 'assistant' | 'admin';
  language: string;
  userAgent?: string;
  path?: string;                   // First page opened from
  referrer?: string;
  topics?: string[];               // Auto-tagged topics (brand mentions etc.)
  hasImage?: boolean;
  closed?: boolean;                // Marked closed by admin
}

export interface ChatSessionMessage {
  id?: string;
  role: 'user' | 'assistant' | 'admin';
  content: string;
  imageUrl?: string;
  ts?: any;                        // Firestore Timestamp
  byName?: string;                 // 'AI' / 'Admin' / customer
  byRole?: string;                 // Admin rol/vəzifə (yalnız admin mesajları üçün)
}

const SESSIONS = 'chatSessions';

export const initSession = async (
  sessionId: string,
  meta: Partial<ChatSessionMeta> = {}
): Promise<void> => {
  const ref = doc(db, SESSIONS, sessionId);
  await setDoc(
    ref,
    {
      id: sessionId,
      startedAt: serverTimestamp(),
      lastActive: serverTimestamp(),
      messageCount: 0,
      userMessageCount: 0,
      aiEnabled: true,
      lastMessage: '',
      lastRole: 'user',
      language: meta.language || 'az',
      userAgent: meta.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
      path: meta.path || (typeof window !== 'undefined' ? window.location.pathname : ''),
      referrer: meta.referrer || (typeof document !== 'undefined' ? document.referrer : ''),
      closed: false,
      hasImage: false,
    },
    { merge: true }
  );
};

export const logMessage = async (
  sessionId: string,
  msg: ChatSessionMessage
): Promise<string> => {
  const msgsRef = collection(db, SESSIONS, sessionId, 'messages');
  const docRef = await addDoc(msgsRef, {
    role: msg.role,
    content: msg.content || '',
    imageUrl: msg.imageUrl || null,
    ts: serverTimestamp(),
    byName: msg.byName || (msg.role === 'user' ? 'Müştəri' : msg.role === 'admin' ? 'Admin' : 'AI'),
    byRole: msg.byRole || null,
  });
  const sessRef = doc(db, SESSIONS, sessionId);
  const updates: Record<string, any> = {
    lastActive: serverTimestamp(),
    lastMessage: (msg.imageUrl && !msg.content) ? '[şəkil]' : (msg.content || '').slice(0, 200),
    lastRole: msg.role,
    messageCount: increment(1),
  };
  if (msg.role === 'user') updates.userMessageCount = increment(1);
  if (msg.imageUrl) updates.hasImage = true;
  await updateDoc(sessRef, updates).catch(async () => {
    // Session doc doesn't exist — create it lazily
    await initSession(sessionId);
    await updateDoc(sessRef, updates);
  });
  return docRef.id;
};

export const subscribeSession = (
  sessionId: string,
  cb: (session: ChatSessionMeta | null) => void
): (() => void) => {
  const ref = doc(db, SESSIONS, sessionId);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) return cb(null);
      cb({ ...(snap.data() as any), id: snap.id });
    },
    () => cb(null)
  );
};

export const subscribeSessionMessages = (
  sessionId: string,
  cb: (msgs: ChatSessionMessage[]) => void
): (() => void) => {
  const q = query(collection(db, SESSIONS, sessionId, 'messages'), orderBy('ts', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      const list: ChatSessionMessage[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
      cb(list);
    },
    () => cb([])
  );
};

export const subscribeAllSessions = (
  cb: (sessions: ChatSessionMeta[]) => void
): (() => void) => {
  const q = query(collection(db, SESSIONS), orderBy('lastActive', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const list: ChatSessionMeta[] = [];
      snap.forEach((d) => list.push({ ...(d.data() as any), id: d.id }));
      cb(list);
    },
    () => cb([])
  );
};

export const toggleSessionAi = async (sessionId: string, enabled: boolean): Promise<void> => {
  await updateDoc(doc(db, SESSIONS, sessionId), { aiEnabled: enabled });
};

export const deleteSession = async (sessionId: string): Promise<void> => {
  // Delete all messages first
  const msgs = await getDocs(collection(db, SESSIONS, sessionId, 'messages'));
  const batch = writeBatch(db);
  msgs.forEach((m) => batch.delete(m.ref));
  batch.delete(doc(db, SESSIONS, sessionId));
  await batch.commit();
};

// Statistics helpers -------------------------------------------------------

export interface ChatStats {
  totalSessions: number;
  totalMessages: number;
  totalUserMessages: number;
  totalWithImages: number;
  activeToday: number;
  activeThisWeek: number;
  avgMessagesPerSession: number;
  avgSessionDurationMin: number; // between startedAt & lastActive
  topKeywords: Array<{ word: string; count: number }>;
  languageBreakdown: Record<string, number>;
}

const STOP_WORDS = new Set([
  'və','olan','üçün','ilə','ki','bu','o','mən','sən','biz','siz','onlar','çox','az','var','yox','ne','nə','hansı',
  'salam','hello','привет','the','is','a','an','and','or','for','of','in','to','you','me','it','my','your','with',
  'da','də','ya','çün','bir','iki','üç','deyil','bəs','bəli','xeyr','ok','ok.','какой','что','это','я','ты','мы','вы','они','сколько','как','где','когда',
]);

const extractKeywords = (text: string): string[] => {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
};

export const computeStats = async (): Promise<ChatStats> => {
  const sessionsSnap = await getDocs(collection(db, SESSIONS));
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  let totalMessages = 0;
  let totalUserMessages = 0;
  let totalWithImages = 0;
  let activeToday = 0;
  let activeThisWeek = 0;
  let totalDurationMs = 0;
  let durationCount = 0;
  const langCounts: Record<string, number> = {};
  const wordCounts: Record<string, number> = {};

  // Read all sessions once, sort client-side by lastActive desc so newest are prioritized.
  const sessions: ChatSessionMeta[] = [];
  sessionsSnap.forEach((d) => sessions.push({ ...(d.data() as any), id: d.id }));

  const getMs = (v: any): number => {
    if (!v) return 0;
    if (typeof v.seconds === 'number') return v.seconds * 1000;
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (v instanceof Date) return v.getTime();
    return 0;
  };

  sessions.sort((a, b) => getMs((b as any).lastActive) - getMs((a as any).lastActive));

  const recent = sessions.slice(0, 300);
  for (const s of recent) {
    totalMessages += Number(s.messageCount) || 0;
    totalUserMessages += Number(s.userMessageCount) || 0;
    if (s.hasImage) totalWithImages++;

    const lastMs = getMs((s as any).lastActive);
    if (lastMs) {
      if (now - lastMs < dayMs) activeToday++;
      if (now - lastMs < 7 * dayMs) activeThisWeek++;
    }
    const startMs = getMs((s as any).startedAt);
    if (lastMs && startMs && lastMs > startMs) {
      totalDurationMs += lastMs - startMs;
      durationCount++;
    }
    if (s.language) langCounts[s.language] = (langCounts[s.language] || 0) + 1;
  }

  // Sample user messages for top keywords — run in parallel (much faster than serial).
  // Limit to 40 latest sessions to save reads and keep the panel snappy.
  const sampled = recent.slice(0, 40);
  const results = await Promise.allSettled(
    sampled.map((s) =>
      getDocs(query(collection(db, SESSIONS, s.id, 'messages'), where('role', '==', 'user')))
    )
  );
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    r.value.forEach((m) => {
      const c = (m.data() as any).content || '';
      for (const w of extractKeywords(c)) {
        wordCounts[w] = (wordCounts[w] || 0) + 1;
      }
    });
  }

  const topKeywords = Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word, count]) => ({ word, count }));

  return {
    totalSessions: sessions.length,
    totalMessages,
    totalUserMessages,
    totalWithImages,
    activeToday,
    activeThisWeek,
    avgMessagesPerSession: sessions.length ? Math.round((totalMessages / sessions.length) * 10) / 10 : 0,
    avgSessionDurationMin: durationCount ? Math.round((totalDurationMs / durationCount) / 60000 * 10) / 10 : 0,
    topKeywords,
    languageBreakdown: langCounts,
  };
};

export const formatRelativeTime = (ts?: Timestamp | any): string => {
  const ms = ts?.seconds ? ts.seconds * 1000 : 0;
  if (!ms) return '';
  const diff = Date.now() - ms;
  if (diff < 60000) return 'indicə';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' dəq əvvəl';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' saat əvvəl';
  const d = new Date(ms);
  return d.toLocaleDateString('az-AZ') + ' ' + d.toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' });
};
