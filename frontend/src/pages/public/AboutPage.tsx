import { motion } from "framer-motion";
import { Shield, Sparkles, Target } from "lucide-react";
import { Footer } from "../../components/layout/Footer";
import { Navbar } from "../../components/layout/Navbar";
import { CyberBackdrop } from "../../components/motion/CyberBackdrop";
import { FloatingElement } from "../../components/motion/FloatingElement";
import { ScrollReveal3D } from "../../components/motion/ScrollReveal3D";
import { ScrollTelemetryBar } from "../../components/motion/ScrollTelemetryBar";
import { Tilt3DCard } from "../../components/motion/Tilt3DCard";
import { Badge } from "../../components/ui/Badge";

const techStack = [
  "React 19 + TypeScript",
  "Framer Motion 3D",
  "FastAPI + Pydantic v2",
  "PostgreSQL + PostGIS",
  "Firebase Google OAuth",
  "Ultralytics YOLO + OpenCV",
  "ECE + MC Dropout",
  "DBSCAN + Random Forest",
  "ReportLab PDF + QR",
];

export function AboutPage() {
  const pillars = [
    {
      icon: Target,
      title: "Evidence-First Intake",
      body: "Every submission captures photographs, exact GPS coordinates, timestamps, and issues an official ReportLab PDF receipt with a QR tracking code.",
    },
    {
      icon: Sparkles,
      title: "Uncertainty Awareness",
      body: "Raw object detection confidence is separated from calibrated uncertainty metrics (ECE / MC Dropout) so ambiguous images always trigger human verification.",
    },
    {
      icon: Shield,
      title: "Strict Role Security",
      body: "Firebase ID tokens are cryptographically verified on FastAPI. Citizen and Administrator boundaries are enforced server-side with full audit logging.",
    },
  ];

  return (
    <div className="relative min-h-screen flex flex-col">
      <CyberBackdrop />
      <ScrollTelemetryBar />
      <Navbar />
      <main className="relative z-10 flex-1 mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8 space-y-12">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <FloatingElement amplitude={3} duration={4.5}>
            <Badge tone="blue">About LIFE SIGNAL</Badge>
          </FloatingElement>
          <h1 className="font-display text-3xl font-bold text-slate-950 sm:text-4xl dark:text-white">
            Bridging Citizen Reporting and Explainable Urban AI
          </h1>
          <p className="text-base leading-relaxed text-slate-600 dark:text-slate-300">
            LIFE SIGNAL is built as both a research-grade AIML engineering system and a deployable municipal
            SaaS platform. Instead of letting citizen complaints sit in disconnected spreadsheets, every issue
            becomes structured geospatial evidence backed by verifiable documents and calibrated models.
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-3">
          {pillars.map((item, idx) => {
            const Icon = item.icon;
            return (
              <ScrollReveal3D key={item.title} delay={idx * 0.08}>
                <Tilt3DCard floating floatDelay={idx * 0.4} className="p-6 h-full space-y-3">
                  <Icon className="h-6 w-6 text-blue-600 dark:text-cyan-400" />
                  <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{item.title}</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{item.body}</p>
                </Tilt3DCard>
              </ScrollReveal3D>
            );
          })}
        </div>

        <ScrollReveal3D>
          <Tilt3DCard className="p-8 space-y-5">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              Full-Stack Architecture &amp; Research Stack
            </h2>
            <div className="flex flex-wrap gap-2.5">
              {techStack.map((item, idx) => (
                <motion.span
                  key={item}
                  initial={{ opacity: 0, scale: 0.92 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.04 }}
                  whileHover={{ y: -3, scale: 1.04 }}
                  className="rounded-xl border border-slate-200/80 glass-panel px-3.5 py-2 font-mono text-xs font-medium text-slate-800 dark:border-slate-700 dark:text-cyan-300"
                >
                  {item}
                </motion.span>
              ))}
            </div>
          </Tilt3DCard>
        </ScrollReveal3D>
      </main>
      <Footer />
    </div>
  );
}
