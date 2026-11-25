import { AnimatePresence, motion } from "framer-motion";
import { Flame, RefreshCw, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
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
  type HotspotClusterItem,
  type PriorityLevel,
  type PriorityQueueItem,
} from "../../types/complaint";

const PRIORITY_TONE: Record<PriorityLevel, "rose" | "amber" | "blue" | "emerald"> = {
  critical: "rose",
  high: "amber",
  medium: "blue",
  low: "emerald",
};

export function AdminHotspotsPage() {
  const { getIdToken } = useAuth();
  const [hotspots, setHotspots] = useState<HotspotClusterItem[]>([]);
  const [queue, setQueue] = useState<PriorityQueueItem[]>([]);
  const [epsMeters, setEpsMeters] = useState(250);
  const [minSamples, setMinSamples] = useState(2);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);
  const [editingItem, setEditingItem] = useState<PriorityQueueItem | null>(null);
  const [overrideScore, setOverrideScore] = useState(80);
  const [overrideLevel, setOverrideLevel] = useState<PriorityLevel>("critical");
  const [overrideRationale, setOverrideRationale] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getIdToken();
      if (!token) return;
      const [mapRes, queueRes] = await Promise.all([
        apiClient.getGeospatialMapData(token, { eps_meters: epsMeters, min_samples: minSamples }),
        apiClient.getPriorityQueue(token),
      ]);
      setHotspots(mapRes.hotspots);
      setQueue(queueRes);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load hotspot analytics.");
    } finally {
      setLoading(false);
    }
  }, [getIdToken, epsMeters, minSamples]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleRecompute = async () => {
    setRecomputing(true);
    setNotice(null);
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) return;
      const res = await apiClient.recomputePriorities(token);
      setQueue(res.queue);
      setNotice(`Recomputed explainable priority scores across ${res.updated_count} complaint(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to recompute priorities.");
    } finally {
      setRecomputing(false);
    }
  };

  const handleOverrideSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) return;
      const updated = await apiClient.overrideComplaintPriority(token, editingItem.id, {
        priority_score: overrideScore,
        priority_level: overrideLevel,
        rationale: overrideRationale.trim(),
      });
      setQueue((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
      setNotice(`Updated priority for ${updated.complaint_number} (audit logged).`);
      setEditingItem(null);
      setOverrideRationale("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Override failed.");
    }
  };

  const chartData = hotspots.map((h) => ({
    name: `Cluster #${h.cluster_id + 1}`,
    complaints: h.complaint_count,
    avgPriority: h.avg_priority_score ?? 0,
  }));

  return (
    <DashboardLayout mode="admin">
      <div className="space-y-6">
        <FloatingElement amplitude={3} duration={6.5}>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
                Hotspot Analytics &amp; Explainable Prioritization
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                DBSCAN geospatial clustering paired with transparent factor-based maintenance ranking.
              </p>
            </div>
            <Button onClick={() => void handleRecompute()} disabled={recomputing} className="shadow-md shadow-blue-600/20">
              <RefreshCw className={`h-4 w-4 ${recomputing ? "animate-spin" : ""}`} />
              {recomputing ? "Scoring..." : "Recompute Priority Scores"}
            </Button>
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

        {/* DBSCAN Controls + Chart */}
        <div className="grid gap-6 lg:grid-cols-2">
          <ScrollReveal3D direction="left">
            <Tilt3DCard intensity={3.5} className="p-6 space-y-4 h-full">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-950 dark:text-white flex items-center gap-2">
                <Flame className="h-4 w-4 text-cyan-500" />
                DBSCAN Spatial Hotspots
              </h2>
              <div className="flex items-center gap-2 text-xs">
                <label className="flex items-center gap-1">
                  <span className="text-slate-500">Eps (m):</span>
                  <input
                    type="number"
                    min={50}
                    max={3000}
                    step={50}
                    value={epsMeters}
                    onChange={(e) => setEpsMeters(Number(e.target.value) || 250)}
                    className="h-7 w-16 rounded border border-slate-200 px-1.5 font-mono dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </label>
                <label className="flex items-center gap-1">
                  <span className="text-slate-500">Min:</span>
                  <input
                    type="number"
                    min={2}
                    max={15}
                    value={minSamples}
                    onChange={(e) => setMinSamples(Math.max(2, Number(e.target.value) || 2))}
                    className="h-7 w-12 rounded border border-slate-200 px-1.5 font-mono dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </label>
              </div>
            </div>

            {hotspots.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">
                No geographic hotspots detected at eps={epsMeters}m, min_samples={minSamples}.
              </p>
            ) : (
              <div className="space-y-3">
                {hotspots.map((h, idx) => (
                  <motion.div
                    key={h.cluster_id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs space-y-1 dark:border-slate-800 dark:bg-slate-950/50"
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span>Hotspot #{h.cluster_id + 1}</span>
                      <Badge tone="cyan">{h.complaint_count} reports</Badge>
                    </div>
                    <div className="text-slate-600 dark:text-slate-400">
                      Dominant: {h.dominant_category.replace(/_/g, " ")} · Radius: {h.radius_meters} m
                    </div>
                    <div className="font-mono text-[11px] text-slate-500">
                      {h.complaint_numbers.join(", ")}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
            </Tilt3DCard>
          </ScrollReveal3D>

          <ScrollReveal3D direction="right" delay={0.06}>
            <Card className="p-6 space-y-4 h-full glass-panel">
            <h2 className="text-base font-semibold text-slate-950 dark:text-white">
              Cluster Density Overview
            </h2>
            {chartData.length === 0 ? (
              <p className="text-sm text-slate-500 py-12 text-center">
                Submit 2+ nearby complaints to visualize DBSCAN cluster distributions.
              </p>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.25} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="complaints" name="Complaints" fill="#2563EB" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            </Card>
          </ScrollReveal3D>
        </div>

        {/* Override Modal/Inline Form */}
        <AnimatePresence>
          {editingItem && (
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.97 }}
              transition={{ duration: 0.25 }}
            >
              <Tilt3DCard intensity={3} glowColor="rgba(6, 182, 212, 0.24)" className="p-6 border-blue-400 dark:border-cyan-700 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
                    Administrator Priority Review — {editingItem.complaint_number}
                  </h3>
                  <Button size="sm" variant="ghost" onClick={() => setEditingItem(null)}>
                    Cancel
                  </Button>
                </div>
                <form onSubmit={(e) => void handleOverrideSubmit(e)} className="grid gap-3 sm:grid-cols-4">
                  <input
                    type="number"
                    step="0.5"
                    min={0}
                    max={100}
                    required
                    value={overrideScore}
                    onChange={(e) => setOverrideScore(Number(e.target.value))}
                    className="h-9 rounded-lg border border-slate-200 bg-white/90 px-3 font-mono text-sm dark:border-slate-700 dark:bg-slate-950/80 dark:text-white"
                  />
                  <select
                    value={overrideLevel}
                    onChange={(e) => setOverrideLevel(e.target.value as PriorityLevel)}
                    className="h-9 rounded-lg border border-slate-200 bg-white/90 px-3 text-sm dark:border-slate-700 dark:bg-slate-950/80 dark:text-white"
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <input
                    type="text"
                    required
                    minLength={5}
                    value={overrideRationale}
                    onChange={(e) => setOverrideRationale(e.target.value)}
                    placeholder="Explicit rationale for override..."
                    className="h-9 rounded-lg border border-slate-200 bg-white/90 px-3 text-sm sm:col-span-2 dark:border-slate-700 dark:bg-slate-950/80 dark:text-white"
                  />
                  <Button type="submit" size="sm">
                    Save Override
                  </Button>
                </form>
              </Tilt3DCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Explainable Priority Queue */}
        <ScrollReveal3D delay={0.1}>
          <Card className="p-6 space-y-4 glass-panel">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-950 dark:text-white flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-blue-600 dark:text-cyan-400" />
              Explainable Maintenance Priority Queue
            </h2>
            <span className="text-xs text-slate-500">{queue.length} record(s)</span>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500 py-8 text-center">Loading queue...</p>
          ) : queue.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">No complaints available to prioritize.</p>
          ) : (
            <div className="space-y-4">
              {queue.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.04, 0.28) }}
                  className="rounded-xl border border-slate-200 bg-white/60 p-4 space-y-3 transition-shadow hover:shadow-lg hover:shadow-blue-600/10 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:border-cyan-500/35"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/citizen/complaints/${item.id}`}
                          className="font-mono text-xs font-bold text-blue-600 hover:underline dark:text-cyan-400"
                        >
                          {item.complaint_number}
                        </Link>
                        <span className="font-semibold text-sm text-slate-950 dark:text-white">
                          {item.title}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {CATEGORY_LABEL_MAP[item.category]} · {item.address}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {item.priority_level && (
                        <Badge tone={PRIORITY_TONE[item.priority_level]}>
                          {item.priority_level.toUpperCase()} · {item.priority_score ?? 0}/100
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditingItem(item);
                          setOverrideScore(item.priority_score ?? 60);
                          setOverrideLevel(item.priority_level ?? "medium");
                        }}
                      >
                        Review / Override
                      </Button>
                    </div>
                  </div>

                  {item.priority_explanation && (
                    <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                      <p className="text-xs text-slate-700 dark:text-slate-300">
                        {item.priority_explanation.summary}
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {item.priority_explanation.factors.map((f) => (
                          <div
                            key={f.factor}
                            className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] dark:bg-slate-950/60"
                          >
                            <div className="flex justify-between font-semibold text-slate-800 dark:text-slate-200">
                              <span>{f.factor}</span>
                              <span className="font-mono">
                                +{f.contribution} / {f.max_points}
                              </span>
                            </div>
                            <p className="mt-0.5 text-slate-500 dark:text-slate-400">{f.rationale}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
          </Card>
        </ScrollReveal3D>
      </div>
    </DashboardLayout>
  );
}

