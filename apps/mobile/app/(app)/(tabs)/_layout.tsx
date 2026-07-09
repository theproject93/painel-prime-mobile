import { useId } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ModuleWalkthroughOverlay } from '../../../src/components/ModuleWalkthroughOverlay';
import { PlanAssistantFloating } from '../../../src/components/PlanAssistantFloating';
import { colors, gradients } from '../../../src/theme/colors';

export default function AppTabsLayout() {
  const tabGradId = useId();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.primaryStrong,
          tabBarInactiveTintColor: colors.mutedText,
          tabBarHideOnKeyboard: true,
          tabBarStyle: {
            height: 56 + insets.bottom,
            paddingBottom: insets.bottom + 4,
            paddingTop: 4,
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: StyleSheet.hairlineWidth,
            shadowColor: '#0F1115',
            shadowOpacity: 0.12,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: -10 },
            elevation: 16,
          },
          tabBarItemStyle: {
            borderRadius: 12,
            paddingVertical: 2,
          },
          tabBarLabelStyle: {
            fontSize: 9,
            fontWeight: '700',
            marginTop: 1,
            letterSpacing: -0.2,
          },
          tabBarIcon: ({ focused, color, size }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              {focused && (
                <Svg style={StyleSheet.absoluteFill}>
                  <Defs>
                    <LinearGradient id={`tab-${tabGradId}`} x1="0" y1="0" x2="1" y2="1">
                      <Stop offset="0" stopColor={gradients.gold[0]} />
                      <Stop offset="1" stopColor={gradients.gold[1]} />
                    </LinearGradient>
                  </Defs>
                  <Rect width="100%" height="100%" rx={14} ry={14} fill={`url(#tab-${tabGradId})`} />
                </Svg>
              )}
              <Ionicons
                name={getIconName(route.name, focused)}
                color={focused ? '#FFFFFF' : color}
                size={size - 2}
              />
            </View>
          ),
        })}
      >
        <Tabs.Screen name="dashboard" options={{ title: 'Início' }} />
        <Tabs.Screen name="eventos" options={{ title: 'Eventos' }} />
        <Tabs.Screen name="clientes" options={{ title: 'Clientes' }} />
        <Tabs.Screen name="financeiro" options={{ title: 'Finanças' }} />
        <Tabs.Screen name="fornecedores" options={{ title: 'Fornec.' }} />
        <Tabs.Screen name="mais" options={{ title: 'Mais' }} />
      </Tabs>
      <ModuleWalkthroughOverlay />
      <PlanAssistantFloating />
    </View>
  );
}

function getIconName(routeName: string, focused: boolean): keyof typeof Ionicons.glyphMap {
  if (focused) {
    switch (routeName) {
      case 'dashboard':
        return 'home';
      case 'eventos':
        return 'calendar';
      case 'clientes':
        return 'people';
      case 'fornecedores':
        return 'storefront';
      case 'financeiro':
        return 'wallet';
      case 'mais':
        return 'grid';
      default:
        return 'grid';
    }
  }
  switch (routeName) {
    case 'dashboard':
      return 'home-outline';
    case 'eventos':
      return 'calendar-outline';
    case 'clientes':
      return 'people-outline';
    case 'fornecedores':
      return 'storefront-outline';
    case 'financeiro':
      return 'wallet-outline';
    case 'mais':
      return 'grid-outline';
    default:
      return 'grid-outline';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  iconWrap: {
    width: 36,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    position: 'relative',
  },
  iconBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
  },
});
