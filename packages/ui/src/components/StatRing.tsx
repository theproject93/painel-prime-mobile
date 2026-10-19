import React from 'react';
import { LUXURY_TOKENS } from '../branding';

export interface StatRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  subLabel?: string;
  ringColor?: string;
  trackColor?: string;
}

export function StatRing({
  percentage,
  size = 120,
  strokeWidth = 10,
  centerLabel,
  subLabel,
  ringColor = LUXURY_TOKENS.goldChampagne,
  trackColor = '#E2E8F0',
}: StatRingProps) {
  const clampedPercentage = Math.min(100, Math.max(0, percentage));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedPercentage / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2">
        <span
          className="text-xl font-bold tracking-tight leading-none"
          style={{ color: LUXURY_TOKENS.textPrimary }}
        >
          {centerLabel !== undefined ? centerLabel : `${Math.round(clampedPercentage)}%`}
        </span>
        {subLabel && (
          <span
            className="text-[10px] font-medium mt-1 leading-tight"
            style={{ color: LUXURY_TOKENS.textSecondary }}
          >
            {subLabel}
          </span>
        )}
      </div>
    </div>
  );
}
