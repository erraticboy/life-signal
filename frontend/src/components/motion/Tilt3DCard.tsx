import { motion, useMotionTemplate, useMotionValue, useSpring } from "framer-motion";
import { useRef, type MouseEvent, type ReactNode } from "react";

interface Tilt3DCardProps {
  children: ReactNode;
  className?: string;
  intensity?: number;
  glowColor?: string;
  floating?: boolean;
  floatDelay?: number;
}

export function Tilt3DCard({
  children,
  className = "",
  intensity = 11,
  glowColor = "rgba(6, 182, 212, 0.20)",
  floating = false,
  floatDelay = 0,
}: Tilt3DCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const rawRotateX = useMotionValue(0);
  const rawRotateY = useMotionValue(0);
  const mouseX = useMotionValue(50);
  const mouseY = useMotionValue(50);

  const rotateX = useSpring(rawRotateX, { stiffness: 220, damping: 24 });
  const rotateY = useSpring(rawRotateY, { stiffness: 220, damping: 24 });
  const spotlight = useMotionTemplate`radial-gradient(380px circle at ${mouseX}% ${mouseY}%, ${glowColor}, transparent 70%)`;

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;

    mouseX.set(px * 100);
    mouseY.set(py * 100);
    rawRotateX.set((0.5 - py) * intensity);
    rawRotateY.set((px - 0.5) * intensity);
  };

  const handleMouseLeave = () => {
    rawRotateX.set(0);
    rawRotateY.set(0);
    mouseX.set(50);
    mouseY.set(50);
  };

  return (
    <div className="perspective-1400 h-full">
      <motion.div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        animate={floating ? { y: [-4, 4, -4] } : undefined}
        transition={
          floating
            ? { duration: 5.5, delay: floatDelay, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.2 }
        }
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        whileHover={{ y: -5, scale: 1.01 }}
        className={`group relative rounded-2xl border border-slate-200/85 glass-panel shadow-sm transition-shadow duration-300 hover:shadow-2xl hover:shadow-blue-600/15 dark:border-slate-800/90 dark:hover:border-cyan-400/45 dark:hover:shadow-cyan-500/15 ${className}`}
      >
        <motion.div
          aria-hidden="true"
          style={{ background: spotlight }}
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        />
        <div className="relative z-10 h-full" style={{ transform: "translateZ(16px)" }}>
          {children}
        </div>
      </motion.div>
    </div>
  );
}
