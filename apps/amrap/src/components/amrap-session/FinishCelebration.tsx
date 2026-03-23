/**
 * One-shot visual celebration when session finishes. Social only (gated by celebrateFinish).
 * Respects prefers-reduced-motion: skips confetti when user prefers reduced motion.
 */
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';

const PARTICLE_COUNT = 24;
const COLORS = ['#ffbf00', '#ff8c00', '#ff6b35', '#f7931e', '#ffcc33'];

function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mq.matches);
    const handler = () => setPrefersReduced(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return prefersReduced;
}

interface Particle {
  angle: number;
  distance: number;
  color: string;
  size: number;
  duration: number;
}

export default function FinishCelebration() {
  const prefersReduced = usePrefersReducedMotion();

  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      angle: (i / PARTICLE_COUNT) * Math.PI * 2 + Math.random() * 0.5,
      distance: 80 + Math.random() * 120,
      color: COLORS[i % COLORS.length],
      size: 6 + Math.random() * 6,
      duration: 0.6 + Math.random() * 0.3,
    }));
  }, []);

  if (prefersReduced) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
      aria-hidden
    >
      {particles.map((p, i) => {
        const x = Math.cos(p.angle) * p.distance;
        const y = Math.sin(p.angle) * p.distance;
        return (
          <motion.div
            key={i}
            className="absolute rounded-sm"
            style={{
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              boxShadow: `0 0 ${p.size}px ${p.color}`,
            }}
            initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            animate={{
              opacity: 0,
              x,
              y,
              scale: 0.3,
              transition: {
                duration: p.duration,
                ease: 'easeOut',
              },
            }}
          />
        );
      })}
    </div>
  );
}
