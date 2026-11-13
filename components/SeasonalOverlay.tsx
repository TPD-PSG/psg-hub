"use client";

import { useEffect, useRef, useState } from "react";

type Season = "christmas" | "halloween" | "spring" | "bonfire" | "newyear" | null;
type Intensity = "light" | "normal" | "heavy";

const INTENSITY_MULTIPLIER: Record<Intensity, number> = { light: 0.4, normal: 1, heavy: 2.2 };

function getAutoSeason(): Season {
  const now = new Date();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  if ((m === 12 && d >= 1) || (m === 1 && d <= 5)) return "christmas";
  if (m === 10 && d >= 25) return "halloween";
  if (m === 11 && d === 5) return "bonfire";
  if ((m === 12 && d >= 31) || (m === 1 && d <= 2)) return "newyear";
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
  if (season === "bonfire") {
    const emojis = ["✨", "💫", "🔥", "⭐"];
    return {
      x: Math.random() * canvas.width,
      y: canvas.height + 10,
      vx: (Math.random() - 0.5) * 2,
      vy: -(2 + Math.random() * 3),
      size: 10 + Math.random() * 8,
      opacity: 0.7 + Math.random() * 0.3,
      wobble: 0,
      wobbleSpeed: 0.04 + Math.random() * 0.04,
      wobbleOffset: Math.random() * Math.PI * 2,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.08,
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
    };
  }
  if (season === "newyear") {
    const emojis = ["🎉", "🎊", "⭐", "✨", "🌟"];
    return {
      x: Math.random() * canvas.width,
      y: -20,
      vx: (Math.random() - 0.5) * 1.5,
      vy: 1 + Math.random() * 1.5,
      size: 12 + Math.random() * 10,
      opacity: 0.7 + Math.random() * 0.3,
      wobble: 0,
      wobbleSpeed: 0.03 + Math.random() * 0.03,
      wobbleOffset: Math.random() * Math.PI * 2,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.06,
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
  bonfire: 40,
  newyear: 35,
};

export default function SeasonalOverlay({ previewSeason, previewIntensity }: { previewSeason?: Season | undefined; previewIntensity?: Intensity } = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [settingsSeason, setSettingsSeason] = useState<Season | "auto">("auto");
  const [settingsIntensity, setSettingsIntensity] = useState<Intensity>("normal");

  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then((d: Record<string, string>) => {
      if (d.seasonal_mode && d.seasonal_mode !== "auto") setSettingsSeason(d.seasonal_mode as Season);
      else setSettingsSeason("auto");
      if (d.seasonal_intensity) setSettingsIntensity(d.seasonal_intensity as Intensity);
    }).catch(() => {/* settings unavailable */});
  }, []);

  const resolvedSeason: Season = previewSeason !== undefined
    ? previewSeason
    : (settingsSeason === "auto" ? getAutoSeason() : settingsSeason as Season);
  const resolvedIntensity: Intensity = previewIntensity ?? settingsIntensity;
  const season = resolvedSeason;
  const intensityMultiplier = INTENSITY_MULTIPLIER[resolvedIntensity];

  useEffect(() => {
    if (!season) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf: number;
    const count = Math.round(COUNTS[season] * intensityMultiplier);
    const particles: Particle[] = [];

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    // Seed initial particles spread across the screen
    for (let i = 0; i < count; i++) {
      const p = makeParticle(canvas, season);
      if (season === "bonfire") {
        p.y = canvas.height - Math.random() * canvas.height;
      } else {
        p.y = Math.random() * canvas.height;
      }
      particles.push(p);
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        p.wobble += p.wobbleSpeed;
        p.x += p.vx + Math.sin(p.wobble + p.wobbleOffset) * 0.5;
        p.y += p.vy;
        p.rotation += p.rotSpeed;

        const escaped = season === "bonfire"
          ? p.y < -30
          : p.y > canvas.height + 30;
        if (escaped) {
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
  }, [season, intensityMultiplier]);

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
