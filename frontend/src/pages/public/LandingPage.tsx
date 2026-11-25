import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Database,
  FileText,
  Layers,
  MapPin,
  Radar,
  ScanEye,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Footer } from "../../components/layout/Footer";
import { Navbar } from "../../components/layout/Navbar";
import { CyberBackdrop } from "../../components/motion/CyberBackdrop";
import { FloatingElement } from "../../components/motion/FloatingElement";
import { FlyingDashboardShowcase } from "../../components/motion/FlyingDashboardShowcase";
import { HolographicCityCanvas } from "../../components/motion/HolographicCityCanvas";
import { ScrollReveal3D } from "../../components/motion/ScrollReveal3D";
import { ScrollTelemetryBar } from "../../components/motion/ScrollTelemetryBar";
import { Tilt3DCard } from "../../components/motion/Tilt3DCard";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { useAuth } from "../../contexts/AuthContext";
import { apiClient } from "../../lib/api";
import type { SystemConfigStatus } from "../../types/auth";

const capabilities = [
  {
    icon: ScanEye,
    title: "Uncertainty-Aware Vision",
    description:
      "Detects potholes and road cracks while separating raw confidence from calibrated ECE certainty so ambiguous cases route to human review.",
    tag: "CV + ECE",
  },
  {
    icon: Layers,
    title: "Multimodal Deduplication",
    description:
      "Fuses visual descriptors, Sentence Transformers / TF-IDF semantics, Haversine distance, and timestamps to surface candidate duplicates.",
    tag: "NLP + IMAGE",
  },
  {
    icon: FileText,
    title: "Official PDF Receipts & SMTP",
    description:
      "Every complaint generates a verifiable ReportLab PDF receipt with a QR tracking URL and dispatches it to the reporter's email.",
    tag: "REPORTLAB",
  },
  {
    icon: MapPin,
    title: "PostGIS + DBSCAN Hotspots",
    description:
      "Spatial indexing in PostgreSQL/PostGIS powers DBSCAN hotspot clustering, explainable priority scoring, and demand forecasting.",
    tag: "SPATIAL ML",
  },
];

const categories = [
  "Road potholes",
  "Road cracks",
  "Garbage accumulation",
  "Broken streetlights",
  "Water leakage",
  "Damaged public infrastructure",
  "Open or damaged manholes",
];

export function LandingPage() {
  const { profile, isConfigured: firebaseClientConfigured } = useAuth();
  const [sysStatus, setSysStatus] = useState<SystemConfigStatus | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    apiClient
      .getConfigStatus()
      .then((res) => {
        if (mounted) {
          setSysStatus(res);
          setApiError(null);
        }
      })
      .catch((err) => {
        if (mounted) {
          setApiError(err instanceof Error ? err.message : "Backend API unreachable");
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const primaryActionPath = profile
    ? profile.role === "admin"
      ? "/admin/dashboard"
      : "/citizen/dashboard"
    : "/register";

  return (
    <div className="relative min-h-screen flex flex-col">
      <CyberBackdrop />
      <ScrollTelemetryBar />
      <Navbar />

      <main className="relative z-10 flex-1">
        {/* Futuristic 3D Hero */}
        <section className="relative overflow-hidden border-b border-slate-200/80 dark:border-slate-800/80">
          <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
            <div className="grid items-center gap-12 lg:grid-cols-12">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="lg:col-span-7 space-y-6"
              >
                <FloatingElement amplitude={3} duration={4.8}>
                  <Badge tone="cyan" className="shadow-sm shadow-cyan-500/15">
                    <Activity className="h-3.5 w-3.5 animate-pulse" />
                    Urban Infrastructure Intelligence Platform
                  </Badge>
                </FloatingElement>

                <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl dark:text-white">
                  Report Problems.
                  <br />
                  Discover Patterns.
                  <br />
                  <span className="bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
                    Build Better Cities.
                  </span>
                </h1>

                <p className="max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300">
                  LIFE SIGNAL pairs verified citizen reporting with computer vision, calibrated AI
                  uncertainty, multimodal duplicate detection, and PostGIS geospatial analytics so
                  municipalities prioritize real infrastructure hazards fast.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Link to={primaryActionPath}>
                    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                      <Button size="lg" className="shadow-xl shadow-blue-600/30">
                        {profile ? "Open Command Workspace" : "Launch Platform"}
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </motion.div>
                  </Link>
                  <Link to="/how-it-works">
                    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                      <Button variant="secondary" size="lg">
                        Explore Pipeline
                      </Button>
                    </motion.div>
                  </Link>
                </div>
              </motion.div>

              {/* Interactive 3D Holographic Sensor Lattice + Orbiting Floating Chips */}
              <motion.div
                initial={{ opacity: 0, scale: 0.92, rotateY: -8 }}
                animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="lg:col-span-5 relative perspective-1400"
              >
                <FloatingElement amplitude={5} duration={6.5}>
                  <div className="relative h-[330px] sm:h-[370px] w-full overflow-hidden rounded-3xl border border-slate-200/90 glass-panel shadow-2xl shadow-blue-900/15 dark:border-cyan-500/30 dark:shadow-cyan-500/15">
                    <HolographicCityCanvas />
                    <div className="relative z-10 flex h-full flex-col justify-between p-5 pointer-events-none">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] font-semibold text-blue-700 dark:text-cyan-300 flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                          3D SPATIAL MESH
                        </span>
                        <Badge tone="neutral">Interactive Orbit</Badge>
                      </div>
                      <div className="rounded-xl border border-slate-200/70 bg-white/85 p-3 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80">
                        <p className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                          PostGIS SRID 4326 · DBSCAN BallTree · ReportLab QR Receipts
                        </p>
                      </div>
                    </div>
                  </div>
                </FloatingElement>

                <FloatingElement
                  amplitude={7}
                  duration={4.8}
                  delay={0.5}
                  className="hidden sm:block absolute -top-4 -right-3 z-20"
                >
                  <div className="rounded-xl border border-cyan-300/60 glass-panel px-3 py-2 shadow-lg shadow-cyan-500/15 dark:border-cyan-500/40">
                    <span className="font-mono text-[11px] font-semibold text-cyan-700 dark:text-cyan-300 flex items-center gap-1.5">
                      <Radar className="h-3.5 w-3.5" />
                      ECE + MC Entropy
                    </span>
                  </div>
                </FloatingElement>
              </motion.div>
            </div>

            {/* Levitating 3D Runtime Diagnostics Strip */}
            <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Tilt3DCard floating floatDelay={0} className="p-5">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>FastAPI Backend</span>
                  <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-cyan-400" />
                </div>
                <p className="mt-2 font-mono text-sm font-semibold text-slate-900 dark:text-white">
                  {sysStatus ? "Connected" : apiError ? "Offline" : "Checking..."}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {sysStatus ? `Env: ${sysStatus.environment}` : "Port 8000 REST v1"}
                </p>
              </Tilt3DCard>

              <Tilt3DCard floating floatDelay={0.4} className="p-5">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>PostgreSQL + PostGIS</span>
                  <Database className="h-4 w-4 text-blue-600 dark:text-cyan-400" />
                </div>
                <p className="mt-2 font-mono text-sm font-semibold text-slate-900 dark:text-white">
                  {sysStatus
                    ? sysStatus.database_connected && sysStatus.postgis_enabled
                      ? "Ready"
                      : sysStatus.database_connected
                        ? "PostGIS Pending"
                        : "Setup Needed"
                    : "Pending"}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Spatial Geography(POINT, 4326)
                </p>
              </Tilt3DCard>

              <Tilt3DCard floating floatDelay={0.8} className="p-5">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Google + Firebase Auth</span>
                  <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-cyan-400" />
                </div>
                <p className="mt-2 font-mono text-sm font-semibold text-slate-900 dark:text-white">
                  {firebaseClientConfigured && sysStatus?.firebase_configured
                    ? "Verified Ready"
                    : sysStatus?.dev_auth_enabled
                      ? "Dev Auth Active"
                      : "Keys Required"}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {firebaseClientConfigured && sysStatus?.firebase_configured
                    ? "Client SDK + Token Verify"
                    : sysStatus?.dev_auth_enabled
                      ? "Local Dev JWT (Firebase Optional)"
                      : "Client SDK + Token Verify"}
                </p>
              </Tilt3DCard>

              <Tilt3DCard floating floatDelay={1.2} className="p-5">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Monitored Categories</span>
                  <MapPin className="h-4 w-4 text-blue-600 dark:text-cyan-400" />
                </div>
                <p className="mt-2 font-mono text-sm font-semibold text-slate-900 dark:text-white">
                  7 Urban Issue Types
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Strict RBAC Citizen &amp; Admin
                </p>
              </Tilt3DCard>
            </div>
          </div>
        </section>

        {/* Scroll-Driven 3D Flying Dashboard Showcase */}
        <FlyingDashboardShowcase />

        {/* Capabilities with ScrollReveal3D + 3D Tilt */}
        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <ScrollReveal3D className="max-w-2xl space-y-2">
            <Badge tone="blue">
              <Sparkles className="h-3.5 w-3.5" />
              Core Architecture
            </Badge>
            <h2 className="font-display text-2xl font-bold text-slate-950 sm:text-3xl dark:text-white">
              Engineered for Reliability and Research Rigor
            </h2>
            <p className="text-sm text-slate-600 sm:text-base dark:text-slate-400">
              Every module separates raw model outputs from verified facts, preserves human oversight, and
              maintains a full audit trail.
            </p>
          </ScrollReveal3D>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {capabilities.map((item, idx) => {
              const Icon = item.icon;
              return (
                <ScrollReveal3D key={item.title} delay={idx * 0.08}>
                  <Tilt3DCard floating floatDelay={idx * 0.35} className="p-6 h-full">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600/15 to-cyan-500/15 text-blue-600 ring-1 ring-blue-500/20 dark:text-cyan-400">
                          <Icon className="h-5 w-5" />
                        </div>
                        <Badge tone="cyan">{item.tag}</Badge>
                      </div>
                      <h3 className="text-lg font-semibold text-slate-950 dark:text-white">{item.title}</h3>
                      <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                        {item.description}
                      </p>
                    </div>
                  </Tilt3DCard>
                </ScrollReveal3D>
              );
            })}
          </div>
        </section>

        {/* Monitored Infrastructure Categories */}
        <section className="border-t border-slate-200/80 glass-panel dark:border-slate-800/80">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <ScrollReveal3D>
              <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
                <div className="space-y-2">
                  <h2 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
                    Supported Infrastructure Categories
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Structured reporting across critical municipal safety and roadway hazards.
                  </p>
                </div>
                <Link to="/about">
                  <Button variant="secondary" size="sm">
                    Explore Platform Architecture
                  </Button>
                </Link>
              </div>
            </ScrollReveal3D>

            <div className="mt-8 flex flex-wrap gap-3">
              {categories.map((cat, idx) => (
                <motion.span
                  key={cat}
                  initial={{ opacity: 0, y: 12, scale: 0.94 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.05 }}
                  whileHover={{ y: -4, scale: 1.04 }}
                  className="rounded-xl border border-slate-200/90 glass-panel px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:border-blue-500/60 dark:border-slate-700 dark:text-slate-200 dark:hover:border-cyan-400/60"
                >
                  {cat}
                </motion.span>
              ))}
            </div>
          </div>
        </section>

        {/* Futuristic Launch Portal Finale */}
        <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
          <ScrollReveal3D>
            <Tilt3DCard className="relative overflow-hidden p-10 text-center sm:p-14">
              <div className="relative z-10 mx-auto max-w-2xl space-y-5">
                <FloatingElement amplitude={4} duration={5}>
                  <Badge tone="cyan">Ready for Deployment</Badge>
                </FloatingElement>
                <h2 className="font-display text-3xl font-extrabold text-slate-950 sm:text-4xl dark:text-white">
                  Experience Next-Gen Urban Telemetry
                </h2>
                <p className="text-sm text-slate-600 sm:text-base dark:text-slate-300">
                  Sign in with Google, pin an infrastructure issue on OpenStreetMap, receive your
                  official ReportLab PDF receipt, and inspect live DBSCAN hotspots.
                </p>
                <div className="pt-2 flex flex-wrap justify-center gap-3">
                  <Link to={primaryActionPath}>
                    <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                      <Button size="lg" className="shadow-xl shadow-blue-600/30">
                        {profile ? "Enter Command Console" : "Get Started Now"}
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </motion.div>
                  </Link>
                </div>
              </div>
            </Tilt3DCard>
          </ScrollReveal3D>
        </section>
      </main>

      <Footer />
    </div>
  );
}
