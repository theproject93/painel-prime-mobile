'use client';

import type { CSSProperties, ReactNode } from 'react';

export type UniversalLinkProps = {
  children: ReactNode;
  href: string;
  replace?: boolean;
  className?: string;
  style?: CSSProperties;
  textStyle?: CSSProperties;
};

export function UniversalLink({
  children,
  className,
  href,
  style,
  textStyle,
}: UniversalLinkProps) {
  return (
    <a href={href} className={className} style={style}>
      {typeof children === 'string' || typeof children === 'number' ? (
        <span style={textStyle}>{children}</span>
      ) : (
        children
      )}
    </a>
  );
}
