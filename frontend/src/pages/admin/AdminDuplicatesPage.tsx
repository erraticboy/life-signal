import { motion } from "framer-motion";
import { Check, Layers, MapPin, RefreshCw, X } from "lucide-react";
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
import type { DuplicateGroupItem, DuplicateReviewStatus } from "../../types/complaint";

const REVIEW_TONE: Record<DuplicateReviewStatus, "amber" | "emerald" | "neutral"> = {
  pending: "amber",
  confirmed_duplicate: "emerald",
  dismissed: "neutral",
};

export function AdminDuplicatesPage() {
  const { getIdToken } = useAuth();
  const [groups, setGroups] = useState<DuplicateGroupItem[]>([]);
  const [filterStatus, setFilterStatus] = useState<DuplicateReviewStatus | "">("");
  const [threshold, setThreshold] = useState<number>(0.65);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDuplicates = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getIdToken();
      if (!token) return;
      const list = await apiClient.listAdminDuplicates(token, filterStatus);
      setGroups(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load duplicate groups.");
    } finally {
      setLoading(false);
    }
  }, [getIdToken, filterStatus]);

  useEffect(() => {
    void loadDuplicates();
  }, [loadDuplicates]);

  const handleScan = async () => {
    setScanning(true);
    setError(null);
    setNotice(null);
    try {
      const token = await getIdToken();
      if (!token) return;
      const res = await apiClient.scanAdminDuplicates(token, threshold);
      setNotice(
        `Scan completed: ${res.candidates_found} candidate pair(s) found (text=${res.text_backend}, image=${res.image_backend}). No complaints were deleted.`
      );
      await loadDuplicates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Duplicate scan failed.");
    } finally {
      setScanning(false);
    }
  };

  const handleReview = async (groupId: string, reviewStatus: DuplicateReviewStatus) => {
    setUpdatingId(groupId);
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) return;
      const updated = await apiClient.reviewDuplicateGroup(token, groupId, reviewStatus);
      setGroups((prev) => prev.map((g) => (g.id === groupId ? updated : g)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update duplicate review.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <DashboardLayout mode="admin">
      <div className="space-y-6">
        <FloatingElement amplitude={3} duration={6.5}>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
                  Multimodal Duplicate Detection
                </h1>
                <Badge tone="cyan">
                  <AnimatedCounter value={groups.length} /> Pairs
                </Badge>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Combines image descriptors, text similarity, geographic proximity, and report timestamps. Complaints are never auto-deleted.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <span>Threshold:</span>
                <input
                  type="number"
                  step="0.05"
                  min="0.2"
                  max="0.95"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="h-8 w-16 rounded-md border border-slate-200 bg-white/90 px-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-950/80 dark:text-white"
                />
              </label>
              <Button size="sm" onClick={() => void handleScan()} disabled={scanning} className="shadow-md shadow-blue-600/20">
                <RefreshCw className={`h-3.5 w-3.5 ${scanning ? "animate-spin" : ""}`} />
                {scanning ? "Scanning..." : "Run Duplicate Scan"}
              </Button>
            </div>
          </div>
        </FloatingElement>

        <div className="flex flex-wrap gap-2">
          {([
            ["", "All Candidates"],
            ["pending", "Pending Review"],
            ["confirmed_duplicate", "Confirmed"],
            ["dismissed", "Dismissed"],
          ] as const).map(([val, label]) => (
            <Button
              key={label}
              size="sm"
              variant={filterStatus === val ? "primary" : "secondary"}
              onClick={() => setFilterStatus(val)}
              className="transition-transform hover:-translate-y-0.5"
            >
              {label}
            </Button>
          ))}
        </div>

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

        {loading ? (
          <Card className="p-10 text-center text-sm text-slate-500">Loading duplicate groups...</Card>
        ) : groups.length === 0 ? (
          <Card className="p-10 text-center space-y-2">
            <Layers className="h-6 w-6 mx-auto text-slate-400" />
            <p className="text-sm text-slate-600 dark:text-slate-400">
              No duplicate candidate pairs found. Click "Run Duplicate Scan" to evaluate submitted reports.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {groups.map((grp, idx) => (
              <ScrollReveal3D key={grp.id} delay={Math.min(idx * 0.05, 0.25)}>
                <Tilt3DCard intensity={3.5} className="p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Badge tone="blue">
                      Overall Similarity: {(grp.similarity_score * 100).toFixed(1)}%
                    </Badge>
                    {grp.image_similarity !== null && (
                      <Badge tone="neutral">
                        Image: {(grp.image_similarity * 100).toFixed(0)}%
                      </Badge>
                    )}
                    {grp.text_similarity !== null && (
                      <Badge tone="neutral">
                        Text: {(grp.text_similarity * 100).toFixed(0)}%
                      </Badge>
                    )}
                    {grp.distance_meters !== null && (
                      <Badge tone="cyan">
                        <MapPin className="h-3 w-3" />
                        {grp.distance_meters.toFixed(1)} m apart
                      </Badge>
                    )}
                    {grp.time_diff_hours !== null && (
                      <Badge tone="neutral">{grp.time_diff_hours.toFixed(1)}h gap</Badge>
                    )}
                  </div>
                  <Badge tone={REVIEW_TONE[grp.review_status]}>
                    {grp.review_status.replace("_", " ")}
                  </Badge>
                </div>

                <div className="grid gap-4 md:grid-cols-2 text-sm">
                  {[
                    { tag: "Primary Report", item: grp.primary_complaint },
                    { tag: "Related Candidate", item: grp.related_complaint },
                  ].map(({ tag, item }) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-1.5 dark:border-slate-800 dark:bg-slate-950/50"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="uppercase tracking-wider text-slate-500">{tag}</span>
                        <Link
                          to={`/citizen/complaints/${item.id}`}
                          className="font-mono font-semibold text-blue-600 hover:underline dark:text-cyan-400"
                        >
                          {item.complaint_number}
                        </Link>
                      </div>
                      <p className="font-semibold text-slate-950 dark:text-white">{item.title}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{item.address}</p>
                      <p className="font-mono text-[11px] text-slate-400">
                        {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)} ·{" "}
                        {new Date(item.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap justify-end gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={updatingId === grp.id || grp.review_status === "dismissed"}
                    onClick={() => void handleReview(grp.id, "dismissed")}
                  >
                    <X className="h-3.5 w-3.5" />
                    Dismiss Match
                  </Button>
                  <Button
                    size="sm"
                    disabled={updatingId === grp.id || grp.review_status === "confirmed_duplicate"}
                    onClick={() => void handleReview(grp.id, "confirmed_duplicate")}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Confirm Duplicate Group
                  </Button>
                </div>
                </Tilt3DCard>
              </ScrollReveal3D>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

