import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAuf8hwpw9O12anaL6GrDvnhlaS5whrx4c",
  authDomain: "meuponto-2e684.firebaseapp.com",
  databaseURL: "https://meuponto-2e684-default-rtdb.firebaseio.com",
  projectId: "meuponto-2e684",
  storageBucket: "meuponto-2e684.firebasestorage.app",
  messagingSenderId: "1098800024869",
  appId: "1:1098800024869:web:43e924542ff562bd0f1ecc",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
