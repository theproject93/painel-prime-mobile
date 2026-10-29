import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { type ReceptionGuest } from '../types/receptionTypes';
import { AppHaptics } from '../../../lib/haptics';

export interface CarConfirmationModalProps {
  visible: boolean;
  confirmedGuests: ReceptionGuest[];
  onClose: () => void;
}

export function CarConfirmationModal({
  visible,
  confirmedGuests,
  onClose,
}: CarConfirmationModalProps) {
  if (!visible || confirmedGuests.length === 0) return null;

  // Agrupa os convidados por mesa para orientação rápida
  const tableGroups = confirmedGuests.reduce<Record<string, string[]>>((acc, g) => {
    const table = g.table_name || 'Sem mesa definida';
    if (!acc[table]) acc[table] = [];
    acc[table].push(g.name);
    return acc;
  }, {});

  const total = confirmedGuests.length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.successIconCircle}>
            <Ionicons name="checkmark-done" size={36} color="#111318" />
          </View>

          <Text style={styles.title}>Entrada do Carro Liberada!</Text>
          <Text style={styles.subtitle}>
            {total === 1
              ? '1 convidado confirmado com sucesso.'
              : `${total} convidados confirmados com sucesso.`}
          </Text>

          <View style={styles.divider} />

          <Text style={styles.sectionHeader}>Mesas dos Convidados:</Text>

          <ScrollView style={styles.scrollList} showsVerticalScrollIndicator={false}>
            {Object.entries(tableGroups).map(([table, names]) => (
              <View key={table} style={styles.tableGroupRow}>
                <View style={styles.tableBadge}>
                  <Ionicons name="restaurant-outline" size={14} color="#D4AF37" />
                  <Text style={styles.tableBadgeText}>{table}</Text>
                </View>
                <View style={styles.namesWrap}>
                  {names.map((name, i) => (
                    <Text key={i} style={styles.guestName}>
                      • {name}
                    </Text>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => {
              void AppHaptics.light();
              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel="Liberar próximo carro"
          >
            <Ionicons name="car-outline" size={20} color="#111318" />
            <Text style={styles.primaryButtonText}>Próximo Carro</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#0F172A',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    padding: 24,
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    alignItems: 'center',
  },
  successIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#F2D875',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#F2D875',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: '#1E293B',
    marginVertical: 16,
  },
  sectionHeader: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  scrollList: {
    width: '100%',
    marginBottom: 16,
  },
  tableGroupRow: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 8,
  },
  tableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  tableBadgeText: {
    color: '#F2D875',
    fontSize: 12,
    fontWeight: '700',
  },
  namesWrap: {
    paddingLeft: 4,
    gap: 4,
  },
  guestName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#F2D875',
    borderRadius: 14,
    paddingVertical: 14,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  primaryButtonText: {
    color: '#111318',
    fontSize: 16,
    fontWeight: '800',
  },
});
