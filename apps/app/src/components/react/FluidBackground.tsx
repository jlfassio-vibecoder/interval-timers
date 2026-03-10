/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const STAR_COUNT = 6;

const StarField = () => {
  const [stars, setStars] = useState<
    Array<{
      id: number;
      size: number;
      x: number;
      y: number;
      duration: number;
      delay: number;
      opacity: number;
    }>
  >([]);

  useEffect(() => {
    setStars(
      Array.from({ length: STAR_COUNT }).map((_, i) => ({
        id: i,
        size: Math.random() * 2 + 1,
        x: Math.random() * 100,
        y: Math.random() * 100,
        duration: Math.random() * 3 + 2,
        delay: Math.random() * 2,
        opacity: Math.random() * 0.7 + 0.3,
      }))
    );
  }, []);

  if (stars.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      {stars.map((star) => (
        <motion.div
          key={star.id}
          className="absolute rounded-full bg-orange-light"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.size,
            height: star.size,
            transform: 'translateZ(0)',
          }}
          initial={{ opacity: star.opacity, scale: 1 }}
          animate={{
            opacity: [star.opacity, 1, star.opacity],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: star.duration * 2,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: star.delay,
          }}
        />
      ))}
    </div>
  );
};

const FluidBackground: React.FC = () => {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mq.matches);
    const handler = () => setReduceMotion(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-gradient-to-br from-[#1a0a00] via-bg-dark to-black">
      {!reduceMotion && <StarField />}

      {reduceMotion ? (
        <>
          {/* Static blobs when reduced motion preferred */}
          <div
            className="absolute left-[-10%] top-[-10%] h-[90vw] w-[90vw] rounded-full bg-orange-light opacity-[0.015] blur-[24px]"
            style={{ transform: 'translate(25px,-12px)' }}
          />
          <div
            className="absolute right-[-20%] top-[20%] h-[80vw] w-[100vw] rounded-full bg-[#ffa500] opacity-[0.012] blur-[24px]"
            style={{ transform: 'translate(-25px,25px)' }}
          />
          <div
            className="absolute bottom-[-20%] left-[20%] h-[80vw] w-[80vw] rounded-full bg-[#ff4000] opacity-[0.012] blur-[24px]"
            style={{ transform: 'translate(37px,-25px)' }}
          />
        </>
      ) : (
        <>
          {/* Blob 1: Amber - reduced blur for INP */}
          <motion.div
            className="absolute left-[-10%] top-[-10%] h-[90vw] w-[90vw] rounded-full bg-orange-light opacity-[0.015] mix-blend-screen blur-[24px] filter"
            animate={{ x: [0, 50, -25, 0], y: [0, -25, 25, 0] }}
            transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
            style={{ transform: 'translateZ(0)' }}
          />
          {/* Blob 2: Orange */}
          <motion.div
            className="absolute right-[-20%] top-[20%] h-[80vw] w-[100vw] rounded-full bg-[#ffa500] opacity-[0.012] mix-blend-screen blur-[24px] filter"
            animate={{ x: [0, -50, 25, 0], y: [0, 50, -25, 0] }}
            transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
            style={{ transform: 'translateZ(0)' }}
          />
          {/* Blob 3: Red-Orange */}
          <motion.div
            className="absolute bottom-[-20%] left-[20%] h-[80vw] w-[80vw] rounded-full bg-[#ff4000] opacity-[0.012] mix-blend-screen blur-[24px] filter"
            animate={{ x: [0, 75, -75, 0], y: [0, -50, 50, 0] }}
            transition={{ duration: 35, repeat: Infinity, ease: 'easeInOut' }}
            style={{ transform: 'translateZ(0)' }}
          />
        </>
      )}

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at center, transparent, rgba(0,0,0,0.1), rgba(0,0,0,0.8))',
        }}
      />
    </div>
  );
};

export default FluidBackground;
