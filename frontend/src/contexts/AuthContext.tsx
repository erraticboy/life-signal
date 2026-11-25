import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  linkWithCredential,
  onIdTokenChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";
import { apiClient } from "../lib/api";
import {
  firebaseAuth,
  formatFirebaseAuthError,
  googleProvider,
  isFirebaseClientConfigured,
} from "../lib/firebase";
import type { UserProfile, UserRole } from "../types/auth";

const DEV_TOKEN_STORAGE_KEY = "life-signal-dev-token";
const DEV_MODE_CLIENT_FLAG = import.meta.env.VITE_ENABLE_DEV_AUTH?.trim().toLowerCase() === "true";

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  profile: UserProfile | null;
  authMode: "firebase" | "dev" | null;
  loading: boolean;
  isConfigured: boolean;
  isDevAuthAvailable: boolean;
  backendSyncError: string | null;
  hasPasswordProvider: boolean;
  hasGoogleProvider: boolean;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
  loginWithGoogle: () => Promise<UserProfile>;
  loginWithEmail: (email: string, password: string) => Promise<UserProfile>;
  registerWithEmail: (fullName: string, email: string, password: string) => Promise<UserProfile>;
  loginWithDevMode: (payload: {
    full_name: string;
    email: string;
    role: UserRole;
  }) => Promise<UserProfile>;
  setOrChangePassword: (newPassword: string, currentPassword?: string) => Promise<void>;
  sendResetEmail: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  updateDisplayName: (fullName: string) => Promise<UserProfile>;
  refreshProfile: () => Promise<void>;
  logout: (revokeAllDevices?: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authMode, setAuthMode] = useState<"firebase" | "dev" | null>(null);
  const [isDevAuthAvailable, setIsDevAuthAvailable] = useState<boolean>(DEV_MODE_CLIENT_FLAG);
  const [loading, setLoading] = useState<boolean>(true);
  const [backendSyncError, setBackendSyncError] = useState<string | null>(null);
  const [providerVersion, setProviderVersion] = useState<number>(0);
  const pendingRegistrationNameRef = useRef<string | undefined>(undefined);

  const syncWithBackend = useCallback(async (fbUser: FirebaseUser, explicitName?: string) => {
    const token = await fbUser.getIdToken();
    const session = await apiClient.syncAuthSession(token, explicitName);
    setProfile(session.user);
    setAuthMode("firebase");
    setBackendSyncError(null);
    return session.user;
  }, []);

  useEffect(() => {
    let active = true;

    // Check backend readiness for dev auth flag
    apiClient
      .getConfigStatus()
      .then((status) => {
        if (active) {
          setIsDevAuthAvailable(Boolean(status.dev_auth_enabled) && DEV_MODE_CLIENT_FLAG);
        }
      })
      .catch(() => {
        if (active) {
          setIsDevAuthAvailable(DEV_MODE_CLIENT_FLAG);
        }
      });

    // Restore an active local dev session if Firebase isn't holding a session
    const savedDevToken = window.sessionStorage.getItem(DEV_TOKEN_STORAGE_KEY);
    if (!isFirebaseClientConfigured || !firebaseAuth) {
      if (savedDevToken && DEV_MODE_CLIENT_FLAG) {
        apiClient
          .getMyProfile(savedDevToken)
          .then((user) => {
            if (active) {
              setProfile(user);
              setAuthMode("dev");
              setBackendSyncError(null);
            }
          })
          .catch(() => {
            window.sessionStorage.removeItem(DEV_TOKEN_STORAGE_KEY);
            if (active) {
              setProfile(null);
              setAuthMode(null);
            }
          })
          .finally(() => {
            if (active) setLoading(false);
          });
      } else {
        setLoading(false);
      }
      return () => {
        active = false;
      };
    }

    const unsubscribe = onIdTokenChanged(firebaseAuth, async (fbUser) => {
      if (!active) return;
      setFirebaseUser(fbUser);
      if (!fbUser) {
        if (savedDevToken && DEV_MODE_CLIENT_FLAG) {
          try {
            const devUser = await apiClient.getMyProfile(savedDevToken);
            if (active) {
              setProfile(devUser);
              setAuthMode("dev");
              setBackendSyncError(null);
            }
          } catch {
            window.sessionStorage.removeItem(DEV_TOKEN_STORAGE_KEY);
            if (active) {
              setProfile(null);
              setAuthMode(null);
            }
          } finally {
            if (active) setLoading(false);
          }
          return;
        }
        setProfile(null);
        setAuthMode(null);
        setBackendSyncError(null);
        setLoading(false);
        return;
      }

      try {
        window.sessionStorage.removeItem(DEV_TOKEN_STORAGE_KEY);
        const pendingName = pendingRegistrationNameRef.current;
        pendingRegistrationNameRef.current = undefined;
        await syncWithBackend(fbUser, pendingName);
      } catch (err) {
        setProfile(null);
        setAuthMode(null);
        setBackendSyncError(
          err instanceof Error ? err.message : "Failed to verify session with LIFE SIGNAL backend."
        );
      } finally {
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [syncWithBackend]);

  const ensureAuthReady = () => {
    if (!isFirebaseClientConfigured || !firebaseAuth || !googleProvider) {
      throw new Error(
        "Firebase Authentication is not configured. Add VITE_FIREBASE_* keys to frontend/.env."
      );
    }
    return { auth: firebaseAuth, provider: googleProvider };
  };

  const getIdToken = useCallback(async (forceRefresh = false): Promise<string | null> => {
    if (firebaseAuth?.currentUser) {
      return firebaseAuth.currentUser.getIdToken(forceRefresh);
    }
    if (DEV_MODE_CLIENT_FLAG) {
      return window.sessionStorage.getItem(DEV_TOKEN_STORAGE_KEY);
    }
    return null;
  }, []);

  const loginWithGoogle = async (): Promise<UserProfile> => {
    const { auth, provider } = ensureAuthReady();
    try {
      window.sessionStorage.removeItem(DEV_TOKEN_STORAGE_KEY);
      const result = await signInWithPopup(auth, provider);
      return await syncWithBackend(result.user);
    } catch (err) {
      throw new Error(formatFirebaseAuthError(err));
    }
  };

  const loginWithEmail = async (email: string, password: string): Promise<UserProfile> => {
    const { auth } = ensureAuthReady();
    try {
      window.sessionStorage.removeItem(DEV_TOKEN_STORAGE_KEY);
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      return await syncWithBackend(result.user);
    } catch (err) {
      throw new Error(formatFirebaseAuthError(err));
    }
  };

  const registerWithEmail = async (
    fullName: string,
    email: string,
    password: string
  ): Promise<UserProfile> => {
    const { auth } = ensureAuthReady();
    const cleanedName = fullName.trim();
    pendingRegistrationNameRef.current = cleanedName;
    try {
      window.sessionStorage.removeItem(DEV_TOKEN_STORAGE_KEY);
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(credential.user, { displayName: cleanedName });
      await sendEmailVerification(credential.user).catch(() => undefined);
      await credential.user.getIdToken(true);
      return await syncWithBackend(credential.user, cleanedName);
    } catch (err) {
      pendingRegistrationNameRef.current = undefined;
      throw new Error(formatFirebaseAuthError(err));
    }
  };

  const loginWithDevMode = async (payload: {
    full_name: string;
    email: string;
    role: UserRole;
  }): Promise<UserProfile> => {
    const resp = await apiClient.devLogin(payload);
    window.sessionStorage.setItem(DEV_TOKEN_STORAGE_KEY, resp.access_token);
    setProfile(resp.user);
    setAuthMode("dev");
    setBackendSyncError(null);
    return resp.user;
  };

  const setOrChangePassword = async (
    newPassword: string,
    currentPassword?: string
  ): Promise<void> => {
    const user = firebaseAuth?.currentUser;
    if (!user || !user.email) {
      throw new Error("You must be signed in with a Firebase account to configure a password.");
    }

    const passwordLinked = user.providerData.some((p) => p.providerId === "password");
    const googleLinked = user.providerData.some((p) => p.providerId === "google.com");

    try {
      if (!passwordLinked) {
        const credential = EmailAuthProvider.credential(user.email, newPassword);
        try {
          await linkWithCredential(user, credential);
        } catch (err) {
          const code = (err as { code?: string } | null)?.code;
          if (code === "auth/requires-recent-login" && googleLinked && googleProvider) {
            await reauthenticateWithPopup(user, googleProvider);
            await linkWithCredential(user, credential);
          } else {
            throw err;
          }
        }
      } else {
        if (!currentPassword) {
          throw new Error("Please enter your current password to set a new password.");
        }
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPassword);
      }

      await user.reload();
      await user.getIdToken(true);
      setProviderVersion((v) => v + 1);
      await refreshProfile();
    } catch (err) {
      throw new Error(formatFirebaseAuthError(err));
    }
  };

  const sendResetEmail = async (email: string): Promise<void> => {
    const { auth } = ensureAuthReady();
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err) {
      throw new Error(formatFirebaseAuthError(err));
    }
  };

  const resendVerificationEmail = async (): Promise<void> => {
    if (!firebaseAuth?.currentUser) {
      throw new Error("Email verification is only applicable to Firebase accounts.");
    }
    try {
      await sendEmailVerification(firebaseAuth.currentUser);
    } catch (err) {
      throw new Error(formatFirebaseAuthError(err));
    }
  };

  const updateDisplayName = async (fullName: string): Promise<UserProfile> => {
    const token = await getIdToken();
    if (!token) {
      throw new Error("You must be signed in to update your profile.");
    }
    const updated = await apiClient.updateMyProfile(token, fullName);
    if (firebaseAuth?.currentUser) {
      await updateProfile(firebaseAuth.currentUser, { displayName: updated.full_name }).catch(
        () => undefined
      );
    }
    setProfile(updated);
    return updated;
  };

  const refreshProfile = async (): Promise<void> => {
    if (firebaseAuth?.currentUser) {
      await firebaseAuth.currentUser.reload();
      const token = await firebaseAuth.currentUser.getIdToken(true);
      const updated = await apiClient.syncAuthSession(token);
      setProfile(updated.user);
      setBackendSyncError(null);
      return;
    }
    const devToken = window.sessionStorage.getItem(DEV_TOKEN_STORAGE_KEY);
    if (devToken) {
      const updated = await apiClient.getMyProfile(devToken);
      setProfile(updated);
      setBackendSyncError(null);
    }
  };

  const logout = async (revokeAllDevices = false): Promise<void> => {
    const token = await getIdToken().catch(() => null);
    if (token) {
      await apiClient.logoutSession(token, revokeAllDevices && authMode === "firebase").catch(() => undefined);
    }
    window.sessionStorage.removeItem(DEV_TOKEN_STORAGE_KEY);
    if (firebaseAuth?.currentUser) {
      await signOut(firebaseAuth);
    }
    setProfile(null);
    setAuthMode(null);
    setBackendSyncError(null);
  };

  const currentProviders = (providerVersion >= 0 ? firebaseUser?.providerData : undefined) ?? [];
  const hasPasswordProvider = currentProviders.some((p) => p.providerId === "password");
  const hasGoogleProvider = currentProviders.some((p) => p.providerId === "google.com");

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        authMode,
        loading,
        isConfigured: isFirebaseClientConfigured,
        isDevAuthAvailable,
        backendSyncError,
        hasPasswordProvider,
        hasGoogleProvider,
        getIdToken,
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        loginWithDevMode,
        setOrChangePassword,
        sendResetEmail,
        resendVerificationEmail,
        updateDisplayName,
        refreshProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
