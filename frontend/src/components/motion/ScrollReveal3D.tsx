import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface ScrollReveal3DProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "left" | "right";
}

export function ScrollReveal3D({
  children,
  className = "",
  delay = 0,
  direction = "up",
}: ScrollReveal3DProps) {
  const initialX = direction === "left" ? -24 : direction === "right" ? 24 : 0;
  const initialY = direction === "up" ? 24 : 8;

  return (
    <div className="perspective-1400">
      <motion.div
        initial={{
          opacity: 0,
          x: initialX,
          y: initialY,
          rotateX: 10,
          scale: 0.97,
        }}
        whileInView={{
          opacity: 1,
          x: 0,
          y: 0,
          rotateX: 0,
          scale: 1,
        }}
        viewport={{ once: true, amount: 0.14 }}
        transition={{
          duration: 0.45,
          delay,
          ease: [0.22, 1, 0.36, 1],
        }}
        style={{ transformStyle: "preserve-3d" }}
        className={className}
      >
        {children}
      </motion.div>
    </div>
  );
}

