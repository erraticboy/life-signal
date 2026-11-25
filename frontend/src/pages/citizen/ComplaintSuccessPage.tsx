import { motion } from "framer-motion";
import { CheckCircle2, Download, ExternalLink, Mail, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { FloatingElement } from "../../components/motion/FloatingElement";
import { ScrollReveal3D } from "../../components/motion/ScrollReveal3D";
import { Tilt3DCard } from "../../components/motion/Tilt3DCard";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { StatusAlert } from "../../components/ui/StatusAlert";
import { useAuth } from "../../contexts/AuthContext";
import { apiClient } from "../../lib/api";
import { CATEGORY_LABEL_MAP, type ComplaintItem } from "../../types/complaint";

export function ComplaintSuccessPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { getIdToken } = useAuth();

  const initial = (location.state as { complaint?: ComplaintItem } | null)?.complaint ?? null;
  const [complaint, setComplaint] = useState<ComplaintItem | null>(initial);
  const [downloading, setDownloading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || complaint) return;
    (async () => {
      try {
        const token = await getIdToken();
        if (!token) return;
        const data = await apiClient.getComplaintDetails(token, id);
        setComplaint(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load complaint receipt.");
      }
    })();
  }, [id, complaint, getIdToken]);

  const handleDownloadPdf = async () => {
    if (!complaint) return;
    setError(null);
    setDownloading(true);
    try {
      const token = await getIdToken();
      if (!token) return;
      await apiClient.downloadComplaintPdf(token, complaint.id, complaint.complaint_number);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download PDF receipt.");
    } finally {
      setDownloading(false);
    }
  };

  const handleResendEmail = async () => {
    if (!complaint) return;
    setError(null);
    setResending(true);
    try {
      const token = await getIdToken();
      if (!token) return;
      const updatedDoc = await apiClient.resendComplaintEmail(token, complaint.id);
      setComplaint((prev) => (prev ? { ...prev, document: updatedDoc } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to retry email delivery.");
    } finally {
      setResending(false);
    }
  };

  const emailStatus = complaint?.document?.email_delivery_status;

  return (
    <DashboardLayout mode="citizen">
      <div className="max-w-3xl space-y-6">
        {error && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
            <StatusAlert variant="error">{error}</StatusAlert>
          </motion.div>
        )}

        <ScrollReveal3D>
          <Tilt3DCard intensity={4} className="p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6 dark:border-slate-800">
              <div className="flex items-start gap-3.5">
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-400">
                  <span className="animate-pulse-ring absolute inset-0 rounded-full border-2 border-emerald-400/50" />
                  <motion.div
                    initial={{ scale: 0.4, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 16 }}
                  >
                    <CheckCircle2 className="h-6 w-6" />
                  </motion.div>
                </div>
                <div>
                  <h1 className="font-display text-xl font-bold text-slate-950 dark:text-white">
                    Complaint Successfully Registered
                  </h1>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Saved in PostgreSQL + PostGIS with official ReportLab PDF acknowledgment generated.
                  </p>
                </div>
              </div>
              {complaint && (
                <FloatingElement amplitude={3} duration={5}>
                  <div className="rounded-xl border border-blue-200/80 bg-blue-50/70 px-3.5 py-2 text-left sm:text-right dark:border-cyan-500/30 dark:bg-cyan-500/10">
                    <p className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Reference Number
                    </p>
                    <p className="font-mono text-lg font-bold text-blue-600 dark:text-cyan-400">
                      {complaint.complaint_number}
                    </p>
                  </div>
                </FloatingElement>
              )}
            </div>

          {complaint && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="lg" onClick={() => void handleDownloadPdf()} disabled={downloading}>
                  <Download className="h-4 w-4" />
                  {downloading ? "Preparing PDF..." : "Download Official PDF Receipt"}
                </Button>
                <Link to={`/citizen/complaints/${complaint.id}`}>
                  <Button variant="secondary" size="lg">
                    <ExternalLink className="h-4 w-4" />
                    View Complaint Details
                  </Button>
                </Link>
              </div>

              {/* Honest Email Delivery Feedback */}
              {emailStatus === "sent" && (
                <StatusAlert variant="success" title="Confirmation Email Delivered">
                  Official acknowledgment PDF was attached and sent to{" "}
                  <span className="font-mono text-xs font-semibold">
                    {complaint.document?.email_recipient}
                  </span>
                  .
                </StatusAlert>
              )}

              {emailStatus === "not_configured" && (
                <StatusAlert variant="warning" title="Email Delivery Not Configured Yet">
                  <div className="space-y-2">
                    <p>
                      Your complaint and official PDF receipt are safely stored and ready to download above.
                      SMTP email credentials are not configured in <code className="font-mono">backend/.env</code>{" "}
                      yet, so no email was sent to{" "}
                      <span className="font-mono text-xs">{complaint.document?.email_recipient}</span>.
                    </p>
                    <Button size="sm" variant="secondary" onClick={() => void handleResendEmail()} disabled={resending}>
                      <RefreshCw className="h-3.5 w-3.5" />
                      {resending ? "Sending..." : "Send Email Now"}
                    </Button>
                  </div>
                </StatusAlert>
              )}

              {emailStatus === "failed" && (
                <StatusAlert variant="error" title="Email Delivery Failed (Complaint & PDF Saved)">
                  <div className="space-y-2">
                    <p>{complaint.document?.email_error || "SMTP server rejected or failed delivery."}</p>
                    <Button size="sm" variant="secondary" onClick={() => void handleResendEmail()} disabled={resending}>
                      <Mail className="h-3.5 w-3.5" />
                      {resending ? "Retrying..." : "Retry Email Delivery"}
                    </Button>
                  </div>
                </StatusAlert>
              )}

              <dl className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-950/50">
                <div>
                  <dt className="text-xs text-slate-500">Title</dt>
                  <dd className="font-medium text-slate-900 dark:text-white">{complaint.title}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Category</dt>
                  <dd className="font-medium text-slate-900 dark:text-white">
                    {CATEGORY_LABEL_MAP[complaint.category]}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Location</dt>
                  <dd className="text-slate-700 dark:text-slate-300">{complaint.address}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Status</dt>
                  <dd>
                    <Badge tone="blue">{complaint.status}</Badge>
                  </dd>
                </div>
              </dl>
            </>
          )}

          <div className="flex justify-between pt-2 text-sm">
            <Link to="/citizen/complaints" className="text-blue-600 hover:underline dark:text-cyan-400">
              ← Go to My Complaints
            </Link>
            <Link to="/citizen/complaints/new" className="text-slate-600 hover:underline dark:text-slate-400">
              Register another complaint →
            </Link>
          </div>
          </Tilt3DCard>
        </ScrollReveal3D>
      </div>
    </DashboardLayout>
  );
}

