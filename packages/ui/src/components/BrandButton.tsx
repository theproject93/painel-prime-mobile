import React from 'react';
import { LUXURY_TOKENS } from '../branding';

export interface BrandButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'navy-luxury' | 'gold-accent' | 'glass-ghost' | 'secondary-outline';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export function BrandButton({
  variant = 'navy-luxury',
  size = 'md',
  icon,
  children,
  className = '',
  style,
  ...props
}: BrandButtonProps) {
  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return 'px-3 py-1.5 text-xs font-medium gap-1.5 rounded-lg';
      case 'lg':
        return 'px-6 py-3.5 text-base font-semibold gap-2.5 rounded-xl';
      case 'md':
      default:
        return 'px-4 py-2.5 text-sm font-semibold gap-2 rounded-xl';
    }
  };

  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'gold-accent':
        return {
          backgroundColor: LUXURY_TOKENS.goldChampagne,
          color: '#FFFFFF',
          boxShadow: '0 4px 14px 0 rgba(212, 175, 55, 0.35)',
        };
      case 'glass-ghost':
        return {
          backgroundColor: 'rgba(255, 255, 255, 0.75)',
          color: LUXURY_TOKENS.navyPrimary,
          border: `1px solid ${LUXURY_TOKENS.borderSlateSubtle}`,
          backdropFilter: 'blur(8px)',
        };
      case 'secondary-outline':
        return {
          backgroundColor: 'transparent',
          color: LUXURY_TOKENS.navyPrimary,
          border: `1px solid ${LUXURY_TOKENS.borderGoldSubtle}`,
        };
      case 'navy-luxury':
      default:
        return {
          backgroundColor: LUXURY_TOKENS.navyPrimary,
          color: '#FFFFFF',
          boxShadow: '0 4px 14px 0 rgba(15, 23, 42, 0.2)',
        };
    }
  };

  return (
    <button
      className={`inline-flex items-center justify-center transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${getSizeStyles()} ${className}`}
      style={{
        ...getVariantStyles(),
        ...style,
      }}
      {...props}
    >
      {icon && <span className="inline-flex shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}
