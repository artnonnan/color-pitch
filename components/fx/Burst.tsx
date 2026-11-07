"use client";
// Full-screen particle layer. Anything can fire `burst(...)`; one canvas draws all.
import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 1 → 0
  decay: number;
  size: number;
  color: string;
  spark: boolean; // streak vs round dot
}

let particles: Particle[] = [];
let wake: (() => void) | null = null;

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Throw particles from (x, y) in viewport pixels. `power` 1 = a correct answer,
 * 2–3 = combos and unlocks.
 */
export function burst(colors: string | string[], x: number, y: number, power = 1) {
  if (reducedMotion()) return;
  const cs = Array.isArray(colors) ? colors : [colors];
  const n = Math.round(26 * power);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const speed = (2 + Math.random() * 6) * (0.7 + power * 0.35);
    particles.push({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed - 2.5,
      life: 1,
      decay: 0.012 + Math.random() * 0.02,
      size: 2 + Math.random() * 4 * Math.min(power, 2),
      color: cs[i % cs.length],
      spark: Math.random() < 0.45,
    });
  }
  if (particles.length > 900) particles = particles.slice(-900);
  wake?.();
}

/** Drop all particles and pending fireworks (e.g. when the screen changes). */
const pending = new Set<number>();
export function clearBursts() {
  particles = [];
  pending.forEach((id) => window.clearTimeout(id));
  pending.clear();
}

/** Burst from the centre of an element (e.g. the key that was tapped). */
export function burstFrom(el: Element | null, colors: string | string[], power = 1) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  burst(colors, r.left + r.width / 2, r.top + r.height * 0.35, power);
}

/** Several bursts across the screen over ~1.5 s. */
export function fireworks(colors: string[], shots = 7) {
  if (reducedMotion() || typeof window === "undefined") return;
  for (let i = 0; i < shots; i++) {
    const id = window.setTimeout(() => {
      pending.delete(id);
      const x = window.innerWidth * (0.15 + Math.random() * 0.7);
      const y = window.innerHeight * (0.15 + Math.random() * 0.45);
      burst(colors[i % colors.length], x, y, 1.8 + Math.random());
    }, i * 220);
    pending.add(id);
  }
}

export function BurstLayer() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let running = false;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const frame = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "lighter";
      for (const p of particles) {
        p.vy += 0.14; // gravity
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0) continue;
        ctx.globalAlpha = Math.min(1, p.life * 1.4);
        ctx.fillStyle = p.color;
        ctx.strokeStyle = p.color;
        if (p.spark) {
          ctx.lineWidth = p.size * 0.6;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * p.life + 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      particles = particles.filter((p) => p.life > 0);
      if (particles.length) raf = requestAnimationFrame(frame);
      else {
        running = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
    wake = () => {
      if (!running) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    };
    return () => {
      wake = null;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-[60] h-full w-full" />;
}
