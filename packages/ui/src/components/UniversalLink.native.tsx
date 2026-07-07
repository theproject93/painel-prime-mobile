'use client';

import type { ReactNode } from 'react';
import { Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Link } from 'solito/link';

export type UniversalLinkProps = {
  children: ReactNode;
  href: string;
  replace?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

function renderLinkChildren(
  children: ReactNode,
  textStyle?: StyleProp<TextStyle>
) {
  if (typeof children === 'string' || typeof children === 'number') {
    return <Text style={textStyle}>{children}</Text>;
  }

  return children;
}

export function UniversalLink({
  children,
  href,
  replace,
  style,
  textStyle,
}: UniversalLinkProps) {
  return (
    <Link href={href} replace={replace} viewProps={{ style }}>
      {renderLinkChildren(children, textStyle)}
    </Link>
  );
}
