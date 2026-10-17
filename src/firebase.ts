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

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyDAl0AE1OvHgDOqinr4_VVW8UOMOxFF_HQ",
  authDomain: "classic-fashion-pos.firebaseapp.com",
  projectId: "classic-fashion-pos",
  storageBucket: "classic-fashion-pos.firebasestorage.app",
  messagingSenderId: "172454758518",
  appId: "1:172454758518:web:24425a2cf79b20bfa37757",
  measurementId: "G-F7H5J10EZB"
};

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

// Initialize Firestore with long-polling transport & persistent multi-tab cache
// to prevent 10s backend connection timeouts in sandboxes, iframes and mobile webviews
let dbInstance: any;
try {
  dbInstance = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch {
  try {
    dbInstance = initializeFirestore(app, {
      experimentalForceLongPolling: true
    });
  } catch {
    dbInstance = getFirestore(app);
  }
}

export const db = dbInstance;
export { analytics };
export default app;

