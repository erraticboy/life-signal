import { motion } from "framer-motion";
import { Download, Eye, Search } from "lucide-react";
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
import {
  CATEGORY_LABEL_MAP,
  CATEGORY_OPTIONS,
  STATUS_OPTIONS,
  STATUS_TONE_MAP,
  type AdminComplaintItem,
  type ComplaintStatus,
} from "../../types/complaint";

export function AdminComplaintsPage() {
  const { getIdToken } = useAuth();
  const [complaints, setComplaints] = useState<AdminComplaintItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadComplaints = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getIdToken();
      if (!token) return;
      const list = await apiClient.listAdminComplaints(token, {
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
        q: search.trim() || undefined,
      });
      setComplaints(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load complaints.");
    } finally {
      setLoading(false);
    }
  }, [getIdToken, statusFilter, categoryFilter, search]);

  useEffect(() => {
    void loadComplaints();
  }, [loadComplaints]);

  const handleStatusChange = async (item: AdminComplaintItem, nextStatus: ComplaintStatus) => {
    setUpdatingId(item.id);
    setError(null);
    setNotice(null);
    try {
      const token = await getIdToken();
      if (!token) return;
      const updated = await apiClient.updateAdminComplaintStatus(token, item.id, {
        status: nextStatus,
        notes: `Status changed to ${nextStatus.replace("_", " ")} by administrator.`,
      });
      setComplaints((prev) =>
        prev.map((c) => (c.id === item.id ? { ...c, status: updated.status } : c))
      );
      setNotice(`Updated ${item.complaint_number} status to ${nextStatus.replace("_", " ")}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update complaint status.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDownloadPdf = async (item: AdminComplaintItem) => {
    try {
      const token = await getIdToken();
      if (!token) return;
      await apiClient.downloadComplaintPdf(token, item.id, item.complaint_number);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download PDF.");
    }
  };

  return (
    <DashboardLayout mode="admin">
      <div className="space-y-6">
        <FloatingElement amplitude={3} duration={6.5}>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
                All Submitted Complaints
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Verify citizen reports, update workflow statuses, and download official acknowledgment PDFs.
              </p>
            </div>
            <Badge tone="blue">
              <AnimatedCounter value={complaints.length} /> Records
            </Badge>
          </div>
        </FloatingElement>

        <ScrollReveal3D>
          <Tilt3DCard intensity={3} className="p-4 grid gap-3 sm:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search ref ID, title, address..."
                className="h-9 w-full rounded-lg border border-slate-200 bg-white/90 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950/80 dark:text-white"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white/90 px-3 text-sm dark:border-slate-700 dark:bg-slate-950/80 dark:text-white"
            >
              <option value="">All categories</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white/90 px-3 text-sm dark:border-slate-700 dark:bg-slate-950/80 dark:text-white"
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Tilt3DCard>
        </ScrollReveal3D>

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

        <ScrollReveal3D delay={0.08}>
          <Card className="overflow-hidden glass-panel">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Reference</th>
                    <th className="px-4 py-3 font-medium">Issue &amp; Reporter</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Update Status</th>
                    <th className="px-4 py-3 font-medium text-right">Records</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        Loading complaints...
                      </td>
                    </tr>
                  ) : complaints.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No complaints submitted yet.
                      </td>
                    </tr>
                  ) : (
                    complaints.map((item, idx) => (
                      <motion.tr
                        key={item.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(idx * 0.035, 0.3), duration: 0.25 }}
                        className="transition-colors hover:bg-blue-50/40 dark:hover:bg-cyan-500/5"
                      >
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-600 dark:text-cyan-400">
                        {item.complaint_number}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-white">{item.title}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {item.reporter_name} · {item.address}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700 dark:text-slate-300">
                        {CATEGORY_LABEL_MAP[item.category]}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={STATUS_TONE_MAP[item.status]}>
                          {item.status.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          aria-label={`Change status for ${item.complaint_number}`}
                          value={item.status}
                          disabled={updatingId === item.id}
                          onChange={(e) =>
                            void handleStatusChange(item, e.target.value as ComplaintStatus)
                          }
                          className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => void handleDownloadPdf(item)}
                          >
                            <Download className="h-3.5 w-3.5" />
                            PDF
                          </Button>
                          <Link to={`/citizen/complaints/${item.id}`}>
                            <Button size="sm" variant="ghost">
                              <Eye className="h-3.5 w-3.5" />
                              Inspect
                            </Button>
                          </Link>
                        </div>
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

