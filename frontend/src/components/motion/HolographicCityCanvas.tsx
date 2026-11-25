import { useEffect, useRef } from "react";

interface NodePoint {
  x: number;
  y: number;
  z: number;
  pulsePhase: number;
  isHotspot: boolean;
}

/**
 * Hardware-friendly interactive 3D wireframe infrastructure mesh & sensor pulse
 * projected onto HTML5 Canvas (zero heavy WebGL bundle overhead).
 */
export function HolographicCityCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let animationFrameId = 0;
    let pointerX = 0;
    let pointerY = 0;

    // Generate deterministic 3D lattice + urban signal nodes
    const nodes: NodePoint[] = [];
    const grid = 6;
    for (let gx = 0; gx < grid; gx++) {
      for (let gz = 0; gz < grid; gz++) {
        const nx = (gx - (grid - 1) / 2) * 58;
        const nz = (gz - (grid - 1) / 2) * 58;
        const wave = Math.sin(gx * 0.9) * Math.cos(gz * 0.8) * 34;
        const isHotspot = (gx === 2 && gz === 2) || (gx === 4 && gz === 1) || (gx === 1 && gz === 4);
        nodes.push({
          x: nx,
          y: isHotspot ? wave - 28 : wave + 24,
          z: nz,
          pulsePhase: (gx * 0.7 + gz * 1.1) % (Math.PI * 2),
          isHotspot,
        });
      }
    }

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = parent.clientWidth * dpr;
      canvas.height = parent.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const handlePointerMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerX = ((e.clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 0.45;
      pointerY = ((e.clientY - rect.top) / Math.max(rect.height, 1) - 0.5) * 0.35;
    };
    window.addEventListener("mousemove", handlePointerMove);

    let angle = 0.55;
    const render = (timeMs: number) => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      ctx.clearRect(0, 0, w, h);

      if (!prefersReduced) {
        angle += 0.0028;
      }

      const rotY = angle + pointerX;
      const rotX = 0.52 + pointerY * 0.5;
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      const focal = 460;
      const cx = w * 0.5;
      const cy = h * 0.52;

      const projected = nodes.map((n) => {
        // Rotate Y then X
        const x1 = n.x * cosY - n.z * sinY;
        const z1 = n.x * sinY + n.z * cosY;
        const y2 = n.y * cosX - z1 * sinX;
        const z2 = n.y * sinX + z1 * cosX;

        const scale = focal / (focal + z2 + 280);
        return {
          sx: cx + x1 * scale,
          sy: cy + y2 * scale,
          scale,
          depth: z2,
          isHotspot: n.isHotspot,
          pulsePhase: n.pulsePhase,
        };
      });

      const isDark = document.documentElement.classList.contains("dark");
      const lineStroke = isDark ? "rgba(56, 189, 248, 0.17)" : "rgba(37, 99, 235, 0.14)";

      // Draw structural grid links
      ctx.lineWidth = 1;
      ctx.strokeStyle = lineStroke;
      for (let gx = 0; gx < grid; gx++) {
        for (let gz = 0; gz < grid; gz++) {
          const i = gx * grid + gz;
          if (gx + 1 < grid) {
            const j = (gx + 1) * grid + gz;
            ctx.beginPath();
            ctx.moveTo(projected[i].sx, projected[i].sy);
            ctx.lineTo(projected[j].sx, projected[j].sy);
            ctx.stroke();
          }
          if (gz + 1 < grid) {
            const k = gx * grid + (gz + 1);
            ctx.beginPath();
            ctx.moveTo(projected[i].sx, projected[i].sy);
            ctx.lineTo(projected[k].sx, projected[k].sy);
            ctx.stroke();
          }
        }
      }

      // Draw vertical signal beacons & glowing nodes
      const t = timeMs * 0.0025;
      projected.forEach((p) => {
        const radius = Math.max(1.6, p.scale * (p.isHotspot ? 4.2 : 2.3));
        if (p.isHotspot) {
          const pulse = 0.5 + 0.5 * Math.sin(t + p.pulsePhase);
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, radius + 5 + pulse * 6, 0, Math.PI * 2);
          ctx.strokeStyle = isDark
            ? `rgba(6, 182, 212, ${0.42 - pulse * 0.25})`
            : `rgba(37, 99, 235, ${0.35 - pulse * 0.2})`;
          ctx.lineWidth = 1.4;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(p.sx, p.sy, radius, 0, Math.PI * 2);
          ctx.fillStyle = isDark ? "#22d3ee" : "#2563eb";
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, radius, 0, Math.PI * 2);
          ctx.fillStyle = isDark ? "rgba(148, 163, 184, 0.55)" : "rgba(59, 130, 246, 0.42)";
          ctx.fill();
        }
      });

      if (!prefersReduced) {
        animationFrameId = window.requestAnimationFrame(render);
      }
    };

    animationFrameId = window.requestAnimationFrame(render);
    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handlePointerMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-85"
    />
  );
}

