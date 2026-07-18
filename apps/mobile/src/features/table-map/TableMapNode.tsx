import { Text, View, type GestureResponderHandlers } from 'react-native';

import { toNumber } from './core';
import { tableMapStyles as styles } from './styles';
import type { Point, TableRow } from './types';

export function TableMapNode(props: {
  table: TableRow;
  position: Point;
  occupied: number;
  panHandlers: GestureResponderHandlers;
}) {
  const seats = toNumber(props.table.seats);
  return (
    <View
      {...props.panHandlers}
      style={[styles.tableCard, {
        left: props.position.x,
        top: props.position.y,
        borderColor: seats > 0 && props.occupied / seats >= 1 ? '#FCA5A5' : '#D1D5DB',
      }]}
    >
      <Text style={styles.tableTitle} numberOfLines={2}>{props.table.name || 'Mesa'}</Text>
      {props.table.note ? <Text style={styles.tableNote} numberOfLines={2}>{props.table.note}</Text> : null}
      <Text style={styles.tableSeats}>{props.occupied}/{seats} lugares</Text>
    </View>
  );
}
