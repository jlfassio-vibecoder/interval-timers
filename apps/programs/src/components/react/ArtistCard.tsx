/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'framer-motion';
import type { Artist } from '@/types';
import { ArrowUpRight, Play } from 'lucide-react';
import IntensityBars from './IntensityBars';

/** Used with ?url imports to avoid /_image 500 in production; width/height optional */
export interface OptimizedImageMeta {
  src: string;
  width?: number;
  height?: number;
}

interface ArtistCardProps {
  artist: Artist;
  onClick: () => void;
  optimizedImage?: OptimizedImageMeta;
}

const ArtistCard: React.FC<ArtistCardProps> = ({ artist, onClick, optimizedImage }) => {
  return (
    <motion.div
      className="group relative z-10 h-[400px] w-full cursor-pointer overflow-hidden border-b border-white/10 bg-black md:h-[500px] md:border-r"
      initial="rest"
      whileHover="hover"
      whileTap="hover"
      animate="rest"
      data-hover="true"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Image Background with Zoom */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.img
          src={optimizedImage?.src ?? artist.image}
          alt={artist.name}
          width={optimizedImage?.width}
          height={optimizedImage?.height}
          loading={optimizedImage ? 'lazy' : undefined}
          decoding={optimizedImage ? 'async' : undefined}
          className="h-full w-full object-cover grayscale will-change-transform"
          variants={{
            rest: { scale: 1, opacity: 0.6, filter: 'grayscale(100%)' },
            hover: { scale: 1.05, opacity: 0.9, filter: 'grayscale(0%)' },
          }}
          transition={{ duration: 0.6, ease: [0.33, 1, 0.68, 1] }}
        />
        <div className="group-hover:bg-orange-medium/20 absolute inset-0 bg-black/30 transition-colors duration-500" />
      </div>

      {/* Overlay Info */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-6 md:p-8">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-widest opacity-60">
              Intensity
            </span>
            <IntensityBars level={artist.intensity} />
          </div>
          <motion.div
            variants={{
              rest: { opacity: 0, x: 20, y: -20 },
              hover: { opacity: 1, x: 0, y: 0 },
            }}
            className="rounded-full bg-white p-2 text-black will-change-transform"
          >
            <ArrowUpRight className="h-6 w-6" />
          </motion.div>
        </div>

        <div className="flex items-end justify-between">
          <div>
            <div className="overflow-hidden">
              <motion.h3
                className="font-heading text-2xl font-bold uppercase text-white mix-blend-difference will-change-transform md:text-3xl"
                variants={{
                  rest: { y: 0 },
                  hover: { y: -5 },
                }}
                transition={{ duration: 0.4 }}
              >
                {artist.name}
              </motion.h3>
            </div>
            <motion.p
              className="mt-2 text-sm font-medium uppercase tracking-widest text-orange-light will-change-transform"
              variants={{
                rest: { opacity: 0, y: 10 },
                hover: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              {artist.genre}
            </motion.p>
          </div>

          <motion.div
            variants={{
              rest: { opacity: 0, x: 10 },
              hover: { opacity: 1, x: 0 },
            }}
            className="flex items-center gap-2 rounded border border-white/20 bg-black/80 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-tighter text-white shadow-xl backdrop-blur-sm"
          >
            Review Workout <Play className="h-3 w-3 fill-current" />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

export default ArtistCard;
