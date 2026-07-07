/**
 * Admin konsultant profili — müştəriyə görünən ad/soyad və rol.
 * Firestore: admin_profiles/main (single doc — bütün adminlər eyni displayName istifadə edir)
 */
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface AdminChatProfile {
  displayName: string;      // Örn: "Aynur Məmmədova"
  roleLabel: string;        // Örn: "Satış məsləhətçisi"
  avatarUrl?: string;       // Optional profil şəkli
  updatedAt?: any;
}

const DOC_REF = doc(db, 'admin_profiles', 'main');

export const DEFAULT_ADMIN_PROFILE: AdminChatProfile = {
  displayName: 'De Valeur',
  roleLabel: 'Satış məsləhətçisi',
  avatarUrl: '',
};

export const getAdminChatProfile = async (): Promise<AdminChatProfile> => {
  try {
    const s = await getDoc(DOC_REF);
    if (!s.exists()) return { ...DEFAULT_ADMIN_PROFILE };
    const d = s.data() as any;
    return {
      displayName: d.displayName || DEFAULT_ADMIN_PROFILE.displayName,
      roleLabel: d.roleLabel || DEFAULT_ADMIN_PROFILE.roleLabel,
      avatarUrl: d.avatarUrl || '',
    };
  } catch {
    return { ...DEFAULT_ADMIN_PROFILE };
  }
};

export const saveAdminChatProfile = async (p: AdminChatProfile): Promise<void> => {
  await setDoc(
    DOC_REF,
    {
      displayName: (p.displayName || '').trim() || DEFAULT_ADMIN_PROFILE.displayName,
      roleLabel: (p.roleLabel || '').trim() || DEFAULT_ADMIN_PROFILE.roleLabel,
      avatarUrl: (p.avatarUrl || '').trim(),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
};

export const subscribeAdminChatProfile = (cb: (p: AdminChatProfile) => void): (() => void) =>
  onSnapshot(
    DOC_REF,
    (snap) => {
      if (!snap.exists()) return cb({ ...DEFAULT_ADMIN_PROFILE });
      const d = snap.data() as any;
      cb({
        displayName: d.displayName || DEFAULT_ADMIN_PROFILE.displayName,
        roleLabel: d.roleLabel || DEFAULT_ADMIN_PROFILE.roleLabel,
        avatarUrl: d.avatarUrl || '',
      });
    },
    () => cb({ ...DEFAULT_ADMIN_PROFILE })
  );
