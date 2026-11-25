import { FirebaseError, getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  type Auth,
} from "firebase/auth";

const rawConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim() ?? "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() ?? "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim() ?? "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim() ?? "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() ?? "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim() ?? "",
};

const requiredPairs: Array<[string, string]> = [
  ["VITE_FIREBASE_API_KEY", rawConfig.apiKey],
  ["VITE_FIREBASE_AUTH_DOMAIN", rawConfig.authDomain],
  ["VITE_FIREBASE_PROJECT_ID", rawConfig.projectId],
  ["VITE_FIREBASE_APP_ID", rawConfig.appId],
];

export const missingFirebaseEnvVars: string[] = requiredPairs
  .filter(([, value]) => !value || value.toLowerCase().includes("your-"))
  .map(([key]) => key);

export const isFirebaseClientConfigured = missingFirebaseEnvVars.length === 0;

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let googleProvider: GoogleAuthProvider | null = null;

if (isFirebaseClientConfigured) {
  firebaseApp = getApps().length > 0 ? getApp() : initializeApp(rawConfig);
  firebaseAuth = getAuth(firebaseApp);
  googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({
    prompt: "select_account",
  });
}

export { firebaseApp, firebaseAuth, googleProvider };

export function formatFirebaseAuthError(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/popup-closed-by-user":
        return "Google sign-in popup was closed before completing authentication.";
      case "auth/popup-blocked":
        return "Browser blocked the Google sign-in popup. Allow popups for this site and try again.";
      case "auth/unauthorized-domain":
        return "This domain is not authorized in Firebase Console → Authentication → Settings → Authorized domains.";
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "Invalid email address or password.";
      case "auth/email-already-in-use":
        return "An account with this email already exists. Try signing in instead.";
      case "auth/weak-password":
        return "Password must be at least 6 characters long.";
      case "auth/invalid-email":
        return "Please enter a valid email address.";
      case "auth/too-many-requests":
        return "Too many attempts. Please wait a few moments before trying again.";
      case "auth/expired-action-code":
      case "auth/invalid-action-code":
        return "This password reset link has expired or already been used. Request a new one.";
      default:
        return error.message || "Authentication failed.";
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "An unexpected authentication error occurred.";
}

