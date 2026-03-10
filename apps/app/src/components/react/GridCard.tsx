/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GridCard = only the header card: photo background, overlay, and content
 * (e.g. title, subtitle, % circle). Nothing else. Rounded corners, own border.
 * Parent supplies main card border and p-[2px] so this card sits 2px inside.
 */

import React from 'react';

export const DEFAULT_PROGRAM_IMAGE = '/images/gym-barbell-squat-001.jpg';

export interface GridCardProps {
  /** URL for the header background image. */
  headerImage: string;
  /** Optional alt for the header image. */
  headerImageAlt?: string;
  /** Content over the image: left side (title, subtitle) + right side (% circle). */
  headerContent: React.ReactNode;
  /** Optional class for the card (border color, etc.). */
  className?: string;
  /** Optional class for the header content wrapper. */
  headerClassName?: string;
}

const GridCard: React.FC<GridCardProps> = ({
  headerImage,
  headerImageAlt = '',
  headerContent,
  className = '',
  headerClassName = '',
}) => {
  return (
    <div
      className={`group relative flex h-40 w-full items-center overflow-hidden rounded-3xl border px-8 shadow-2xl transition-all ${className}`}
    >
      <div className="absolute inset-0 overflow-hidden">
        <img
          src={headerImage}
          alt={headerImageAlt}
          width={800}
          height={320}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover opacity-20 grayscale transition-all duration-700 group-hover:scale-105 group-hover:opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent" />
      </div>

      {/* Left: title/subtitle; right: % circle */}
      <div
        className={`relative z-10 flex w-full flex-1 items-center justify-between gap-4 ${headerClassName}`}
      >
        {headerContent}
      </div>
    </div>
  );
};

export default GridCard;
