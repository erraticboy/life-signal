import { motion } from "framer-motion";
import { CheckCircle2, Clock, FilePlus2, FileText, FolderOpen, MailWarning } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { AnimatedCounter } from "../../components/motion/AnimatedCounter";
import { FloatingElement } from "../../components/motion/FloatingElement";
import { ScrollReveal3D } from "../../components/motion/ScrollReveal3D";
import { Tilt3DCard } from "../../components/motion/Tilt3DCard";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { StatusAlert } from "../../components/ui/StatusAlert";
import { useAuth } from "../../contexts/AuthContext";
import { apiClient } from "../../lib/api";
import type { CitizenDashboardSummary } from "../../types/auth";

export function CitizenDashboardPage() {
  const { profile, getIdToken, resendVerificationEmail, refreshProfile } = useAuth();
  const [summary, setSummary] = useState<CitizenDashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verificationMsg, setVerificationMsg] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = await getIdToken();
        if (!token) return;
        const data = await apiClient.getCitizenDashboard(token);
        if (mounted) {
          setSummary(data);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load citizen dashboard.");
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [getIdToken]);

  const handleResendVerification = async () => {
    setVerificationMsg(null);
    try {
      await resendVerificationEmail();
      setVerificationMsg("Verification email sent. Check your inbox, then click Refresh Status.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send verification email.");
    }
  };

  const kpis = [
    {
      label: "Total Complaints",
      value: summary ? summary.total_complaints : "—",
      icon: FolderOpen,
      toneClass: "text-blue-600 dark:text-cyan-400",
    },
    {
      label: "Open Reports",
      value: summary ? summary.open_complaints : "—",
      icon: Clock,
      toneClass: "text-amber-500",
    },
    {
      label: "Resolved",
      value: summary ? summary.resolved_complaints : "—",
      icon: CheckCircle2,
      toneClass: "text-emerald-500",
    },
    {
      label: "PDF Receipts",
      value: summary ? summary.documents_generated : "—",
      icon: FileText,
      toneClass: "text-blue-600 dark:text-cyan-400",
    },
  ];

  return (
    <DashboardLayout mode="citizen">
      <div className="space-y-6">
        <FloatingElement amplitude={3} duration={6.5}>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
                Welcome, {profile?.full_name}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Verified Citizen Portal · PostgreSQL &amp; Firebase Auth Synchronized
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/citizen/complaints/new">
                <Button size="sm" className="shadow-md shadow-blue-600/20 transition-transform hover:-translate-y-0.5">
                  <FilePlus2 className="h-4 w-4" />
                  Register Complaint
                </Button>
              </Link>
              <Link to="/citizen/complaints">
                <Button variant="secondary" size="sm" className="transition-transform hover:-translate-y-0.5">
                  My Complaints
                </Button>
              </Link>
            </div>
          </div>
        </FloatingElement>

        {profile && !profile.email_verified && (
          <StatusAlert variant="warning" title="Email Verification Pending">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Verify your email address (<span className="font-mono text-xs">{profile.email}</span>) to
                ensure reliable receipt of official complaint PDF acknowledgments.
              </span>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="secondary" onClick={() => void handleResendVerification()}>
                  <MailWarning className="h-3.5 w-3.5" />
                  Resend Link
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void refreshProfile()}>
                  Refresh Status
                </Button>
              </div>
            </div>
          </StatusAlert>
        )}

        {verificationMsg && <StatusAlert variant="success">{verificationMsg}</StatusAlert>}
        {error && <StatusAlert variant="error">{error}</StatusAlert>}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((item, idx) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 14, rotateX: 8 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ delay: idx * 0.06, duration: 0.4 }}
              >
                <Tilt3DCard floating floatDelay={idx * 0.4} className="p-5">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>{item.label}</span>
                    <Icon className={`h-4 w-4 ${item.toneClass}`} />
                  </div>
                  <p className="mt-2 font-mono text-2xl font-bold text-slate-950 dark:text-white">
                    <AnimatedCounter value={item.value} />
                  </p>
                </Tilt3DCard>
              </motion.div>
            );
          })}
        </div>

        <ScrollReveal3D delay={0.12}>
          <Tilt3DCard intensity={4} className="p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">
                Verified Identity Record
              </h2>
              <Badge tone={profile?.email_verified ? "emerald" : "amber"}>
                {profile?.email_verified ? "Email Verified" : "Unverified Email"}
              </Badge>
            </div>

            <dl className="grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Registered Email</dt>
                <dd className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">{profile?.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Server-Verified Role</dt>
                <dd className="mt-0.5 font-mono text-xs font-semibold uppercase text-blue-600 dark:text-cyan-400">
                  {profile?.role}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Firebase UID</dt>
                <dd className="mt-0.5 font-mono text-xs text-slate-700 dark:text-slate-300 break-all">
                  {profile?.firebase_uid}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Database User ID</dt>
                <dd className="mt-0.5 font-mono text-xs text-slate-700 dark:text-slate-300 break-all">
                  {profile?.id}
                </dd>
              </div>
            </dl>

            {summary && <StatusAlert variant="info">{summary.phase_notice}</StatusAlert>}
          </Tilt3DCard>
        </ScrollReveal3D>
      </div>
    </DashboardLayout>
  );
}
