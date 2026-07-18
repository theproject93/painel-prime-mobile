import { FIXTURE_LIBRARY, GRID } from './constants';
import type { FixtureItem, FixtureType, GuestRow, TablePositions, TableRow } from './types';

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function snap(value: number) {
  return Math.round(value / GRID) * GRID;
}

export function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function isFixtureType(value: string): value is FixtureType {
  return Object.prototype.hasOwnProperty.call(FIXTURE_LIBRARY, value);
}

export function fixtureLabel(item: FixtureItem) {
  return String(item.custom_label ?? '').trim() || FIXTURE_LIBRARY[item.type]?.label || 'Item';
}

export function buildInitialTablePositions(tables: TableRow[], current: TablePositions, active: Set<string>) {
  return tables.reduce<TablePositions>((positions, table, index) => {
    const activePosition = active.has(`table:${table.id}`) ? current[table.id] : undefined;
    positions[table.id] = activePosition ?? {
      x: toNumber(table.posx, 40 + (index % 4) * 250),
      y: toNumber(table.posy, 140 + Math.floor(index / 4) * 180),
    };
    return positions;
  }, {});
}

export function buildOccupancy(guests: GuestRow[]) {
  return guests.reduce((occupancy, guest) => {
    if (guest.table_id) occupancy.set(guest.table_id, (occupancy.get(guest.table_id) ?? 0) + 1);
    return occupancy;
  }, new Map<string, number>());
}

export function parseFixtureRows(rows: Array<Record<string, unknown>>) {
  return rows.flatMap((row) => {
    const type = String(row.type ?? '');
    if (!isFixtureType(type)) return [];
    const config = FIXTURE_LIBRARY[type];
    return [{
      id: String(row.id),
      type,
      x: toNumber(row.x, 40),
      y: toNumber(row.y, 40),
      w: toNumber(row.w, config.w),
      h: toNumber(row.h, config.h),
      custom_label: typeof row.custom_label === 'string' ? row.custom_label : null,
    } satisfies FixtureItem];
  });
}

export function buildMapLines(
  tables: TableRow[],
  positions: TablePositions,
  occupancy: Map<string, number>,
  fixtures: FixtureItem[],
) {
  return [
    'Mapa de mesas - Painel Prime',
    '',
    'Mesas:',
    ...tables.map((table) => {
      const position = positions[table.id] ?? { x: 0, y: 0 };
      return `- ${table.name || 'Mesa'} | ${occupancy.get(table.id) ?? 0}/${toNumber(table.seats)} | x:${Math.round(position.x)} y:${Math.round(position.y)}`;
    }),
    '',
    'Elementos do mapa:',
    ...fixtures.map((fixture) => `- ${fixtureLabel(fixture)} | ${fixture.type} | x:${Math.round(fixture.x)} y:${Math.round(fixture.y)}`),
  ];
}
