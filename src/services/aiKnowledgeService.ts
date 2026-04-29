import { doc, getDoc, setDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface AiKnowledge {
  enabled: boolean;          // Chat widget visible on the site
  aiInstructions: string;    // AI davranış komandaları (admin-in xüsusi göstərişləri)
  companyInfo: string;       // Şirkət, missiya, tarix
  brandsInfo: string;        // Brendlər haqqında (hansı ölkə, tarix)
  policiesInfo: string;      // Zəmanət, çatdırılma, qaytarma siyasəti
  productsInfo: string;      // Konkret məhsullar haqqında əlavə qeydlər
  additionalNotes: string;   // Əlavə kontekst, FAQ, satış qaydaları
  updatedAt?: any;
}

const DOC_REF = doc(db, 'ai_knowledge', 'main');

export const EMPTY_KNOWLEDGE: AiKnowledge = {
  enabled: true,
  aiInstructions: '',
  companyInfo: '',
  brandsInfo: '',
  policiesInfo: '',
  productsInfo: '',
  additionalNotes: '',
};

export const getAiKnowledge = async (): Promise<AiKnowledge> => {
  try {
    const snap = await getDoc(DOC_REF);
    if (!snap.exists()) return { ...EMPTY_KNOWLEDGE };
    const d = snap.data() as any;
    return {
      // default to true if the field is missing (backward compat)
      enabled: d.enabled === false ? false : true,
      aiInstructions: d.aiInstructions || '',
      companyInfo: d.companyInfo || '',
      brandsInfo: d.brandsInfo || '',
      policiesInfo: d.policiesInfo || '',
      productsInfo: d.productsInfo || '',
      additionalNotes: d.additionalNotes || '',
    };
  } catch (e) {
    console.warn('getAiKnowledge failed:', e);
    return { ...EMPTY_KNOWLEDGE };
  }
};

export const saveAiKnowledge = async (data: AiKnowledge): Promise<void> => {
  await setDoc(
    DOC_REF,
    {
      ...data,
      updatedAt: Timestamp.now(),
    },
    { merge: false }
  );
};

/**
 * Live subscription to the chat-enabled flag.
 * Used by the public chat widget to hide / show itself in real time
 * when the admin toggles it.
 */
export const subscribeChatEnabled = (
  cb: (enabled: boolean) => void
): (() => void) => {
  return onSnapshot(
    DOC_REF,
    (snap) => {
      if (!snap.exists()) {
        cb(true);
        return;
      }
      const d = snap.data() as any;
      cb(d.enabled === false ? false : true);
    },
    (err) => {
      console.warn('subscribeChatEnabled failed:', err);
      cb(true);
    }
  );
};
