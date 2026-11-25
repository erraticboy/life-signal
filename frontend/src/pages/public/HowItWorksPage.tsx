import { motion, useScroll, useSpring } from "framer-motion";
import { useRef } from "react";
import { Footer } from "../../components/layout/Footer";
import { Navbar } from "../../components/layout/Navbar";
import { CyberBackdrop } from "../../components/motion/CyberBackdrop";
import { FloatingElement } from "../../components/motion/FloatingElement";
import { ScrollReveal3D } from "../../components/motion/ScrollReveal3D";
import { ScrollTelemetryBar } from "../../components/motion/ScrollTelemetryBar";
import { Tilt3DCard } from "../../components/motion/Tilt3DCard";
import { Badge } from "../../components/ui/Badge";

const stages = [
  {
    step: "01",
    title: "Verified Identity & Intake",
    body: "Citizens sign in with their Google account or verified email via Firebase Auth. FastAPI validates the ID token and provisions their PostgreSQL profile.",
  },
  {
    step: "02",
    title: "Geo-Tagged Complaint + Photo",
    body: "Reporters submit issue title, description, category, validated image upload, and GPS coordinates via browser geolocation or interactive OpenStreetMap picker.",
  },
  {
    step: "03",
    title: "Official PDF Receipt & Email Dispatch",
    body: "Python ReportLab generates an official receipt with a QR tracking link, saves it to storage, and dispatches it as an SMTP attachment to the user's verified email.",
  },
  {
    step: "04",
    title: "Computer Vision, Uncertainty & Deduplication",
    body: "YOLO classifies road/infrastructure damage while uncertainty calibration flags low-confidence predictions. Multimodal similarity detects duplicate candidates without deleting records.",
  },
  {
    step: "05",
    title: "DBSCAN Hotspots & Explainable Priority",
    body: "PostGIS spatial queries and DBSCAN highlight recurring clusters, while explainable scoring and Random Forest / XGBoost forecasting support municipal maintenance planning.",
  },
];

export function HowItWorksPage() {
  const timelineRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: timelineRef,
    offset: ["start center", "end end"],
  });
  const lineScaleY = useSpring(scrollYProgress, { stiffness: 140, damping: 24 });

  return (
    <div className="relative min-h-screen flex flex-col">
      <CyberBackdrop />
      <ScrollTelemetryBar />
      <Navbar />
      <main className="relative z-10 flex-1 mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8 space-y-12">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <FloatingElement amplitude={3} duration={4.6}>
            <Badge tone="cyan">Workflow Pipeline</Badge>
          </FloatingElement>
          <h1 className="font-display text-3xl font-bold text-slate-950 sm:text-4xl dark:text-white">
            How LIFE SIGNAL Works
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-300">
            End-to-end architecture from verified citizen complaint registration to municipal analytics.
          </p>
        </motion.div>

        <div ref={timelineRef} className="relative pl-6 sm:pl-8 space-y-6">
          <div className="absolute top-2 bottom-2 left-2 w-[2px] bg-slate-200 dark:bg-slate-800" />
          <motion.div
            style={{ scaleY: lineScaleY }}
            className="absolute top-2 bottom-2 left-2 w-[2px] origin-top bg-gradient-to-b from-blue-600 via-cyan-400 to-blue-500 shadow-[0_0_12px_rgba(6,182,212,0.8)]"
          />

          {stages.map((item, idx) => (
            <ScrollReveal3D key={item.step} delay={idx * 0.06} direction="left">
              <div className="relative">
                <span className="absolute -left-[25px] sm:-left-[33px] top-6 h-3 w-3 rounded-full border-2 border-white bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.7)] dark:border-slate-950 dark:bg-cyan-400" />
                <Tilt3DCard floating floatDelay={idx * 0.3} className="p-6 flex flex-col sm:flex-row gap-4 sm:items-start">
                  <span className="font-mono text-sm font-bold text-blue-600 dark:text-cyan-400 shrink-0 pt-0.5">
                    STAGE {item.step}
                  </span>
                  <div className="space-y-1.5">
                    <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{item.title}</h2>
                    <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{item.body}</p>
                  </div>
                </Tilt3DCard>
              </div>
            </ScrollReveal3D>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
