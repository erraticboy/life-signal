import { motion } from "framer-motion";

interface CyberBackdropProps {
  subtle?: boolean;
}

/**
 * Volumetric floating neon aura orbs, drifting orbital rings, and architectural grid
 * giving every page an atmospheric 3D depth backdrop.
 */
export function CyberBackdrop({ subtle = false }: CyberBackdropProps) {
  const opacityClass = subtle ? "opacity-45" : "opacity-80";

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-0 overflow-hidden ${opacityClass}`}
    >
      <div className="absolute inset-0 bg-grid-pattern opacity-60 dark:opacity-50" />

      <motion.div
        animate={{
          x: [0, 35, -20, 0],
          y: [0, -28, 18, 0],
          scale: [1, 1.08, 0.96, 1],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-32 right-[8%] h-[420px] w-[420px] rounded-full bg-cyan-400/15 blur-3xl dark:bg-cyan-500/15"
      />

      <motion.div
        animate={{
          x: [0, -30, 24, 0],
          y: [0, 26, -18, 0],
          scale: [1, 0.94, 1.06, 1],
        }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[42%] -left-32 h-[440px] w-[440px] rounded-full bg-blue-600/14 blur-3xl dark:bg-blue-600/18"
      />

      <motion.div
        animate={{
          rotate: [0, 360],
        }}
        transition={{ duration: 48, repeat: Infinity, ease: "linear" }}
        className="hidden md:block absolute -bottom-56 right-[14%] h-[460px] w-[460px] rounded-full border border-dashed border-cyan-500/15 dark:border-cyan-400/15"
      />
    </div>
  );
}

