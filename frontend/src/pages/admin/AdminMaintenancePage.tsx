import { motion } from "framer-motion";
import { BarChart3, Clock, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { AnimatedCounter } from "../../components/motion/AnimatedCounter";
import { FloatingElement } from "../../components/motion/FloatingElement";
import { ScrollReveal3D } from "../../components/motion/ScrollReveal3D";
import { Tilt3DCard } from "../../components/motion/Tilt3DCard";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { StatusAlert } from "../../components/ui/StatusAlert";
import { useAuth } from "../../contexts/AuthContext";
import { apiClient } from "../../lib/api";
import type { MaintenanceAnalytics } from "../../types/complaint";

export function AdminMaintenancePage() {
  const { getIdToken } = useAuth();
  const [data, setData] = useState<MaintenanceAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = await getIdToken();
        if (!token) return;
        const res = await apiClient.getMaintenanceAnalytics(token);
        if (mounted) {
          setData(res);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load maintenance analytics.");
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [getIdToken]);

  const combinedSeries = data
    ? [
        ...data.historical_weekly_series.map((p) => ({
          period: p.period_start,
          actual: p.actual_complaints,
          forecast: null as number | null,
        })),
        ...data.forecast_horizon_weeks.map((f) => ({
          period: f.period_start,
          actual: null as number | null,
          forecast: f.predicted_complaints,
        })),
      ]
    : [];

  return (
    <DashboardLayout mode="admin">
      <div className="space-y-6">
        <FloatingElement amplitude={3} duration={6.5}>
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
              Predictive Maintenance &amp; Historical Analytics
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Strictly separates verified historical statistics from machine-learning demand forecasts.
            </p>
          </div>
        </FloatingElement>

        {error && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
            <StatusAlert variant="error">{error}</StatusAlert>
          </motion.div>
        )}

        {data && (
          <>
            {/* Actual Historical Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-3">
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
                <Tilt3DCard floating floatDelay={0} className="p-5">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Actual Historical Complaints</span>
                    <BarChart3 className="h-4 w-4 text-blue-600 dark:text-cyan-400" />
                  </div>
                  <p className="mt-2 font-mono text-2xl font-bold text-slate-950 dark:text-white">
                    <AnimatedCounter value={data.total_complaints} />
                  </p>
                </Tilt3DCard>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Tilt3DCard floating floatDelay={0.4} className="p-5">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Recurring Locations (≥ 2 Reports)</span>
                    <TrendingUp className="h-4 w-4 text-cyan-500" />
                  </div>
                  <p className="mt-2 font-mono text-2xl font-bold text-slate-950 dark:text-white">
                    <AnimatedCounter value={data.recurring_locations.length} />
                  </p>
                </Tilt3DCard>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
                <Tilt3DCard floating floatDelay={0.8} className="p-5">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Avg Resolution Time</span>
                    <Clock className="h-4 w-4 text-emerald-500" />
                  </div>
                  <p className="mt-2 font-mono text-2xl font-bold text-slate-950 dark:text-white">
                    {data.avg_resolution_hours !== null ? `${data.avg_resolution_hours} h` : "No resolved yet"}
                  </p>
                </Tilt3DCard>
              </motion.div>
            </div>

            {/* Section A: Actual Historical Distributions */}
            <div className="grid gap-6 lg:grid-cols-2">
              <ScrollReveal3D direction="left">
                <Card className="p-6 space-y-4 h-full glass-panel">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-950 dark:text-white">
                    Actual Issue Distribution by Category
                  </h2>
                  <Badge tone="blue">Historical Data</Badge>
                </div>
                {data.category_distribution.length === 0 ? (
                  <p className="text-sm text-slate-500 py-10 text-center">No historical complaints recorded.</p>
                ) : (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.category_distribution} layout="vertical" margin={{ left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                        <YAxis dataKey="category" type="category" width={135} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="count" name="Reports" fill="#2563EB" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                </Card>
              </ScrollReveal3D>

              <ScrollReveal3D direction="right" delay={0.06}>
                <Card className="p-6 space-y-4 h-full glass-panel">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-950 dark:text-white">
                    Recurring Damage Locations
                  </h2>
                  <Badge tone="blue">Historical Data</Badge>
                </div>
                {data.recurring_locations.length === 0 ? (
                  <p className="text-sm text-slate-500 py-10 text-center">
                    No recurring addresses with 2+ complaints recorded yet.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {data.recurring_locations.map((loc, idx) => (
                      <motion.div
                        key={loc.address}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        className="py-2.5 flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">{loc.address}</div>
                          <div className="text-slate-500">{loc.dominant_category}</div>
                        </div>
                        <Badge tone="amber">{loc.report_count} reports</Badge>
                      </motion.div>
                    ))}
                  </div>
                )}
                </Card>
              </ScrollReveal3D>
            </div>

            {/* Section B: Conditional ML Demand Forecasting */}
            <ScrollReveal3D delay={0.1}>
              <Card className="p-6 space-y-4 glass-panel">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-slate-950 dark:text-white">
                    ML Maintenance Demand Forecast
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{data.forecast_detail}</p>
                </div>
                <div className="flex items-center gap-2">
                  {data.forecast_available ? (
                    <>
                      <Badge tone="cyan">{data.model_name}</Badge>
                      {data.cv_mae !== null && (
                        <Badge tone="neutral">TimeSeries CV MAE: {data.cv_mae}</Badge>
                      )}
                    </>
                  ) : (
                    <Badge tone="amber">Forecast Gated (Honest Data Check)</Badge>
                  )}
                </div>
              </div>

              {!data.forecast_available ? (
                <StatusAlert variant="info" title="Insufficient Historical Volume for Forecasting">
                  {data.forecast_detail}
                </StatusAlert>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={combinedSeries}>
                      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="actual"
                        name="Actual Weekly Complaints"
                        stroke="#2563EB"
                        fill="#2563EB"
                        fillOpacity={0.2}
                      />
                      <Area
                        type="monotone"
                        dataKey="forecast"
                        name="ML Forecasted Demand"
                        stroke="#06B6D4"
                        fill="#06B6D4"
                        fillOpacity={0.25}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
              </Card>
            </ScrollReveal3D>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

