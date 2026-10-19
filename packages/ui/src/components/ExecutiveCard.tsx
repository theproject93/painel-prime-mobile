import React from 'react';
import { LUXURY_TOKENS } from '../branding';

export interface ExecutiveCardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  badgeText?: string;
  variant?: 'elevated' | 'glass' | 'gold-subtle';
  className?: string;
  actionButton?: React.ReactNode;
  isClickable?: boolean;
  urgencyLevel?: 'none' | 'warning' | 'danger';
}

export function ExecutiveCard({
  children,
  title,
  subtitle,
  badgeText,
  variant = 'elevated',
  className = '',
  actionButton,
  isClickable = false,
  urgencyLevel = 'none',
}: ExecutiveCardProps) {
  const getVariantStyles = () => {
    if (urgencyLevel === 'danger') {
      return {
        backgroundColor: '#FEF2F2',
        border: '1px solid rgba(220, 38, 38, 0.25)',
        boxShadow: LUXURY_TOKENS.shadowSoft,
      };
    }
    if (urgencyLevel === 'warning') {
      return {
        backgroundColor: '#FFFBEB',
        border: '1px solid rgba(217, 142, 4, 0.25)',
        boxShadow: LUXURY_TOKENS.shadowSoft,
      };
    }

    switch (variant) {
      case 'gold-subtle':
        return {
          backgroundColor: LUXURY_TOKENS.goldSoft,
          border: `1px solid ${LUXURY_TOKENS.borderGoldSubtle}`,
          boxShadow: LUXURY_TOKENS.shadowSoft,
        };
      case 'glass':
        return {
          backgroundColor: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(12px)',
          border: `1px solid ${LUXURY_TOKENS.borderSlateSubtle}`,
          boxShadow: LUXURY_TOKENS.shadowSoft,
        };
      case 'elevated':
      default:
        return {
          backgroundColor: LUXURY_TOKENS.surfaceElevated,
          border: `1px solid ${LUXURY_TOKENS.borderSlateSubtle}`,
          boxShadow: LUXURY_TOKENS.shadowSoft,
        };
    }
  };

  const clickableClasses = isClickable
    ? 'cursor-pointer hover:-translate-y-1 hover:shadow-elevated active:translate-y-0 active:shadow-sm group-hover:border-amber-400/40'
    : '';

  return (
    <div
      className={`rounded-2xl p-6 transition-all duration-200 ${clickableClasses} ${className}`}
      style={getVariantStyles()}
    >
      {(title || badgeText || actionButton) && (
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100/60">
          <div>
            {badgeText && (
              <span
                className="inline-block text-[11px] font-semibold tracking-wider uppercase px-2.5 py-0.5 rounded-full mb-1.5"
                style={{
                  backgroundColor: 'rgba(212, 175, 55, 0.12)',
                  color: LUXURY_TOKENS.goldAccent,
                  border: `1px solid ${LUXURY_TOKENS.borderGoldSubtle}`,
                }}
              >
                {badgeText}
              </span>
            )}
            {title && (
              <h3
                className="text-lg font-bold tracking-tight"
                style={{ color: LUXURY_TOKENS.textPrimary }}
              >
                {title}
              </h3>
            )}
            {subtitle && (
              <p
                className="text-xs font-normal mt-0.5"
                style={{ color: LUXURY_TOKENS.textSecondary }}
              >
                {subtitle}
              </p>
            )}
          </div>
          {actionButton && <div>{actionButton}</div>}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}
