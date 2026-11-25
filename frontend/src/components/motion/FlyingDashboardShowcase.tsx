import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import {
  Activity,
  CheckCircle2,
  Cpu,
  FileText,
  Layers,
  MapPin,
  Radio,
  ScanEye,
  ShieldCheck,
} from "lucide-react";
import { useRef, useState } from "react";
import { Badge } from "../ui/Badge";
import { FloatingElement } from "./FloatingElement";

type PreviewTab = "spatial" | "vision" | "priority";

export function FlyingDashboardShowcase() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<PreviewTab>("spatial");

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "center center"],
  });

  const smoothProgress = useSpring(scrollYProgress, { stiffness: 110, damping: 24 });

  // Central flying console 3D perspective transforms
  const deckRotateX = useTransform(smoothProgress, [0, 1], [18, 0]);
  const deckRotateY = useTransform(smoothProgress, [0, 1], [-8, 0]);
  const deckScale = useTransform(smoothProgress, [0, 1], [0.9, 1]);
  const deckY = useTransform(smoothProgress, [0, 1], [64, 0]);
  const deckOpacity = useTransform(smoothProgress, [0, 0.35], [0.45, 1]);

  // Flanking floating satellite pods parallax flights
  const leftPodX = useTransform(smoothProgress, [0, 1], [-65, 0]);
  const rightPodX = useTransform(smoothProgress, [0, 1], [65, 0]);
  const topPodY = useTransform(smoothProgress, [0, 1], [-45, 0]);
  const bottomPodY = useTransform(smoothProgress, [0, 1], [55, 0]);

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden border-b border-slate-200/80 bg-slate-50 py-24 dark:border-slate-800/80 dark:bg-[#050a16]"
    >
      {/* Volumetric ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 h-[540px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-tr from-blue-600/15 via-cyan-400/10 to-indigo-600/15 blur-3xl dark:from-blue-600/20 dark:via-cyan-500/15"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center space-y-3 mb-16">
          <Badge tone="cyan">
            <Radio className="h-3.5 w-3.5" />
            Scroll-Interactive 3D Architecture
          </Badge>
          <h2 className="font-display text-3xl font-extrabold text-slate-950 sm:text-4xl dark:text-white">
            Command-Grade Urban Intelligence
          </h2>
          <p className="text-sm text-slate-600 sm:text-base dark:text-slate-400">
            Explore how spatial telemetry, calibrated vision uncertainty, and PDF receipts synchronize
            inside a unified workspace.
          </p>
        </div>

        {/* 3D Flying Stage */}
        <div className="relative mx-auto max-w-5xl perspective-1400">
          {/* Top-Left Flying Satellite Pod */}
          <motion.div
            style={{ x: leftPodX, y: topPodY }}
            className="hidden xl:block absolute -left-14 -top-8 z-20 w-60"
          >
            <FloatingElement amplitude={7} duration={5.4} delay={0.1}>
              <div className="flex flex-col gap-2 rounded-2xl border border-slate-200/90 glass-panel p-4 shadow-xl shadow-blue-900/10 dark:border-cyan-500/35 dark:shadow-cyan-500/15">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-cyan-300">
                  <span className="flex items-center gap-1.5">
                    <ScanEye className="h-3.5 w-3.5" />
                    VISION + ECE
                  </span>
                  <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                </div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">
                  Calibrated Uncertainty Gate
                </p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <motion.div
                    animate={{ width: ["65%", "88%", "65%"] }}
                    transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
                    className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400"
                  />
                </div>
                <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                  Temp Scaling · MC Entropy Check
                </span>
              </div>
            </FloatingElement>
          </motion.div>

          {/* Top-Right Flying Satellite Pod */}
          <motion.div
            style={{ x: rightPodX, y: topPodY }}
            className="hidden xl:block absolute -right-12 -top-6 z-20 w-60"
          >
            <FloatingElement amplitude={8} duration={6.1} delay={0.7}>
              <div className="flex flex-col gap-2 rounded-2xl border border-slate-200/90 glass-panel p-4 shadow-xl shadow-blue-900/10 dark:border-blue-500/35 dark:shadow-blue-500/15">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-blue-300">
                  <span className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    REPORTLAB + QR
                  </span>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                </div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">
                  Official PDF + SMTP Dispatch
                </p>
                <span className="font-mono text-[11px] text-blue-600 dark:text-cyan-400">
                  Format: LS-YYYY-NNNNNN
                </span>
              </div>
            </FloatingElement>
          </motion.div>

          {/* Bottom-Left Flying Satellite Pod */}
          <motion.div
            style={{ x: leftPodX, y: bottomPodY }}
            className="hidden xl:block absolute -left-10 -bottom-8 z-20 w-56"
          >
            <FloatingElement amplitude={6} duration={5.8} delay={1.2}>
              <div className="flex flex-col gap-2 rounded-2xl border border-slate-200/90 glass-panel p-4 shadow-xl shadow-blue-900/10 dark:border-slate-700">
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-cyan-600 dark:text-cyan-400">
                  <MapPin className="h-3.5 w-3.5" />
                  POSTGIS + DBSCAN
                </div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">
                  Haversine Hotspot Clustering
                </p>
                <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                  SRID 4326 · Metric BallTree
                </span>
              </div>
            </FloatingElement>
          </motion.div>

          {/* Bottom-Right Flying Satellite Pod */}
          <motion.div
            style={{ x: rightPodX, y: bottomPodY }}
            className="hidden xl:block absolute -right-10 -bottom-6 z-20 w-56"
          >
            <FloatingElement amplitude={7} duration={6.4} delay={0.4}>
              <div className="flex flex-col gap-2 rounded-2xl border border-slate-200/90 glass-panel p-4 shadow-xl shadow-blue-900/10 dark:border-slate-700">
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-blue-600 dark:text-blue-400">
                  <Layers className="h-3.5 w-3.5" />
                  MULTIMODAL FUSION
                </div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">
                  Duplicate Similarity Scoring
                </p>
                <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                  Image + NLP + Geo + Time
                </span>
              </div>
            </FloatingElement>
          </motion.div>

          {/* Main Central 3D Flying Console */}
          <motion.div
            style={{
              rotateX: deckRotateX,
              rotateY: deckRotateY,
              scale: deckScale,
              y: deckY,
              opacity: deckOpacity,
              transformStyle: "preserve-3d",
            }}
            className="rounded-3xl border border-slate-200/90 bg-white/95 shadow-2xl shadow-blue-950/15 overflow-hidden dark:border-slate-700/80 dark:bg-slate-900/95 dark:shadow-cyan-500/10"
          >
            {/* Window Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-slate-100/70 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-950/80">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span className="ml-2 font-mono text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                  LIFE SIGNAL · ARCHITECTURE WORKSPACE PREVIEW
                </span>
              </div>

              {/* Interactive LayoutId Tab Switcher */}
              <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
                {(
                  [
                    { id: "spatial", label: "Spatial Grid" },
                    { id: "vision", label: "Vision & ECE" },
                    { id: "priority", label: "Priority Engine" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative rounded-lg px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                      activeTab === tab.id
                        ? "text-white"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    }`}
                  >
                    {activeTab === tab.id && (
                      <motion.span
                        layoutId="showcase-tab-pill"
                        transition={{ type: "spring", stiffness: 360, damping: 30 }}
                        className="absolute inset-0 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500"
                      />
                    )}
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive Tab Viewport */}
            <div className="grid gap-6 p-6 md:grid-cols-12 md:p-8">
              <div className="md:col-span-7 rounded-2xl border border-slate-200/80 bg-slate-950 p-5 text-white relative overflow-hidden min-h-[260px] flex flex-col justify-between dark:border-slate-800">
                <div className="absolute inset-0 bg-grid-pattern opacity-40" />
                <div className="relative z-10 flex items-center justify-between">
                  <span className="font-mono text-xs text-cyan-400 flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5" />
                    {activeTab === "spatial"
                      ? "POSTGIS + DBSCAN CLUSTER TOPOLOGY"
                      : activeTab === "vision"
                        ? "YOLO + TEMPERATURE CALIBRATION PIPELINE"
                        : "6-FACTOR EXPLAINABLE PRIORITY MATRIX"}
                  </span>
                  <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-0.5 font-mono text-[10px] text-cyan-300">
                    MODULE ACTIVE
                  </span>
                </div>

                {/* Visual schematic per tab */}
                {activeTab === "spatial" && (
                  <div className="relative z-10 my-4 flex items-center justify-center">
                    <div className="relative h-36 w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900/70 p-4 flex items-center justify-around">
                      <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-cyan-400/50 bg-cyan-400/10">
                        <span className="absolute inset-0 rounded-full border border-cyan-400/50 animate-pulse-ring" />
                        <span className="h-3 w-3 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee]" />
                      </div>
                      <div className="space-y-1.5 text-xs font-mono">
                        <div className="text-cyan-300">EPSG:4326 Geography</div>
                        <div className="text-slate-300">Haversine eps = 250m</div>
                        <div className="text-slate-400">GIST Spatial Index Ready</div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "vision" && (
                  <div className="relative z-10 my-4 grid grid-cols-2 gap-3 text-xs font-mono">
                    <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-3 space-y-1">
                      <span className="text-slate-400">Detection Classes</span>
                      <p className="text-cyan-300 font-semibold">5 Road Hazard Types</p>
                      <p className="text-[11px] text-slate-400">Pothole, Longitudinal, Transverse, Alligator, Other</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-3 space-y-1">
                      <span className="text-slate-400">Uncertainty Gate</span>
                      <p className="text-emerald-400 font-semibold">ECE + MC Entropy</p>
                      <p className="text-[11px] text-slate-400">Flags low confidence for human review</p>
                    </div>
                  </div>
                )}

                {activeTab === "priority" && (
                  <div className="relative z-10 my-4 space-y-2.5 text-xs font-mono">
                    {[
                      { label: "Hazard Danger Weight", w: "w-[88%]", color: "bg-rose-500" },
                      { label: "Location Corridor Tier", w: "w-[72%]", color: "bg-blue-500" },
                      { label: "Log-Bounded Corroboration", w: "w-[54%]", color: "bg-cyan-400" },
                    ].map((row) => (
                      <div key={row.label} className="space-y-1">
                        <div className="flex justify-between text-slate-300">
                          <span>{row.label}</span>
                          <span>Weighted</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div className={`h-full ${row.w} ${row.color} rounded-full`} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="relative z-10 flex items-center justify-between text-[11px] font-mono text-slate-400 border-t border-slate-800/90 pt-3">
                  <span>PostgreSQL + PostGIS Verified</span>
                  <span>Strict Server RBAC</span>
                </div>
              </div>

              <div className="md:col-span-5 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-cyan-300">
                    <Cpu className="h-4 w-4" />
                    End-to-End Pipeline Modules
                  </div>
                  <h3 className="font-display text-xl font-bold text-slate-950 dark:text-white">
                    {activeTab === "spatial"
                      ? "PostGIS + OpenStreetMap + DBSCAN"
                      : activeTab === "vision"
                        ? "Calibrated Vision & Uncertainty"
                        : "Explainable Priority & Forecasting"}
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {activeTab === "spatial"
                      ? "Every citizen report is stored with WGS84 PostGIS Geography points, clustered into spatial hotspots using exact Haversine DBSCAN, and rendered live on OpenStreetMap."
                      : activeTab === "vision"
                        ? "Raw YOLO confidences are separated from temperature-scaled calibrated probabilities and MC Dropout entropy—never presenting uncertain demo results as facts."
                        : "Maintainers inspect transparent factor weights, log-bounded corroboration, and Random Forest / XGBoost forecasts gated by real historical sufficiency."}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 text-xs text-slate-600 flex items-center gap-2.5 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-blue-600 dark:text-cyan-400" />
                  <span>
                    Every submission generates a real ReportLab PDF receipt + QR tracking link.
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

