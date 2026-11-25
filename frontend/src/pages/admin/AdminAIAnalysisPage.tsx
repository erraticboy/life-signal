import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Cpu, Play, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { AnimatedCounter } from "../../components/motion/AnimatedCounter";
import { FloatingElement } from "../../components/motion/FloatingElement";
import { ScrollReveal3D } from "../../components/motion/ScrollReveal3D";
import { Tilt3DCard } from "../../components/motion/Tilt3DCard";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { StatusAlert } from "../../components/ui/StatusAlert";
import { useAuth } from "../../contexts/AuthContext";
import { apiClient } from "../../lib/api";
import type { AdminAIAnalysisItem, CalibrationSummary } from "../../types/complaint";

const VERIFIED_LABELS = [
  "Pothole",
  "Longitudinal crack",
  "Transverse crack",
  "Alligator crack",
  "Other road damage",
];

export function AdminAIAnalysisPage() {
  const { getIdToken } = useAuth();
  const [analyses, setAnalyses] = useState<AdminAIAnalysisItem[]>([]);
  const [calibration, setCalibration] = useState<CalibrationSummary | null>(null);
  const [onlyNeedsReview, setOnlyNeedsReview] = useState<boolean>(false);
  const [selectedLabels, setSelectedLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [runningBatch, setRunningBatch] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getIdToken();
      if (!token) return;
      const [rows, cal] = await Promise.all([
        apiClient.listAdminAIAnalyses(token, onlyNeedsReview ? true : undefined),
        apiClient.getCalibrationSummary(token),
      ]);
      setAnalyses(rows);
      setCalibration(cal);
      const initialMap: Record<string, string> = {};
      rows.forEach((r) => {
        initialMap[r.id] = r.predicted_category;
      });
      setSelectedLabels(initialMap);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load AI analyses.");
    } finally {
      setLoading(false);
    }
  }, [getIdToken, onlyNeedsReview]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleAnalyzePending = async () => {
    setRunningBatch(true);
    setNotice(null);
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) return;
      const res = await apiClient.analyzePendingWithAI(token);
      if (res.skipped_model_unavailable > 0 && res.processed_count === 0) {
        setError(
          `Skipped ${res.skipped_model_unavailable} complaint(s): trained YOLO model weights are not configured and ENABLE_AI_DEMO_FALLBACK is false.`
        );
      } else {
        setNotice(`Processed ${res.processed_count} pending complaint image(s).`);
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run batch analysis.");
    } finally {
      setRunningBatch(false);
    }
  };

  const handleVerify = async (row: AdminAIAnalysisItem) => {
    setVerifyingId(row.id);
    setError(null);
    setNotice(null);
    try {
      const token = await getIdToken();
      if (!token) return;
      const chosen = selectedLabels[row.id] || row.predicted_category;
      const updated = await apiClient.verifyAIPrediction(token, row.id, {
        verified_category: chosen,
      });
      setAnalyses((prev) => prev.map((a) => (a.id === row.id ? updated : a)));
      setNotice(`Verified ${row.complaint_number} as "${updated.predicted_category}".`);
      const cal = await apiClient.getCalibrationSummary(token);
      setCalibration(cal);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setVerifyingId(null);
    }
  };

  return (
    <DashboardLayout mode="admin">
      <div className="space-y-6">
        <FloatingElement amplitude={3} duration={6.5}>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
                AI Computer Vision &amp; Uncertainty Review
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Separates raw model confidence from calibrated confidence and routes uncertain or demo outputs to human review.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={onlyNeedsReview ? "primary" : "secondary"}
                onClick={() => setOnlyNeedsReview((v) => !v)}
              >
                {onlyNeedsReview ? "Showing Needs Verification" : "Filter: Needs Verification"}
              </Button>
              <Button size="sm" onClick={() => void handleAnalyzePending()} disabled={runningBatch} className="shadow-md shadow-blue-600/20">
                <Play className="h-3.5 w-3.5" />
                {runningBatch ? "Analyzing..." : "Analyze Pending Images"}
              </Button>
            </div>
          </div>
        </FloatingElement>

        {error && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
            <StatusAlert variant="error">{error}</StatusAlert>
          </motion.div>
        )}
        {notice && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
            <StatusAlert variant="success">{notice}</StatusAlert>
          </motion.div>
        )}

        {/* Calibration Summary Card */}
        <ScrollReveal3D>
          <Card className="p-6 space-y-3 glass-panel">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-blue-600 dark:text-cyan-400" />
                <h2 className="text-base font-semibold text-slate-950 dark:text-white">
                  Empirical Calibration Metrics (Expected Calibration Error)
                </h2>
              </div>
              <Badge tone={calibration?.available ? "emerald" : "neutral"}>
                <AnimatedCounter value={calibration?.sample_count ?? 0} /> Verified Samples
              </Badge>
            </div>

            {calibration?.available ? (
              <div className="grid gap-4 sm:grid-cols-3 pt-1">
                <Tilt3DCard floating floatDelay={0} className="p-4">
                  <span className="text-xs text-slate-500">Expected Calibration Error (ECE)</span>
                  <p className="mt-1 font-mono text-xl font-bold text-slate-950 dark:text-white">
                    {calibration.ece?.toFixed(4)}
                  </p>
                </Tilt3DCard>
                <Tilt3DCard floating floatDelay={0.4} className="p-4">
                  <span className="text-xs text-slate-500">Max Calibration Error (MCE)</span>
                  <p className="mt-1 font-mono text-xl font-bold text-slate-950 dark:text-white">
                    {calibration.mce?.toFixed(4)}
                  </p>
                </Tilt3DCard>
                <Tilt3DCard floating floatDelay={0.8} className="p-4">
                  <span className="text-xs text-slate-500">Brier Score</span>
                  <p className="mt-1 font-mono text-xl font-bold text-slate-950 dark:text-white">
                    {calibration.brier_score?.toFixed(4)}
                  </p>
                </Tilt3DCard>
              </div>
            ) : (
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {calibration?.detail || "Loading calibration state..."}
              </p>
            )}
          </Card>
        </ScrollReveal3D>

        <ScrollReveal3D delay={0.08}>
          <Card className="overflow-hidden glass-panel">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Complaint</th>
                    <th className="px-4 py-3 font-medium">Prediction &amp; Mode</th>
                    <th className="px-4 py-3 font-medium">Raw vs Calibrated</th>
                    <th className="px-4 py-3 font-medium">Uncertainty</th>
                    <th className="px-4 py-3 font-medium">Human Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        Loading AI analysis records...
                      </td>
                    </tr>
                  ) : analyses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        No AI analyses recorded yet. Click "Analyze Pending Images" above or upload a new complaint photo.
                      </td>
                    </tr>
                  ) : (
                    analyses.map((row, idx) => (
                      <motion.tr
                        key={row.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(idx * 0.04, 0.3), duration: 0.25 }}
                        className="transition-colors hover:bg-blue-50/40 dark:hover:bg-cyan-500/5"
                      >
                      <td className="px-4 py-3">
                        <Link
                          to={`/citizen/complaints/${row.complaint_id}`}
                          className="font-mono text-xs font-semibold text-blue-600 hover:underline dark:text-cyan-400"
                        >
                          {row.complaint_number}
                        </Link>
                        <div className="text-xs font-medium text-slate-900 dark:text-white">
                          {row.complaint_title}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Citizen tag: {row.citizen_category.replace(/_/g, " ")}
                        </div>
                      </td>

                      <td className="px-4 py-3 space-y-1">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {row.predicted_category}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {row.is_demo_mode ? (
                            <Badge tone="amber">
                              <AlertTriangle className="h-3 w-3" />
                              DEMO MODE
                            </Badge>
                          ) : (
                            <Badge tone="cyan">YOLO</Badge>
                          )}
                          <span className="font-mono text-[10px] text-slate-400">{row.model_version}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 font-mono text-xs">
                        <div>Raw: {(row.confidence * 100).toFixed(1)}%</div>
                        <div className="text-slate-500">
                          Cal:{" "}
                          {row.calibrated_confidence !== null
                            ? `${(row.calibrated_confidence * 100).toFixed(1)}%`
                            : "—"}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <Badge tone={row.uncertainty_score >= 0.35 ? "rose" : "emerald"}>
                          {(row.uncertainty_score * 100).toFixed(1)}%
                        </Badge>
                      </td>

                      <td className="px-4 py-3">
                        {row.requires_human_verification ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={selectedLabels[row.id] ?? row.predicted_category}
                              onChange={(e) =>
                                setSelectedLabels((prev) => ({ ...prev, [row.id]: e.target.value }))
                              }
                              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                            >
                              {VERIFIED_LABELS.map((lbl) => (
                                <option key={lbl} value={lbl}>
                                  {lbl}
                                </option>
                              ))}
                            </select>
                            <Button
                              size="sm"
                              disabled={verifyingId === row.id}
                              onClick={() => void handleVerify(row)}
                            >
                              <ShieldAlert className="h-3.5 w-3.5" />
                              Verify
                            </Button>
                          </div>
                        ) : (
                          <Badge tone="emerald">
                            <CheckCircle2 className="h-3 w-3" />
                            Verified
                          </Badge>
                        )}
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          </Card>
        </ScrollReveal3D>
      </div>
    </DashboardLayout>
  );
}

