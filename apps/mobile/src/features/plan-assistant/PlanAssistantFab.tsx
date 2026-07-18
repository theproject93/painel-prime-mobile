import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, View, type GestureResponderHandlers } from 'react-native';

import { colors } from '../../theme/colors';
import { PLAN_FACE_IMAGE } from './assets';
import type { Point } from './types';

export function PlanAssistantFab(props: {
  isOpen: boolean;
  position: Point;
  panHandlers: GestureResponderHandlers;
}) {
  return (
    <View
      {...props.panHandlers}
      collapsable={false}
      style={[styles.fab, { left: props.position.x, top: props.position.y }]}
    >
      {props.isOpen ? (
        <Ionicons name="close" size={22} color="#FFFFFF" />
      ) : (
        <Image source={PLAN_FACE_IMAGE} style={styles.avatar} resizeMode="cover" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    height: 56,
    width: 56,
    borderRadius: 999,
    backgroundColor: colors.primaryStrong,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
  },
});
