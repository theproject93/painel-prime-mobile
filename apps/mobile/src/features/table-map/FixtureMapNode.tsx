import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, Text, View, type GestureResponderHandlers } from 'react-native';

import { FIXTURE_LIBRARY } from './constants';
import { fixtureLabel } from './core';
import { tableMapStyles as styles } from './styles';
import type { FixtureItem } from './types';

export function FixtureMapNode(props: {
  fixture: FixtureItem;
  panHandlers: GestureResponderHandlers;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const config = FIXTURE_LIBRARY[props.fixture.type];
  return (
    <View
      {...props.panHandlers}
      style={[styles.fixtureCard, {
        left: props.fixture.x,
        top: props.fixture.y,
        width: props.fixture.w,
        height: props.fixture.h,
        backgroundColor: config.color,
        borderColor: config.borderColor,
      }]}
    >
      <Pressable style={styles.fixtureBody} onPress={props.onSelect}>
        <View style={styles.fixtureIconBadge}>
          <MaterialCommunityIcons name={config.iconName} size={15} color={config.iconColor} />
        </View>
        <Text style={styles.fixtureText} numberOfLines={2}>{fixtureLabel(props.fixture)}</Text>
      </Pressable>
      <Pressable onPress={props.onDelete} style={styles.fixtureDelete}>
        <Text style={styles.fixtureDeleteText}>x</Text>
      </Pressable>
    </View>
  );
}
