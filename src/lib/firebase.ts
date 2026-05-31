import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, browserLocalPersistence, browserSessionPersistence, indexedDBLocalPersistence, inMemoryPersistence, initializeAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDgm0Zkdp8f-CHOAXDuAFnnoBMok1BCEIw",
  authDomain: "devaleur-11742.firebaseapp.com",
  projectId: "devaleur-11742",
  storageBucket: "devaleur-11742.firebasestorage.app",
  messagingSenderId: "164727049840",
  appId: "1:164727049840:web:5b92e82e1c54602f7baeb5",
  measurementId: "G-8PNJHWZQZW"
};

const app = initializeApp(firebaseConfig);

/**
 * Auth init — iPhone-da Instagram in-app brauzeri və Brave kimi 3rd-party
 * cookie blok edən mühitlərdə standart `getAuth()` IndexedDB-ə müraciət
 * edərkən səssiz uğursuz olur və BÜTÜN tətbiqi sındırır (klik işləmir).
 * Buna görə persistence variantlarını ardıcıllıqla sınayırıq:
 *   IndexedDB → browserLocal → browserSession → inMemory (sonuncu həmişə işləyir).
 */
let _auth: Auth;
try {
  _auth = initializeAuth(app, {
    persistence: [
      indexedDBLocalPersistence,
      browserLocalPersistence,
      browserSessionPersistence,
      inMemoryPersistence,
    ],
  });
} catch {
  // Əgər initializeAuth artıq çağırılıbsa (HMR, double-import) standart getAuth-a qayıt
  _auth = getAuth(app);
}
export const auth = _auth;

// ignoreUndefinedProperties: undefined sahələri Firestore-a göndərməyəcək,
// səssizcə uğursuz olmalardan qoruyur (məs. bonus məbləği boş olduqda).
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
export const storage = getStorage(app);

let secondaryApp: FirebaseApp | null = null;
let secondaryAuth: Auth | null = null;

export const getSecondaryAuth = () => {
  if (!secondaryApp) {
    secondaryApp = initializeApp(firebaseConfig, 'secondary');
    secondaryAuth = getAuth(secondaryApp);
  }
  return secondaryAuth!;
};
