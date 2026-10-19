import React from 'react';
import { LUXURY_TOKENS } from '../branding';

export interface ProgressBarProps {
  percentage: number;
  height?: number;
  barColor?: string;
  backgroundColor?: string;
  showLabel?: boolean;
  labelLeft?: string;
  labelRight?: string;
  className?: string;
}

export function ProgressBar({
  percentage,
  height = 8,
  barColor = LUXURY_TOKENS.goldChampagne,
  backgroundColor = '#E2E8F0',
  showLabel = false,
  labelLeft,
  labelRight,
  className = '',
}: ProgressBarProps) {
  const clampedPercentage = Math.min(100, Math.max(0, percentage));

  return (
    <div className={`w-full ${className}`}>
      {(showLabel || labelLeft || labelRight) && (
        <div className="flex justify-between items-center text-xs font-medium mb-1.5">
          <span style={{ color: LUXURY_TOKENS.textSecondary }}>{labelLeft}</span>
          <span style={{ color: LUXURY_TOKENS.textPrimary }} className="font-semibold">
            {labelRight || `${Math.round(clampedPercentage)}%`}
          </span>
        </div>
      )}
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height: `${height}px`, backgroundColor }}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${clampedPercentage}%`,
            backgroundColor: barColor,
          }}
        />
      </div>
    </div>
  );
}
