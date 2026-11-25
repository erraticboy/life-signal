import { motion } from "framer-motion";
import { Download, Eye, FilePlus2, Search } from "lucide-react";
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
  type ComplaintItem,
} from "../../types/complaint";

export function MyComplaintsPage() {
  const { getIdToken } = useAuth();
  const [items, setItems] = useState<ComplaintItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getIdToken();
      if (!token) return;
      const data = await apiClient.listMyComplaints(token, {
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
        q: search.trim() || undefined,
      });
      setItems(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load your complaints.");
    } finally {
      setLoading(false);
    }
  }, [getIdToken, statusFilter, categoryFilter, search]);

  useEffect(() => {
    void fetchComplaints();
  }, [fetchComplaints]);

  const handleDownloadPdf = async (complaint: ComplaintItem) => {
    try {
      const token = await getIdToken();
      if (!token) return;
      await apiClient.downloadComplaintPdf(token, complaint.id, complaint.complaint_number);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download PDF.");
    }
  };

  return (
    <DashboardLayout mode="citizen">
      <div className="space-y-6">
        <FloatingElement amplitude={3} duration={6.5}>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
                  My Registered Complaints
                </h1>
                <Badge tone="blue">
                  <AnimatedCounter value={items.length} /> Total
                </Badge>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Track complaint progress and re-download official ReportLab PDF acknowledgments anytime.
              </p>
            </div>
            <Link to="/citizen/complaints/new">
              <Button className="shadow-md shadow-blue-600/20 transition-transform hover:-translate-y-0.5">
                <FilePlus2 className="h-4 w-4" />
                New Complaint
              </Button>
            </Link>
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
                placeholder="Search ref ID, title, or address..."
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

        {error && <StatusAlert variant="error">{error}</StatusAlert>}

        {loading ? (
          <Card className="p-10 text-center text-sm text-slate-500">Loading your complaints...</Card>
        ) : items.length === 0 ? (
          <Card className="p-10 text-center space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              No complaints found matching the selected filters.
            </p>
            <Link to="/citizen/complaints/new">
              <Button size="sm">Register First Complaint</Button>
            </Link>
          </Card>
        ) : (
          <ScrollReveal3D delay={0.08}>
            <Card className="overflow-hidden glass-panel">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50/80 text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">Reference</th>
                      <th className="px-4 py-3 font-medium">Complaint</th>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Submitted</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {items.map((item, idx) => (
                      <motion.tr
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(idx * 0.04, 0.32), duration: 0.3 }}
                        className="transition-colors hover:bg-blue-50/40 dark:hover:bg-cyan-500/5"
                      >
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-600 dark:text-cyan-400">
                        {item.complaint_number}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-white">{item.title}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
                          {item.address}
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
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                        {new Date(item.created_at).toLocaleDateString()}
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
                              View
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            </Card>
          </ScrollReveal3D>
        )}
      </div>
    </DashboardLayout>
  );
}

