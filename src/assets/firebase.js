import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCv3GsaXFMBqyFN8zUa2EZYfXsnv4KnePg",
  authDomain: "astralife-ai-c433d.firebaseapp.com",
  projectId: "astralife-ai-c433d",
  storageBucket: "astralife-ai-c433d.firebasestorage.app",
  messagingSenderId: "315214804299",
  appId: "1:315214804299:web:73c9afde259d308c8ce4ce",
  measurementId: "G-HKDKKQL7X0",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;