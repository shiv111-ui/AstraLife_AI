import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY;
const isLocalhostDevelopment = import.meta.env.DEV
  && typeof window !== "undefined"
  && ["localhost", "127.0.0.1"].includes(window.location.hostname);
const appCheckDebugToken = isLocalhostDevelopment
  ? import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN
  : undefined;

if (appCheckDebugToken && typeof self !== "undefined") {
  // `true` asks Firebase to generate a token for initial local registration.
  // A registered token can be supplied here through the ignored local env file.
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = appCheckDebugToken === "true"
    ? true
    : appCheckDebugToken;
}

export const appCheck = appCheckSiteKey
  ? initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    })
  : null;

if (!appCheckSiteKey) {
  console.error("Firebase App Check is not initialized. Set VITE_FIREBASE_APPCHECK_SITE_KEY for this environment.");
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, "asia-south1");

export default app;
