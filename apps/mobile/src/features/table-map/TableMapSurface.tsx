import { forwardRef } from 'react';
import { ScrollView, View, type GestureResponderHandlers } from 'react-native';

import { GRID, MAP_HEIGHT, MAP_WIDTH } from './constants';
import { FixtureMapNode } from './FixtureMapNode';
import { tableMapStyles as styles } from './styles';
import { TableMapNode } from './TableMapNode';
import type { FixtureItem, TablePositions, TableRow } from './types';

type Props = {
  tables: TableRow[];
  positions: TablePositions;
  fixtures: FixtureItem[];
  occupancy: Map<string, number>;
  fullscreen?: boolean;
  getTableHandlers: (id: string) => GestureResponderHandlers;
  getFixtureHandlers: (id: string) => GestureResponderHandlers;
  onSelectFixture: (id: string) => void;
  onDeleteFixture: (id: string) => void;
};

export const TableMapSurface = forwardRef<View, Props>(function TableMapSurface(props, ref) {
  return (
    <View ref={ref} collapsable={false} style={[styles.mapFrame, props.fullscreen ? styles.fullscreenMapFrame : null]}>
      <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false}>
        <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
          <View style={styles.gridWrap}>
            <View style={styles.gridUnderlay}>
              {Array.from({ length: Math.floor(MAP_WIDTH / GRID) }).map((_, index) => (
                <View key={`v-${index}`} style={[styles.gridLineV, { left: index * GRID }]} />
              ))}
              {Array.from({ length: Math.floor(MAP_HEIGHT / GRID) }).map((_, index) => (
                <View key={`h-${index}`} style={[styles.gridLineH, { top: index * GRID }]} />
              ))}
            </View>
            {props.fixtures.map((fixture) => (
              <FixtureMapNode
                key={fixture.id}
                fixture={fixture}
                panHandlers={props.getFixtureHandlers(fixture.id)}
                onSelect={() => props.onSelectFixture(fixture.id)}
                onDelete={() => props.onDeleteFixture(fixture.id)}
              />
            ))}
            {props.tables.map((table) => (
              <TableMapNode
                key={table.id}
                table={table}
                position={props.positions[table.id] ?? { x: 40, y: 140 }}
                occupied={props.occupancy.get(table.id) ?? 0}
                panHandlers={props.getTableHandlers(table.id)}
              />
            ))}
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
});
