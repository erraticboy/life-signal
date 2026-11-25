import { AnimatePresence, motion } from "framer-motion";
import { UserPlus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DevModeSignInCard } from "../../components/auth/DevModeSignInCard";
import { FirebaseConfigNotice } from "../../components/auth/FirebaseConfigNotice";
import { GoogleSignInButton } from "../../components/auth/GoogleSignInButton";
import { Navbar } from "../../components/layout/Navbar";
import { CyberBackdrop } from "../../components/motion/CyberBackdrop";
import { FloatingElement } from "../../components/motion/FloatingElement";
import { ScrollTelemetryBar } from "../../components/motion/ScrollTelemetryBar";
import { Tilt3DCard } from "../../components/motion/Tilt3DCard";
import { Button } from "../../components/ui/Button";
import { StatusAlert } from "../../components/ui/StatusAlert";
import { useAuth } from "../../contexts/AuthContext";

export function RegisterPage() {
  const { profile, isConfigured, loginWithGoogle, registerWithEmail } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      navigate(profile.role === "admin" ? "/admin/dashboard" : "/citizen/dashboard", { replace: true });
    }
  }, [profile, navigate]);

  const handleGoogleSignUp = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const user = await loginWithGoogle();
      navigate(user.role === "admin" ? "/admin/dashboard" : "/citizen/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google Sign-In failed.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (fullName.trim().length < 2) {
      setError("Please enter your full name (at least 2 characters).");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const user = await registerWithEmail(fullName, email, password);
      navigate(user.role === "admin" ? "/admin/dashboard" : "/citizen/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#040812]">
      <ScrollTelemetryBar />
      <Navbar />
      <main className="relative flex-1 flex items-center justify-center overflow-hidden px-4 py-12">
        <CyberBackdrop />
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 w-full max-w-md space-y-5 perspective-1400"
        >
          <FloatingElement amplitude={4} duration={6}>
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/80 glass-panel px-3 py-1 text-[11px] font-mono font-semibold text-blue-700 dark:border-cyan-500/30 dark:text-cyan-300">
                <UserPlus className="h-3.5 w-3.5" />
                <span>CITIZEN ONBOARDING</span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-950 dark:text-white">
                Create your LIFE SIGNAL account
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Report urban infrastructure issues and receive official PDF acknowledgments.
              </p>
            </div>
          </FloatingElement>

          <FirebaseConfigNotice />
          <DevModeSignInCard />

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
              >
                <StatusAlert variant="error">{error}</StatusAlert>
              </motion.div>
            )}
          </AnimatePresence>

          <Tilt3DCard intensity={4} className="p-6 space-y-5">
            <GoogleSignInButton
              onClick={() => void handleGoogleSignUp()}
              disabled={!isConfigured || submitting}
              loading={googleLoading}
              label="Continue with Google"
            />

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="rounded-full bg-white/90 px-2.5 text-slate-400 dark:bg-slate-900/90">
                  Or register with email
                </span>
              </div>
            </div>

            <form onSubmit={(e) => void handleRegister(e)} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="reg-name" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Full name
                </label>
                <input
                  id="reg-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={!isConfigured}
                  placeholder="Aarav Sharma"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white/90 px-3 text-sm text-slate-900 transition-all focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950/80 dark:text-white dark:focus:border-cyan-400 dark:focus:ring-cyan-500/20"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="reg-email" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Email address
                </label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!isConfigured}
                  placeholder="citizen@example.com"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white/90 px-3 text-sm text-slate-900 transition-all focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950/80 dark:text-white dark:focus:border-cyan-400 dark:focus:ring-cyan-500/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="reg-password"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Password
                  </label>
                  <input
                    id="reg-password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={!isConfigured}
                    placeholder="Min. 6 chars"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white/90 px-3 text-sm text-slate-900 transition-all focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950/80 dark:text-white dark:focus:border-cyan-400 dark:focus:ring-cyan-500/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="reg-confirm"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Confirm password
                  </label>
                  <input
                    id="reg-confirm"
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={!isConfigured}
                    placeholder="Repeat password"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white/90 px-3 text-sm text-slate-900 transition-all focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950/80 dark:text-white dark:focus:border-cyan-400 dark:focus:ring-cyan-500/20"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full shadow-lg shadow-blue-600/20" disabled={!isConfigured || submitting || googleLoading}>
                {submitting ? "Creating account..." : "Create Citizen Account"}
              </Button>
            </form>
          </Tilt3DCard>

          <p className="text-center text-sm text-slate-600 dark:text-slate-400">
            Already registered?{" "}
            <Link to="/login" className="font-medium text-blue-600 hover:underline dark:text-cyan-400">
              Sign in
            </Link>
          </p>
        </motion.div>
      </main>
    </div>
  );
}

