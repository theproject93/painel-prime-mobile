import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, ScrollView, Text } from 'react-native';

import { colors } from '../../theme/colors';
import { FIXTURE_LIBRARY } from './constants';
import { tableMapStyles as styles } from './styles';
import type { FixtureType } from './types';

export function FixtureToolbar(props: { compact?: boolean; onAdd: (type: FixtureType) => void }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={props.compact ? styles.fullscreenToolsContent : styles.fixtureLibrary}
    >
      {(Object.keys(FIXTURE_LIBRARY) as FixtureType[]).map((type) => {
        const config = FIXTURE_LIBRARY[type];
        return (
          <Pressable
            key={type}
            style={[styles.fixtureChip, props.compact ? styles.fullscreenToolChip : null]}
            onPress={() => props.onAdd(type)}
          >
            <MaterialCommunityIcons name={config.iconName} size={17} color={config.iconColor} />
            <Text style={styles.fixtureChipText}>{config.label}</Text>
            {props.compact ? <MaterialCommunityIcons name="plus-circle" size={16} color={colors.primaryStrong} /> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
