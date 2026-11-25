import { motion } from "framer-motion";
import { KeyRound, Mail, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { FloatingElement } from "../../components/motion/FloatingElement";
import { ScrollReveal3D } from "../../components/motion/ScrollReveal3D";
import { Tilt3DCard } from "../../components/motion/Tilt3DCard";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { StatusAlert } from "../../components/ui/StatusAlert";
import { useAuth } from "../../contexts/AuthContext";

export function CitizenSettingsPage() {
  const {
    profile,
    authMode,
    hasPasswordProvider,
    hasGoogleProvider,
    updateDisplayName,
    setOrChangePassword,
    sendResetEmail,
    logout,
  } = useAuth();

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [resetSending, setResetSending] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavedMsg(null);
    setSaving(true);
    try {
      await updateDisplayName(fullName);
      setSavedMsg("Profile display name updated in PostgreSQL and Firebase.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavedMsg(null);

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setPasswordSaving(true);
    try {
      await setOrChangePassword(newPassword, hasPasswordProvider ? currentPassword : undefined);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSavedMsg(
        hasPasswordProvider
          ? "Your Firebase login password has been updated."
          : "Email & Password login is now linked to your Firebase account. You can now sign in with email + password or Google."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save password.");
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (!profile?.email) return;
    setError(null);
    setSavedMsg(null);
    setResetSending(true);
    try {
      await sendResetEmail(profile.email);
      setSavedMsg(`Firebase password setup/reset link dispatched to ${profile.email}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to dispatch reset email.");
    } finally {
      setResetSending(false);
    }
  };

  const layoutMode = profile?.role === "admin" ? "admin" : "citizen";

  return (
    <DashboardLayout mode={layoutMode}>
      <div className="max-w-2xl space-y-6">
        <FloatingElement amplitude={3} duration={6.5}>
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
              Profile &amp; Account Security
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Manage your display name, Firebase login password, and active sessions.
            </p>
          </div>
        </FloatingElement>

        {error && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
            <StatusAlert variant="error">{error}</StatusAlert>
          </motion.div>
        )}
        {savedMsg && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
            <StatusAlert variant="success">{savedMsg}</StatusAlert>
          </motion.div>
        )}

        <ScrollReveal3D>
          <Tilt3DCard intensity={3.5} className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">Profile Details</h2>
              <Badge tone={profile?.role === "admin" ? "cyan" : "blue"}>{profile?.role}</Badge>
            </div>

            <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="profile-name" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Full name
                </label>
                <input
                  id="profile-name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={160}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white/90 px-3 text-sm dark:border-slate-700 dark:bg-slate-950/80 dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Registered email (managed via Firebase)
                </label>
                <input
                  type="email"
                  disabled
                  value={profile?.email ?? ""}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-100/90 px-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400"
                />
              </div>

              <Button type="submit" disabled={saving} className="shadow-md shadow-blue-600/20">
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </Tilt3DCard>
        </ScrollReveal3D>

        {authMode === "firebase" && (
          <ScrollReveal3D delay={0.06}>
            <Tilt3DCard intensity={3.5} className="p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-950 dark:text-white flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-blue-600 dark:text-cyan-400" />
                  {hasPasswordProvider ? "Change Login Password" : "Set Email & Password Login"}
                </h2>
                <div className="flex items-center gap-1.5">
                  {hasGoogleProvider && <Badge tone="blue">Google Linked</Badge>}
                  <Badge tone={hasPasswordProvider ? "emerald" : "amber"}>
                    {hasPasswordProvider ? "Password Enabled" : "No Password Linked Yet"}
                  </Badge>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {hasPasswordProvider
                  ? "Update your Firebase Email/Password sign-in credentials."
                  : "You currently sign in via Google. Set a password below to also sign in directly using your email and password."}
              </p>

              <form onSubmit={(e) => void handlePasswordSubmit(e)} className="space-y-3">
                {hasPasswordProvider && (
                  <div className="space-y-1.5">
                    <label htmlFor="cur-pass" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Current password
                    </label>
                    <input
                      id="cur-pass"
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white/90 px-3 text-sm dark:border-slate-700 dark:bg-slate-950/80 dark:text-white"
                    />
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="new-pass" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      {hasPasswordProvider ? "New password" : "Password (min. 6 characters)"}
                    </label>
                    <input
                      id="new-pass"
                      type="password"
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white/90 px-3 text-sm dark:border-slate-700 dark:bg-slate-950/80 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="conf-pass" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Confirm password
                    </label>
                    <input
                      id="conf-pass"
                      type="password"
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white/90 px-3 text-sm dark:border-slate-700 dark:bg-slate-950/80 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Button type="submit" disabled={passwordSaving} className="shadow-md shadow-blue-600/20">
                    <ShieldCheck className="h-4 w-4" />
                    {passwordSaving
                      ? "Updating Firebase..."
                      : hasPasswordProvider
                        ? "Update Password"
                        : "Set Login Password"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={resetSending}
                    onClick={() => void handleSendResetEmail()}
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {resetSending ? "Sending..." : "Send Reset Link via Email"}
                  </Button>
                </div>
              </form>
            </Tilt3DCard>
          </ScrollReveal3D>
        )}

        <ScrollReveal3D delay={0.1}>
          <Tilt3DCard intensity={5} glowColor="rgba(244, 63, 94, 0.16)" className="p-6 space-y-3">
            <h2 className="text-base font-semibold text-slate-950 dark:text-white">Session Control</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Revoke Firebase refresh tokens across all signed-in devices if you suspect unauthorized access.
            </p>
            <Button variant="danger" size="sm" onClick={() => void logout(true)}>
              Sign Out &amp; Revoke All Devices
            </Button>
          </Tilt3DCard>
        </ScrollReveal3D>
      </div>
    </DashboardLayout>
  );
}

