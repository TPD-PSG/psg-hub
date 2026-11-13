"use client";

import { useEffect, useRef } from "react";

type Season = "christmas" | "halloween" | "spring" | null;

function getSeason(): Season {
  const now = new Date();
  const m = now.getMonth() + 1; // 1-12
  const d = now.getDate();
  if ((m === 12 && d >= 1) || (m === 1 && d <= 5)) return "christmas";
  if (m === 10 && d >= 25) return "halloween";
  if ((m === 3 && d >= 20) || (m === 4 && d <= 10)) return "spring";
  return null;
}

// ── Particle definitions per season ─────────────────────────────────────────

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  opacity: number;
  wobble: number;
  wobbleSpeed: number;
  wobbleOffset: number;
  rotation: number;
  rotSpeed: number;
  emoji?: string;
}

function makeParticle(canvas: HTMLCanvasElement, season: Season): Particle {
  const x = Math.random() * canvas.width;
  const y = -20;
  if (season === "christmas") {
    return {
      x, y,
      vx: (Math.random() - 0.5) * 0.4,
      vy: 0.6 + Math.random() * 0.8,
      size: 2 + Math.random() * 3,
      opacity: 0.5 + Math.random() * 0.5,
      wobble: 0,
      wobbleSpeed: 0.02 + Math.random() * 0.02,
      wobbleOffset: Math.random() * Math.PI * 2,
      rotation: 0, rotSpeed: 0,
    };
  }
  if (season === "halloween") {
    const emojis = ["🦇", "🕷️", "🍂", "🍁"];
    return {
      x, y,
      vx: (Math.random() - 0.5) * 1.2,
      vy: 0.8 + Math.random() * 1,
      size: 14 + Math.random() * 10,
      opacity: 0.6 + Math.random() * 0.4,
      wobble: 0,
      wobbleSpeed: 0.03 + Math.random() * 0.03,
      wobbleOffset: Math.random() * Math.PI * 2,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.05,
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
    };
  }
  // spring
  const emojis = ["🌸", "🌺", "🌼", "🍃"];
  return {
    x, y,
    vx: (Math.random() - 0.5) * 0.8,
    vy: 0.5 + Math.random() * 0.7,
    size: 12 + Math.random() * 8,
    opacity: 0.5 + Math.random() * 0.5,
    wobble: 0,
    wobbleSpeed: 0.02 + Math.random() * 0.02,
    wobbleOffset: Math.random() * Math.PI * 2,
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.03,
    emoji: emojis[Math.floor(Math.random() * emojis.length)],
  };
}

const COUNTS: Record<NonNullable<Season>, number> = {
  christmas: 120,
  halloween: 30,
  spring: 25,
};

export default function SeasonalOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const season = getSeason();

  useEffect(() => {
    if (!season) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf: number;
    const count = COUNTS[season];
    const particles: Particle[] = [];

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    // Seed initial particles spread across the screen height
    for (let i = 0; i < count; i++) {
      const p = makeParticle(canvas, season);
      p.y = Math.random() * canvas.height; // already on screen at start
      particles.push(p);
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        p.wobble += p.wobbleSpeed;
        p.x += p.vx + Math.sin(p.wobble + p.wobbleOffset) * 0.5;
        p.y += p.vy;
        p.rotation += p.rotSpeed;

        if (p.y > canvas.height + 30) {
          // reset to top
          const fresh = makeParticle(canvas, season);
          Object.assign(p, fresh);
        }

        ctx.save();
        ctx.globalAlpha = p.opacity;

        if (p.emoji) {
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.font = `${p.size}px serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(p.emoji, 0, 0);
        } else {
          // snowflake: white circle with a soft blur
          ctx.translate(p.x, p.y);
          const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
          grad.addColorStop(0, "rgba(255,255,255,1)");
          grad.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      raf = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [season]);

  if (!season) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 9999,
        opacity: 0.75,
      }}
      aria-hidden="true"
    />
  );
}
