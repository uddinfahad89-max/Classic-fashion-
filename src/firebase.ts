import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
  setLogLevel
} from "firebase/firestore";
import appletFirebaseConfig from "../firebase-applet-config.json";

// Your web app's Firebase configuration
export const firebaseConfig = appletFirebaseConfig;

// Initialize Firebase safely (avoid re-initialization if already loaded)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Analytics safely (works in client browser)
let analytics: any = null;
if (typeof window !== "undefined") {
  isSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    })
    .catch(() => {});
}

// Silence internal SDK network/offline warning messages from console
try {
  setLogLevel('silent');
} catch {}

// Initialize Auth
export const auth = getAuth(app);

// Initialize Firestore with databaseId, ignoreUndefinedProperties, and long-polling transport
const databaseId = (firebaseConfig as any).firestoreDatabaseId || '(default)';
let dbInstance: any;
try {
  dbInstance = initializeFirestore(
    app,
    {
      experimentalForceLongPolling: true,
      ignoreUndefinedProperties: true,
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    },
    databaseId
  );
} catch {
  try {
    dbInstance = initializeFirestore(
      app,
      {
        experimentalForceLongPolling: true,
        ignoreUndefinedProperties: true
      },
      databaseId
    );
  } catch {
    dbInstance = getFirestore(app, databaseId);
  }
}

export const db = dbInstance;
export { analytics };
export default app;

