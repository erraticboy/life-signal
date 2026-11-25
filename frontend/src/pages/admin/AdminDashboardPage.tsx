import { motion } from "framer-motion";
import {
  Activity,
  Cpu,
  Download,
  FileSpreadsheet,
  Flame,
  Layers,
  MapPin,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
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
import type { AdminOverview } from "../../types/auth";

const commandShortcuts = [
  {
    to: "/admin/map",
    title: "Infrastructure Map",
    subtitle: "PostGIS pins, DBSCAN zones & duplicate links",
    icon: MapPin,
  },
  {
    to: "/admin/hotspots",
    title: "Hotspots & Priority",
    subtitle: "Explainable scoring & admin overrides",
    icon: Flame,
  },
  {
    to: "/admin/ai-analysis",
    title: "AI Vision & Calibration",
    subtitle: "ECE metrics, uncertainty & verification",
    icon: Cpu,
  },
  {
    to: "/admin/duplicates",
    title: "Duplicate Detection",
    subtitle: "Multimodal similarity review queue",
    icon: Layers,
  },
  {
    to: "/admin/maintenance",
    title: "Predictive Maintenance",
    subtitle: "Historical trends & Random Forest demand",
    icon: TrendingUp,
  },
  {
    to: "/admin/exports",
    title: "Reports & Exports",
    subtitle: "Audit-logged CSV, JSON & Executive PDF",
    icon: Download,
  },
];

export function AdminDashboardPage() {
  const { getIdToken } = useAuth();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = await getIdToken();
        if (!token) return;
        const data = await apiClient.getAdminOverview(token);
        if (mounted) {
          setOverview(data);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load admin overview.");
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [getIdToken]);

  const metrics = [
    {
      label: "Registered Users",
      value: overview ? overview.total_users : "—",
      icon: Users,
      tone: "text-blue-600 dark:text-cyan-400",
    },
    {
      label: "Citizens",
      value: overview ? overview.total_citizens : "—",
      icon: Users,
      tone: "text-emerald-500",
    },
    {
      label: "Administrators",
      value: overview ? overview.total_admins : "—",
      icon: ShieldCheck,
      tone: "text-cyan-500",
    },
    {
      label: "Total Complaints",
      value: overview ? overview.total_complaints : "—",
      icon: FileSpreadsheet,
      tone: "text-blue-600 dark:text-cyan-400",
    },
  ];

  return (
    <DashboardLayout mode="admin">
      <div className="space-y-6">
        <FloatingElement amplitude={3} duration={6.5}>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
                Administrator Command Console
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Backend-verified RBAC metrics and security audit stream.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/admin/complaints">
                <Button size="sm" className="shadow-md shadow-blue-600/20 transition-transform hover:-translate-y-0.5">
                  Inspect Complaints
                </Button>
              </Link>
              <Link to="/admin/users">
                <Button variant="secondary" size="sm" className="transition-transform hover:-translate-y-0.5">
                  Manage Users &amp; Roles
                </Button>
              </Link>
            </div>
          </div>
        </FloatingElement>

        {error && <StatusAlert variant="error">{error}</StatusAlert>}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((m, idx) => {
            const Icon = m.icon;
            return (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, y: 14, rotateX: 8 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ delay: idx * 0.06, duration: 0.4 }}
              >
                <Tilt3DCard floating floatDelay={idx * 0.45} className="p-5">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>{m.label}</span>
                    <Icon className={`h-4 w-4 ${m.tone}`} />
                  </div>
                  <p className="mt-2 font-mono text-2xl font-bold text-slate-950 dark:text-white">
                    <AnimatedCounter value={m.value} />
                  </p>
                </Tilt3DCard>
              </motion.div>
            );
          })}
        </div>

        {/* 3D Command Shortcuts */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {commandShortcuts.map((tile, idx) => {
            const Icon = tile.icon;
            return (
              <motion.div
                key={tile.to}
                initial={{ opacity: 0, y: 16, rotateX: 8 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ delay: 0.08 + idx * 0.05, duration: 0.4 }}
              >
                <Link to={tile.to} className="block h-full">
                  <Tilt3DCard floating floatDelay={idx * 0.35} className="p-5 h-full">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-transform duration-300 group-hover:scale-110 dark:bg-cyan-500/10 dark:text-cyan-400">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <h2 className="text-sm font-semibold text-slate-950 dark:text-white">
                          {tile.title}
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{tile.subtitle}</p>
                      </div>
                    </div>
                  </Tilt3DCard>
                </Link>
              </motion.div>
            );
          })}
        </div>

        <ScrollReveal3D delay={0.14}>
          <Tilt3DCard intensity={4} className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-600 dark:text-cyan-400" />
                <h2 className="text-base font-semibold text-slate-950 dark:text-white">
                  Recent Security &amp; Audit Events
                </h2>
              </div>
              <Badge tone="neutral">Live DB</Badge>
            </div>

            {!overview || overview.recent_audit_events.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No audit log events recorded yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {overview.recent_audit_events.map((event, idx) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(idx * 0.04, 0.3) }}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-0.5">
                      <span className="font-mono font-semibold text-slate-900 dark:text-white">
                        {event.action}
                      </span>
                      <p className="text-slate-500 dark:text-slate-400">
                        {event.resource_type} {event.resource_id ? `(${event.resource_id})` : ""}
                      </p>
                    </div>
                    <span className="font-mono text-slate-400">
                      {new Date(event.created_at).toLocaleString()}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </Tilt3DCard>
        </ScrollReveal3D>
      </div>
    </DashboardLayout>
  );
}
