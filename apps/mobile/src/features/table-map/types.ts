import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { MutableRefObject } from 'react';

export type TableRow = {
  id: string;
  name: string | null;
  seats: number | null;
  note?: string | null;
  posx?: number | null;
  posy?: number | null;
};
export type GuestRow = { id: string; table_id: string | null };
export type FixtureType = 'altar' | 'photo_totem' | 'cake_table' | 'dance_floor' | 'bar' | 'entry_door' | 'exit_door' | 'restroom';
export type FixtureConfig = {
  label: string;
  color: string;
  borderColor: string;
  iconName: keyof typeof MaterialCommunityIcons.glyphMap;
  iconColor: string;
  w: number;
  h: number;
};
export type FixtureItem = {
  id: string;
  type: FixtureType;
  x: number;
  y: number;
  w: number;
  h: number;
  custom_label?: string | null;
};
export type Point = { x: number; y: number };
export type TablePositions = Record<string, Point>;
export type AutosaveState = 'saved' | 'saving' | 'error';
export type ActiveDragKeys = MutableRefObject<Set<string>>;
