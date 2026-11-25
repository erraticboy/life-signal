import { motion } from "framer-motion";
import { Mail, Server, Terminal } from "lucide-react";
import { useEffect, useState } from "react";
import { Footer } from "../../components/layout/Footer";
import { Navbar } from "../../components/layout/Navbar";
import { CyberBackdrop } from "../../components/motion/CyberBackdrop";
import { FloatingElement } from "../../components/motion/FloatingElement";
import { ScrollReveal3D } from "../../components/motion/ScrollReveal3D";
import { ScrollTelemetryBar } from "../../components/motion/ScrollTelemetryBar";
import { Tilt3DCard } from "../../components/motion/Tilt3DCard";
import { Badge } from "../../components/ui/Badge";
import { StatusAlert } from "../../components/ui/StatusAlert";
import { apiClient } from "../../lib/api";
import { isFirebaseClientConfigured, missingFirebaseEnvVars } from "../../lib/firebase";
import type { SystemConfigStatus } from "../../types/auth";

export function ContactPage() {
  const [status, setStatus] = useState<SystemConfigStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .getConfigStatus()
      .then(setStatus)
      .catch((err) => setError(err instanceof Error ? err.message : "Backend unavailable"));
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col">
      <CyberBackdrop />
      <ScrollTelemetryBar />
      <Navbar />
      <main className="relative z-10 flex-1 mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8 space-y-10">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <FloatingElement amplitude={3} duration={4.8}>
            <Badge tone="blue">Deployment &amp; Environment</Badge>
          </FloatingElement>
          <h1 className="font-display text-3xl font-bold text-slate-950 sm:text-4xl dark:text-white">
            Contact &amp; System Readiness
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-300">
            Configure local credentials or deploy LIFE SIGNAL for municipal trials and academic evaluations.
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2">
          <ScrollReveal3D delay={0.05}>
            <Tilt3DCard floating floatDelay={0.1} className="p-6 h-full space-y-3">
              <Mail className="h-5 w-5 text-blue-600 dark:text-cyan-400" />
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Project Coordination</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                For municipal pilot setups, Firebase OAuth allowlisting, or research collaborations, configure
                your operator contact channels in the environment documentation.
              </p>
            </Tilt3DCard>
          </ScrollReveal3D>
          <ScrollReveal3D delay={0.12}>
            <Tilt3DCard floating floatDelay={0.5} className="p-6 h-full space-y-3">
              <Terminal className="h-5 w-5 text-blue-600 dark:text-cyan-400" />
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Documentation References</h2>
              <ul className="text-slate-600 dark:text-slate-400 space-y-1 font-mono text-xs">
                <li>• docs/FIREBASE_SETUP.md</li>
                <li>• docs/DATABASE_SETUP.md</li>
                <li>• docs/ARCHITECTURE.md</li>
              </ul>
            </Tilt3DCard>
          </ScrollReveal3D>
        </div>

        <ScrollReveal3D delay={0.18}>
          <Tilt3DCard className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-blue-600 dark:text-cyan-400" />
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                Live Environment Configuration Checklist
              </h2>
            </div>

            {error && (
              <StatusAlert variant="error" title="Backend API Unreachable">
                {error}
              </StatusAlert>
            )}

            {!isFirebaseClientConfigured && (
              <StatusAlert variant="warning" title="Frontend Firebase Keys Not Set">
                Missing in <code className="font-mono text-xs">frontend/.env</code>:{" "}
                <span className="font-mono text-xs">{missingFirebaseEnvVars.join(", ")}</span>
              </StatusAlert>
            )}

            {status && (
              <div className="space-y-3">
                {status.missing_requirements.length === 0 ? (
                  <StatusAlert variant="success" title="All Core Backend Services Ready">
                    PostgreSQL, PostGIS, Firebase Admin SDK, and SMTP are configured.
                  </StatusAlert>
                ) : (
                  <StatusAlert variant="info" title="Pending Backend Setup Steps">
                    <ul className="list-disc pl-4 space-y-1 text-xs">
                      {status.missing_requirements.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </StatusAlert>
                )}
              </div>
            )}
          </Tilt3DCard>
        </ScrollReveal3D>
      </main>
      <Footer />
    </div>
  );
}
