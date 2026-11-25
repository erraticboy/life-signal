import { motion } from "framer-motion";
import { AlertTriangle, ArrowLeft, Clock, Download, Mail, MapPin, RefreshCw, ScanEye } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { LocationPickerMap } from "../../components/maps/LocationPickerMap";
import { FloatingElement } from "../../components/motion/FloatingElement";
import { ScrollReveal3D } from "../../components/motion/ScrollReveal3D";
import { Tilt3DCard } from "../../components/motion/Tilt3DCard";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { StatusAlert } from "../../components/ui/StatusAlert";
import { useAuth } from "../../contexts/AuthContext";
import { apiClient } from "../../lib/api";
import {
  CATEGORY_LABEL_MAP,
  STATUS_TONE_MAP,
  type ComplaintDetail,
} from "../../types/complaint";

export function ComplaintDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { profile, getIdToken } = useAuth();
  const [detail, setDetail] = useState<ComplaintDetail | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let objectUrl: string | null = null;

    (async () => {
      if (!id) return;
      try {
        const token = await getIdToken();
        if (!token) return;
        const data = await apiClient.getComplaintDetails(token, id);
        if (!mounted) return;
        setDetail(data);
        setError(null);

        if (data.has_image) {
          objectUrl = await apiClient.fetchComplaintImageUrl(token, id);
          if (mounted) setImageUrl(objectUrl);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Could not load complaint details.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, getIdToken]);

  const handleDownloadPdf = async () => {
    if (!detail) return;
    setDownloading(true);
    try {
      const token = await getIdToken();
      if (!token) return;
      await apiClient.downloadComplaintPdf(token, detail.id, detail.complaint_number);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download PDF.");
    } finally {
      setDownloading(false);
    }
  };

  const handleResendEmail = async () => {
    if (!detail) return;
    setResending(true);
    try {
      const token = await getIdToken();
      if (!token) return;
      const doc = await apiClient.resendComplaintEmail(token, detail.id);
      setDetail((prev) => (prev ? { ...prev, document: doc } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send email.");
    } finally {
      setResending(false);
    }
  };

  const layoutMode = profile?.role === "admin" ? "admin" : "citizen";

  return (
    <DashboardLayout mode={layoutMode}>
      <div className="max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to={layoutMode === "admin" ? "/admin/complaints" : "/citizen/complaints"}
            className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Complaints
          </Link>

          {detail && (
            <Button onClick={() => void handleDownloadPdf()} disabled={downloading}>
              <Download className="h-4 w-4" />
              {downloading ? "Downloading..." : "Download PDF Acknowledgment"}
            </Button>
          )}
        </div>

        {error && <StatusAlert variant="error">{error}</StatusAlert>}

        {loading ? (
          <Card className="p-10 text-center text-sm text-slate-500">Loading complaint record...</Card>
        ) : detail ? (
          <>
            <ScrollReveal3D>
              <Tilt3DCard intensity={3.5} className="p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <FloatingElement amplitude={2} duration={6}>
                      <span className="inline-block font-mono text-xs font-bold text-blue-600 dark:text-cyan-400">
                        {detail.complaint_number}
                      </span>
                    </FloatingElement>
                    <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
                      {detail.title}
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Reported by {detail.reporter_name} ({detail.reporter_email}) ·{" "}
                      {new Date(detail.reported_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral">{CATEGORY_LABEL_MAP[detail.category]}</Badge>
                    <Badge tone={STATUS_TONE_MAP[detail.status]}>
                      {detail.status.replace("_", " ")}
                    </Badge>
                  </div>
                </div>

              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {detail.description}
              </p>

              <div className="grid gap-4 border-t border-slate-100 pt-4 text-xs sm:grid-cols-3 dark:border-slate-800">
                <div>
                  <span className="text-slate-500">Address</span>
                  <p className="mt-0.5 font-medium text-slate-900 dark:text-white">{detail.address}</p>
                </div>
                <div>
                  <span className="text-slate-500">GPS Coordinates</span>
                  <p className="mt-0.5 font-mono text-slate-800 dark:text-slate-200">
                    {detail.latitude.toFixed(6)}, {detail.longitude.toFixed(6)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Acknowledgment Email Status</span>
                  <div className="mt-0.5 flex items-center gap-2">
                    <Badge
                      tone={
                        detail.document?.email_delivery_status === "sent"
                          ? "emerald"
                          : detail.document?.email_delivery_status === "failed"
                            ? "rose"
                            : "amber"
                      }
                    >
                      {detail.document?.email_delivery_status ?? "pending"}
                    </Badge>
                    {detail.document?.email_delivery_status !== "sent" && (
                      <Button size="sm" variant="ghost" onClick={() => void handleResendEmail()} disabled={resending}>
                        <RefreshCw className="h-3 w-3" />
                        {resending ? "Sending" : "Send"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {detail.document?.email_error && (
                <StatusAlert variant="warning" title="Email Notification Notice">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 shrink-0" />
                    <span>{detail.document.email_error}</span>
                  </div>
                </StatusAlert>
              )}
              </Tilt3DCard>
            </ScrollReveal3D>

            <div className="grid gap-6 lg:grid-cols-2">
              <ScrollReveal3D direction="left" delay={0.06}>
                <Card className="p-6 space-y-3 h-full">
                  <h2 className="text-sm font-semibold text-slate-950 dark:text-white flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-blue-600 dark:text-cyan-400" />
                    Pinned Location
                  </h2>
                  <LocationPickerMap
                    latitude={detail.latitude}
                    longitude={detail.longitude}
                    interactive={false}
                    heightClass="h-64"
                  />
                </Card>
              </ScrollReveal3D>

              <ScrollReveal3D direction="right" delay={0.08}>
                <Tilt3DCard intensity={4} className="p-6 space-y-3 h-full">
                  <h2 className="text-sm font-semibold text-slate-950 dark:text-white">
                    Submitted Evidence Photograph
                  </h2>
                  {imageUrl ? (
                    <div className="relative h-64 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
                      <img
                        src={imageUrl}
                        alt={detail.title}
                        className="h-full w-full object-contain"
                      />
                      {detail.ai_analysis && (
                        <motion.div
                          aria-hidden="true"
                          initial={{ y: "-10%" }}
                          animate={{ y: ["-10%", "110%", "-10%"] }}
                          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
                          className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_14px_rgba(34,211,238,0.85)]"
                        />
                      )}
                      {detail.ai_analysis?.bounding_boxes?.map((box, idx) => (
                        <motion.div
                          key={`${box.label}-${idx}`}
                          initial={{ opacity: 0, scale: 0.92 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.15 + idx * 0.08, duration: 0.3 }}
                          style={{
                            left: `${box.x1 * 100}%`,
                            top: `${box.y1 * 100}%`,
                            width: `${Math.max((box.x2 - box.x1) * 100, 2)}%`,
                            height: `${Math.max((box.y2 - box.y1) * 100, 2)}%`,
                          }}
                          className="pointer-events-none absolute border-2 border-cyan-400 bg-cyan-400/10 shadow-[0_0_12px_rgba(34,211,238,0.3)]"
                        >
                          <span className="inline-block bg-slate-950/85 px-1.5 py-0.5 font-mono text-[10px] text-cyan-300">
                            {box.label} {(box.confidence * 100).toFixed(0)}%
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-500 dark:border-slate-800">
                      {detail.has_image ? "Loading image..." : "No photograph uploaded"}
                    </div>
                  )}
                </Tilt3DCard>
              </ScrollReveal3D>
            </div>

            <ScrollReveal3D delay={0.1}>
              <Tilt3DCard intensity={3.5} className="p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-950 dark:text-white flex items-center gap-2">
                  <ScanEye className="h-4 w-4 text-blue-600 dark:text-cyan-400" />
                  AI Computer Vision &amp; Uncertainty Assessment
                </h2>
                {detail.ai_analysis && (
                  <div className="flex flex-wrap items-center gap-2">
                    {detail.ai_analysis.is_demo_mode && (
                      <Badge tone="amber">
                        <AlertTriangle className="h-3 w-3" />
                        Demo Fallback Mode
                      </Badge>
                    )}
                    <Badge tone={detail.ai_analysis.requires_human_verification ? "rose" : "emerald"}>
                      {detail.ai_analysis.requires_human_verification
                        ? "Requires Human Verification"
                        : "Human Verified"}
                    </Badge>
                  </div>
                )}
              </div>

              {!detail.ai_analysis ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No AI vision analysis has been recorded yet (or trained YOLO weights are not configured on the server).
                </p>
              ) : (
                <div className="space-y-3">
                  {detail.ai_analysis.is_demo_mode && (
                    <StatusAlert variant="warning" title="Demo Mode Prediction (Not Trained YOLO Inference)">
                      This prediction was generated by the OpenCV structural heuristic fallback because trained YOLO
                      weights are not yet loaded. Treat as preliminary until verified by an administrator.
                    </StatusAlert>
                  )}

                  <dl className="grid gap-4 text-xs sm:grid-cols-5">
                    <div>
                      <dt className="text-slate-500">Predicted Category</dt>
                      <dd className="mt-0.5 font-semibold text-slate-900 dark:text-white">
                        {detail.ai_analysis.predicted_category}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Raw Confidence</dt>
                      <dd className="mt-0.5 font-mono text-slate-900 dark:text-white">
                        {(detail.ai_analysis.confidence * 100).toFixed(1)}%
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Calibrated Confidence</dt>
                      <dd className="mt-0.5 font-mono text-slate-900 dark:text-white">
                        {detail.ai_analysis.calibrated_confidence !== null
                          ? `${(detail.ai_analysis.calibrated_confidence * 100).toFixed(1)}%`
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Uncertainty Score</dt>
                      <dd className="mt-0.5 font-mono text-slate-900 dark:text-white">
                        {(detail.ai_analysis.uncertainty_score * 100).toFixed(1)}%
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Model &amp; Runtime</dt>
                      <dd className="mt-0.5 font-mono text-slate-600 dark:text-slate-300">
                        {detail.ai_analysis.model_version} ({detail.ai_analysis.processing_time.toFixed(2)}s)
                      </dd>
                    </div>
                  </dl>
                </div>
              )}
              </Tilt3DCard>
            </ScrollReveal3D>

            <ScrollReveal3D delay={0.14}>
              <Tilt3DCard intensity={3.5} className="p-6 space-y-4">
                <h2 className="text-sm font-semibold text-slate-950 dark:text-white flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600 dark:text-cyan-400" />
                  Status Timeline
                </h2>
                <div className="space-y-3">
                  {detail.history.map((h, idx) => (
                    <motion.div
                      key={h.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/70 px-4 py-3 text-xs dark:border-slate-800 dark:bg-slate-950/50"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge tone={STATUS_TONE_MAP[h.new_status]}>
                            {h.new_status.replace("_", " ")}
                          </Badge>
                          {h.previous_status && (
                            <span className="text-slate-400">from {h.previous_status.replace("_", " ")}</span>
                          )}
                        </div>
                        {h.notes && <p className="text-slate-600 dark:text-slate-300">{h.notes}</p>}
                      </div>
                      <span className="font-mono text-slate-400">
                        {new Date(h.created_at).toLocaleString()}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </Tilt3DCard>
            </ScrollReveal3D>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}

