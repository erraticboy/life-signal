import { AnimatePresence, motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
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

export function LoginPage() {
  const {
    profile,
    isConfigured,
    loginWithGoogle,
    loginWithEmail,
    sendResetEmail,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Forward Firebase password-reset links if Firebase action URL lands on /login
  useEffect(() => {
    const mode = searchParams.get("mode");
    const oobCode = searchParams.get("oobCode");
    if (mode === "resetPassword" && oobCode) {
      navigate(`/reset-password?oobCode=${encodeURIComponent(oobCode)}`, { replace: true });
    }
  }, [navigate, searchParams]);

  useEffect(() => {
    if (profile) {
      const from = (location.state as { from?: string } | null)?.from;
      if (from) {
        navigate(from, { replace: true });
      } else {
        navigate(profile.role === "admin" ? "/admin/dashboard" : "/citizen/dashboard", {
          replace: true,
        });
      }
    }
  }, [profile, navigate, location.state]);

  const handleGoogleLogin = async () => {
    setError(null);
    setSuccessMsg(null);
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

  const handleEmailLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      const user = await loginWithEmail(email, password);
      navigate(user.role === "admin" ? "/admin/dashboard" : "/citizen/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      await sendResetEmail(resetEmail || email);
      setSuccessMsg(
        "Password reset instructions have been sent if an account exists for that email address."
      );
      setShowForgot(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send password reset email.");
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
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>IDENTITY VERIFICATION GATEWAY</span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-950 dark:text-white">
                Sign in to LIFE SIGNAL
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Use your Google account or verified email credentials.
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
            {successMsg && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
              >
                <StatusAlert variant="success">{successMsg}</StatusAlert>
              </motion.div>
            )}
          </AnimatePresence>

          <Tilt3DCard intensity={4} className="p-6 space-y-5">
            <GoogleSignInButton
              onClick={() => void handleGoogleLogin()}
              disabled={!isConfigured || submitting}
              loading={googleLoading}
            />

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="rounded-full bg-white/90 px-2.5 text-slate-400 dark:bg-slate-900/90">
                  Or with email
                </span>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {!showForgot ? (
                <motion.form
                  key="email-login"
                  initial={{ opacity: 0, rotateY: -8, x: -12 }}
                  animate={{ opacity: 1, rotateY: 0, x: 0 }}
                  exit={{ opacity: 0, rotateY: 8, x: 12 }}
                  transition={{ duration: 0.25 }}
                  onSubmit={(e) => void handleEmailLogin(e)}
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <label htmlFor="login-email" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Email address
                    </label>
                    <input
                      id="login-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={!isConfigured}
                      placeholder="citizen@example.com"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white/90 px-3 text-sm text-slate-900 transition-all focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950/80 dark:text-white dark:focus:border-cyan-400 dark:focus:ring-cyan-500/20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="login-password"
                        className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                      >
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setResetEmail(email);
                          setShowForgot(true);
                          setError(null);
                        }}
                        className="text-xs font-medium text-blue-600 hover:underline dark:text-cyan-400 cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <input
                      id="login-password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={!isConfigured}
                      placeholder="••••••••"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white/90 px-3 text-sm text-slate-900 transition-all focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950/80 dark:text-white dark:focus:border-cyan-400 dark:focus:ring-cyan-500/20"
                    />
                  </div>

                  <Button type="submit" className="w-full shadow-lg shadow-blue-600/20" disabled={!isConfigured || submitting || googleLoading}>
                    {submitting ? "Signing in..." : "Sign In"}
                  </Button>
                </motion.form>
              ) : (
                <motion.form
                  key="forgot-password"
                  initial={{ opacity: 0, rotateY: 8, x: 12 }}
                  animate={{ opacity: 1, rotateY: 0, x: 0 }}
                  exit={{ opacity: 0, rotateY: -8, x: -12 }}
                  transition={{ duration: 0.25 }}
                  onSubmit={(e) => void handleForgotPassword(e)}
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <label htmlFor="reset-email" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Account email for password reset
                    </label>
                    <input
                      id="reset-email"
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      disabled={!isConfigured}
                      placeholder="you@example.com"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white/90 px-3 text-sm text-slate-900 transition-all focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:border-slate-700 dark:bg-slate-950/80 dark:text-white dark:focus:border-cyan-400 dark:focus:ring-cyan-500/20"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1 shadow-lg shadow-blue-600/20" disabled={!isConfigured || submitting}>
                      {submitting ? "Sending..." : "Send Reset Link"}
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => setShowForgot(false)}>
                      Cancel
                    </Button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </Tilt3DCard>

          <p className="text-center text-sm text-slate-600 dark:text-slate-400">
            New to LIFE SIGNAL?{" "}
            <Link to="/register" className="font-medium text-blue-600 hover:underline dark:text-cyan-400">
              Create an account
            </Link>
          </p>
        </motion.div>
      </main>
    </div>
  );
}

