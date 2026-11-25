import { motion } from "framer-motion";
import { FileJson, FileSpreadsheet, FileText } from "lucide-react";
import { useState } from "react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { FloatingElement } from "../../components/motion/FloatingElement";
import { ScrollReveal3D } from "../../components/motion/ScrollReveal3D";
import { Tilt3DCard } from "../../components/motion/Tilt3DCard";
import { Button } from "../../components/ui/Button";
import { StatusAlert } from "../../components/ui/StatusAlert";
import { useAuth } from "../../contexts/AuthContext";
import { apiClient } from "../../lib/api";
import { CATEGORY_OPTIONS, STATUS_OPTIONS } from "../../types/complaint";

export function AdminExportsPage() {
  const { getIdToken } = useAuth();
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async (format: "csv" | "json" | "pdf") => {
    setDownloading(format);
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) return;
      await apiClient.downloadAdminExport(token, format, {
        category: category || undefined,
        status: status || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <DashboardLayout mode="admin">
      <div className="max-w-4xl space-y-6">
        <FloatingElement amplitude={3} duration={6.5}>
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
              Reports &amp; Data Exports
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Download audit-logged municipal complaint records in CSV, JSON, or Executive PDF summary format.
            </p>
          </div>
        </FloatingElement>

        {error && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
            <StatusAlert variant="error">{error}</StatusAlert>
          </motion.div>
        )}

        <ScrollReveal3D>
          <Tilt3DCard intensity={3} className="p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-950 dark:text-white">
              Optional Export Filters (CSV &amp; JSON)
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-10 rounded-lg border border-slate-200 bg-white/90 px-3 text-sm dark:border-slate-700 dark:bg-slate-950/80 dark:text-white"
              >
                <option value="">All categories</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>

              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-10 rounded-lg border border-slate-200 bg-white/90 px-3 text-sm dark:border-slate-700 dark:bg-slate-950/80 dark:text-white"
              >
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </Tilt3DCard>
        </ScrollReveal3D>

        <div className="grid gap-4 sm:grid-cols-3">
          <ScrollReveal3D delay={0.04}>
            <Tilt3DCard floating floatDelay={0} className="p-6 h-full flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <FileSpreadsheet className="h-6 w-6 text-emerald-600 transition-transform duration-300 group-hover:scale-110" />
                <h3 className="font-semibold text-slate-950 dark:text-white">Spreadsheet CSV</h3>
                <p className="text-xs text-slate-500">
                  Full tabular export with GPS coordinates, priority scores, and reporter metadata.
                </p>
              </div>
              <Button onClick={() => void handleExport("csv")} disabled={downloading !== null}>
                {downloading === "csv" ? "Generating..." : "Download CSV"}
              </Button>
            </Tilt3DCard>
          </ScrollReveal3D>

          <ScrollReveal3D delay={0.1}>
            <Tilt3DCard floating floatDelay={0.4} className="p-6 h-full flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <FileJson className="h-6 w-6 text-blue-600 transition-transform duration-300 group-hover:scale-110" />
                <h3 className="font-semibold text-slate-950 dark:text-white">Structured JSON</h3>
                <p className="text-xs text-slate-500">
                  Machine-readable JSON dataset for research notebooks or GIS tooling.
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={() => void handleExport("json")}
                disabled={downloading !== null}
              >
                {downloading === "json" ? "Exporting..." : "Download JSON"}
              </Button>
            </Tilt3DCard>
          </ScrollReveal3D>

          <ScrollReveal3D delay={0.16}>
            <Tilt3DCard floating floatDelay={0.8} className="p-6 h-full flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <FileText className="h-6 w-6 text-cyan-600 transition-transform duration-300 group-hover:scale-110" />
                <h3 className="font-semibold text-slate-950 dark:text-white">Executive PDF Report</h3>
                <p className="text-xs text-slate-500">
                  Official ReportLab summary report listing complaint metrics and top records.
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={() => void handleExport("pdf")}
                disabled={downloading !== null}
              >
                {downloading === "pdf" ? "Rendering..." : "Download PDF"}
              </Button>
            </Tilt3DCard>
          </ScrollReveal3D>
        </div>
      </div>
    </DashboardLayout>
  );
}

