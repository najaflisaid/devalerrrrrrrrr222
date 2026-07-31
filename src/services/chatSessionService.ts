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
  lastUserMessageAt?: any;         // Timestamp of the last message sent BY the customer
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
  // Contact capture (customer shared phone / name)
  contactCaptured?: boolean;
  contactPhone?: string;
  contactName?: string;
  contactCapturedAt?: any;         // Timestamp of first capture
  // WhatsApp-style read receipts
  lastReadByCustomerTs?: any;      // Timestamp: last time customer viewed the chat
  // WhatsApp-style typing indicator
  customerTyping?: boolean;
  customerTypingAt?: any;          // Timestamp: last time customer input changed
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
  if (msg.role === 'user') {
    updates.userMessageCount = increment(1);
    updates.lastUserMessageAt = serverTimestamp();
  }
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
  // Firestore orderBy is used purely to get an initial reasonable ordering;
  // final sort happens client-side by `lastUserMessageAt` (last CUSTOMER msg)
  // so that whoever wrote last always appears on top.
  const q = query(collection(db, SESSIONS), orderBy('lastActive', 'desc'));
  const getMs = (v: any): number => {
    if (!v) return 0;
    if (typeof v.seconds === 'number') return v.seconds * 1000;
    if (typeof v.toMillis === 'function') return v.toMillis();
    return 0;
  };
  return onSnapshot(
    q,
    (snap) => {
      const list: ChatSessionMeta[] = [];
      snap.forEach((d) => list.push({ ...(d.data() as any), id: d.id }));
      list.sort((a, b) => {
        const av = getMs((a as any).lastUserMessageAt) || getMs((a as any).lastActive);
        const bv = getMs((b as any).lastUserMessageAt) || getMs((b as any).lastActive);
        return bv - av;
      });
      cb(list);
    },
    () => cb([])
  );
};

// ────────── Anonymized 5-digit customer code ──────────

/**
 * Deterministic 5-digit code (10000-99999) derived from a session id — used
 * as the "display name" for anonymous chat visitors so admins see stable
 * short numbers instead of raw session UUIDs.
 */
export const sessionShortCode = (sessionId: string): string => {
  if (!sessionId) return '00000';
  let hash = 5381;
  for (let i = 0; i < sessionId.length; i++) {
    hash = ((hash << 5) + hash + sessionId.charCodeAt(i)) | 0;
  }
  const num = Math.abs(hash) % 90000 + 10000;
  return String(num);
};

/**
 * Formats a Firestore Timestamp/Date to `DD.MM.YY HH:MM` (Baku-friendly)
 * — used for showing when the customer started a chat session.
 */
export const formatSessionStart = (ts: any): string => {
  let ms = 0;
  if (!ts) return '';
  if (typeof ts.seconds === 'number') ms = ts.seconds * 1000;
  else if (typeof ts.toMillis === 'function') ms = ts.toMillis();
  else if (ts instanceof Date) ms = ts.getTime();
  if (!ms) return '';
  const d = new Date(ms);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yy} ${hh}:${mi}`;
};

export const toggleSessionAi = async (sessionId: string, enabled: boolean): Promise<void> => {
  await updateDoc(doc(db, SESSIONS, sessionId), { aiEnabled: enabled });
};

// ────────── Read receipts (WhatsApp-style) ──────────

/**
 * Customer tərəfindən çağırılır — chat açıq olduqda və mesajlar görünəndə
 * session sənədinə "oxundu vaxtı" yazılır. Admin panelində iki mavi cek
 * (blue double check) göstərmək üçün istifadə olunur.
 */
export const markSessionRead = async (sessionId: string): Promise<void> => {
  try {
    await updateDoc(doc(db, SESSIONS, sessionId), {
      lastReadByCustomerTs: serverTimestamp(),
    });
  } catch {
    /* ignore — session may not exist yet */
  }
};

// ────────── Typing indicator (WhatsApp-style "yazır…") ──────────

/**
 * Müştəri input yazdıqda çağırılır (throttled). Session sənədinə
 * `customerTyping=true` və `customerTypingAt=serverTimestamp()` yazır.
 * Admin panel bunu subscribeSession vasitəsi ilə real-time görür.
 */
export const setCustomerTyping = async (sessionId: string, typing: boolean): Promise<void> => {
  try {
    await updateDoc(doc(db, SESSIONS, sessionId), {
      customerTyping: typing,
      customerTypingAt: typing ? serverTimestamp() : null,
    });
  } catch {
    /* ignore */
  }
};

// ────────── Contact capture (phone + name) ──────────

const PHONE_REGEX = /(?:\+?994|\+?7|\+?90)?[\s\-().]*(?:\d[\s\-().]*){9,13}/g;

const normalizePhone = (raw: string): string => {
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.length < 9) return '';
  // Ensure it has country code prefix (default AZ +994)
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('994') || digits.startsWith('7') || digits.startsWith('90')) return '+' + digits;
  if (digits.startsWith('0') && digits.length >= 10) return '+994' + digits.slice(1);
  if (digits.length === 9) return '+994' + digits;
  return digits;
};

const NAME_STOP_WORDS = new Set([
  'Salam', 'Nömrə', 'Nomre', 'Telefon', 'Tel', 'Mobil', 'Mobile', 'Whatsapp', 'Wp',
  'Здравствуйте', 'Привет', 'Телефон', 'Номер', 'Мобильный',
  'Hello', 'Hi', 'Phone', 'Number', 'Contact',
  'Bakı', 'Baku', 'Şəhər', 'Ünvan',
]);

const isValidNameCandidate = (candidate: string): boolean => {
  const parts = candidate.split(/\s+/);
  return parts.every((p) => !NAME_STOP_WORDS.has(p));
};

const NAME_PATTERNS = [
  /(?:adım|ismim|mənim\s+adım)\s+([\p{L}]{2,}(?:\s+[\p{L}]{2,}){0,2})/iu,
  /(?:меня\s+зовут|моё\s+имя|моя\s+имя|я\s*[-—]?\s*)\s*([\p{L}]{2,}(?:\s+[\p{L}]{2,}){0,2})/iu,
  /(?:my\s+name\s+is|i\s+am|i'm)\s+([\p{L}]{2,}(?:\s+[\p{L}]{2,}){0,2})/iu,
];

export interface DetectedContact {
  phone?: string;
  name?: string;
}

/**
 * Müştəri mesajı içindən telefon nömrəsi və ad çıxarır. Yalnız telefon
 * varsa "yakalandı" hesab olunur — ad opsionaldır.
 */
export const detectContactInfo = (text: string): DetectedContact => {
  if (!text) return {};
  const out: DetectedContact = {};

  // 1) Phone — pick the LONGEST digit run so we don't confuse it with prices.
  const matches = text.match(PHONE_REGEX);
  if (matches) {
    let best = '';
    for (const m of matches) {
      const digitsOnly = m.replace(/\D/g, '');
      if (digitsOnly.length >= 9 && digitsOnly.length > best.replace(/\D/g, '').length) {
        best = m;
      }
    }
    if (best) {
      const normalized = normalizePhone(best);
      if (normalized) out.phone = normalized;
    }
  }

  // 2) Name — explicit patterns first
  for (const re of NAME_PATTERNS) {
    const m = text.match(re);
    if (m && m[1]) {
      const candidate = m[1].trim().replace(/\s+/g, ' ').slice(0, 60);
      if (isValidNameCandidate(candidate)) {
        out.name = candidate;
        break;
      }
    }
  }

  // 3) Fallback: if a phone was detected AND the message is short, take
  //    any capitalized word(s) not part of the phone as a name candidate.
  if (out.phone && !out.name && text.length < 120) {
    const cleaned = text.replace(PHONE_REGEX, ' ').trim();
    // Try to find up to 3 candidates and pick the first valid one.
    const iter = cleaned.matchAll(/\b(\p{Lu}\p{Ll}{1,}(?:\s+\p{Lu}\p{Ll}{1,}){0,2})\b/gu);
    for (const m of iter) {
      const candidate = m[1].trim().slice(0, 60);
      if (isValidNameCandidate(candidate)) {
        out.name = candidate;
        break;
      }
    }
  }

  return out;
};

export const captureSessionContact = async (
  sessionId: string,
  info: DetectedContact
): Promise<boolean> => {
  if (!info.phone) return false;
  try {
    const patch: Record<string, any> = {
      contactCaptured: true,
      contactPhone: info.phone,
      contactCapturedAt: serverTimestamp(),
    };
    if (info.name) patch.contactName = info.name;
    await updateDoc(doc(db, SESSIONS, sessionId), patch);
    return true;
  } catch {
    return false;
  }
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
