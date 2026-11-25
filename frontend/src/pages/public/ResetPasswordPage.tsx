import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { AnimatePresence, motion } from "framer-motion";
import { KeyRound } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FirebaseConfigNotice } from "../../components/auth/FirebaseConfigNotice";
import { Navbar } from "../../components/layout/Navbar";
import { CyberBackdrop } from "../../components/motion/CyberBackdrop";
import { FloatingElement } from "../../components/motion/FloatingElement";
import { ScrollTelemetryBar } from "../../components/motion/ScrollTelemetryBar";
import { Tilt3DCard } from "../../components/motion/Tilt3DCard";
import { Button } from "../../components/ui/Button";
import { StatusAlert } from "../../components/ui/StatusAlert";
import { useAuth } from "../../contexts/AuthContext";
import { firebaseAuth, formatFirebaseAuthError, isFirebaseClientConfigured } from "../../lib/firebase";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const oobCode = searchParams.get("oobCode")?.trim() ?? "";
  const { sendResetEmail } = useAuth();

  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [requestEmail, setRequestEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [loading, setLoading] = useState(Boolean(oobCode));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!oobCode || !isFirebaseClientConfigured || !firebaseAuth) {
      setLoading(false);
      return;
    }

    verifyPasswordResetCode(firebaseAuth, oobCode)
      .then((email) => {
        setVerifiedEmail(email);
        setError(null);
      })
      .catch((err) => {
        setError(formatFirebaseAuthError(err));
      })
      .finally(() => setLoading(false));
  }, [oobCode]);

  const handleConfirmReset = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!firebaseAuth || !oobCode) return;
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPass) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await confirmPasswordReset(firebaseAuth, oobCode, newPassword);
      setSuccess("Your password has been updated. You can now sign in with your new password.");
    } catch (err) {
      setError(formatFirebaseAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestReset = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await sendResetEmail(requestEmail);
      setSuccess("Password reset link dispatched if an account exists for that email.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send reset email.");
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
                <KeyRound className="h-3.5 w-3.5" />
                <span>CREDENTIAL RECOVERY</span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-950 dark:text-white">
                Reset Password
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {verifiedEmail
                  ? `Choose a new password for ${verifiedEmail}`
                  : "Request or complete a Firebase password reset."}
              </p>
            </div>
          </FloatingElement>

          <FirebaseConfigNotice />

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
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
              >
                <StatusAlert variant="success">{success}</StatusAlert>
              </motion.div>
            )}
          </AnimatePresence>

          <Tilt3DCard intensity={4} className="p-6">
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.p
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-sm text-slate-500 text-center"
                >
                  Validating reset code...
                </motion.p>
              ) : oobCode && verifiedEmail && !success ? (
                <motion.form
                  key="confirm-reset"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onSubmit={(e) => void handleConfirmReset(e)}
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      New password
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white/90 px-3 text-sm transition-all focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:border-slate-700 dark:bg-slate-950/80 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Confirm new password
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={confirmPass}
                      onChange={(e) => setConfirmPass(e.target.value)}
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white/90 px-3 text-sm transition-all focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:border-slate-700 dark:bg-slate-950/80 dark:text-white"
                    />
                  </div>
                  <Button type="submit" className="w-full shadow-lg shadow-blue-600/20" disabled={submitting}>
                    {submitting ? "Updating..." : "Set New Password"}
                  </Button>
                </motion.form>
              ) : !success ? (
                <motion.form
                  key="request-reset"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onSubmit={(e) => void handleRequestReset(e)}
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Registered email address
                    </label>
                    <input
                      type="email"
                      required
                      value={requestEmail}
                      onChange={(e) => setRequestEmail(e.target.value)}
                      disabled={!isFirebaseClientConfigured}
                      placeholder="citizen@example.com"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white/90 px-3 text-sm transition-all focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:border-slate-700 dark:bg-slate-950/80 dark:text-white"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full shadow-lg shadow-blue-600/20"
                    disabled={!isFirebaseClientConfigured || submitting}
                  >
                    {submitting ? "Sending..." : "Send Reset Link"}
                  </Button>
                </motion.form>
              ) : (
                <motion.div
                  key="reset-done"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <Link to="/login">
                    <Button className="w-full shadow-lg shadow-blue-600/20">Return to Sign In</Button>
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </Tilt3DCard>
        </motion.div>
      </main>
    </div>
  );
}

