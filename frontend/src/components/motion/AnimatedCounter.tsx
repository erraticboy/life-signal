import { useEffect, useState } from "react";

interface AnimatedCounterProps {
  value: number | string;
  durationMs?: number;
}

export function AnimatedCounter({ value, durationMs = 650 }: AnimatedCounterProps) {
  const numericTarget = typeof value === "number" ? value : Number.NaN;
  const [display, setDisplay] = useState<number>(0);

  useEffect(() => {
    if (Number.isNaN(numericTarget)) return;
    let raf = 0;
    const start = performance.now();
    const from = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (numericTarget - from) * eased));
      if (progress < 1) {
        raf = window.requestAnimationFrame(tick);
      }
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [numericTarget, durationMs]);

  if (typeof value !== "number" || Number.isNaN(numericTarget)) {
    return <>{value}</>;
  }
  return <>{display}</>;
}

