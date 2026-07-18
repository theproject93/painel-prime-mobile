import type { FixtureConfig, FixtureType } from './types';

export const MAP_WIDTH = 1200;
export const MAP_HEIGHT = 780;
export const GRID = 20;

export const FIXTURE_LIBRARY: Record<FixtureType, FixtureConfig> = {
  altar: { label: 'Altar', color: '#F8FAFC', borderColor: '#94A3B8', iconName: 'church', iconColor: '#334155', w: 220, h: 90 },
  photo_totem: { label: 'Totem de fotos', color: '#FFFBEB', borderColor: '#FCD34D', iconName: 'camera', iconColor: '#B45309', w: 160, h: 82 },
  cake_table: { label: 'Mesa de bolo', color: '#FFF1F2', borderColor: '#FDA4AF', iconName: 'cake-variant', iconColor: '#BE123C', w: 180, h: 82 },
  dance_floor: { label: 'Pista de dança', color: '#E0E7FF', borderColor: '#818CF8', iconName: 'music', iconColor: '#4338CA', w: 200, h: 96 },
  bar: { label: 'Bar', color: '#ECFDF5', borderColor: '#6EE7B7', iconName: 'glass-wine', iconColor: '#047857', w: 165, h: 88 },
  entry_door: { label: 'Porta de entrada', color: '#ECFEFF', borderColor: '#67E8F9', iconName: 'login', iconColor: '#0E7490', w: 170, h: 78 },
  exit_door: { label: 'Porta de saída', color: '#F0F9FF', borderColor: '#7DD3FC', iconName: 'logout', iconColor: '#0369A1', w: 160, h: 78 },
  restroom: { label: 'Banheiro', color: '#F0FDFA', borderColor: '#5EEAD4', iconName: 'toilet', iconColor: '#0F766E', w: 155, h: 78 },
};
