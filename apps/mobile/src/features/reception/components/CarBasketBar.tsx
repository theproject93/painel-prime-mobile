import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { type ReceptionGuest } from '../types/receptionTypes';
import { AppHaptics } from '../../../lib/haptics';

export interface CarBasketBarProps {
  selectedGuests: ReceptionGuest[];
  onRemoveGuest: (guestId: string) => void;
  onClearAll: () => void;
  onConfirmCar: () => void;
  loading?: boolean;
}

export function CarBasketBar({
  selectedGuests,
  onRemoveGuest,
  onClearAll,
  onConfirmCar,
  loading = false,
}: CarBasketBarProps) {
  if (selectedGuests.length === 0) return null;

  const count = selectedGuests.length;
  const countLabel = count === 1 ? '1 pessoa selecionada' : `${count} pessoas selecionadas`;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitleWrap}>
          <View style={styles.carIconBadge}>
            <Ionicons name="car-outline" size={16} color="#111318" />
          </View>
          <Text style={styles.headerTitle}>Carro / Grupo</Text>
          <View style={styles.counterBadge}>
            <Text style={styles.counterBadgeText}>{count}</Text>
          </View>
        </View>

        <Pressable
          style={styles.clearButton}
          onPress={() => {
            void AppHaptics.light();
            onClearAll();
          }}
          hitSlop={8}
          accessibilityLabel="Limpar seleção do carro"
        >
          <Text style={styles.clearButtonText}>Limpar</Text>
        </Pressable>
      </View>

      {/* Lista horizontal com chips dos passageiros */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsScroll}
      >
        {selectedGuests.map((guest) => (
          <View key={guest.id} style={styles.chip}>
            <View style={styles.chipTextWrap}>
              <Text style={styles.chipName} numberOfLines={1}>
                {guest.name}
              </Text>
              {guest.table_name ? (
                <Text style={styles.chipTable} numberOfLines={1}>
                  {guest.table_name}
                </Text>
              ) : null}
            </View>

            <Pressable
              style={styles.chipRemoveBtn}
              onPress={() => {
                void AppHaptics.selection();
                onRemoveGuest(guest.id);
              }}
              hitSlop={8}
              accessibilityLabel={`Remover ${guest.name} do carro`}
            >
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </Pressable>
          </View>
        ))}
      </ScrollView>

      {/* Botão de Confirmação Primário com Alto Contraste */}
      <Pressable
        style={({ pressed }) => [
          styles.confirmButton,
          pressed && styles.confirmButtonPressed,
          loading && styles.confirmButtonDisabled,
        ]}
        onPress={() => {
          if (loading) return;
          void AppHaptics.medium();
          onConfirmCar();
        }}
        accessibilityRole="button"
        accessibilityLabel={`Confirmar entrada do carro com ${countLabel}`}
      >
        <Ionicons name="checkmark-circle" size={22} color="#111318" />
        <Text style={styles.confirmButtonText}>
          {loading
            ? 'Confirmando entrada...'
            : `Confirmar Entrada do Carro (${countLabel})`}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  carIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F2D875',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
  },
  counterBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
  },
  counterBadgeText: {
    color: '#F2D875',
    fontSize: 12,
    fontWeight: '800',
  },
  clearButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clearButtonText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  chipsScroll: {
    paddingVertical: 4,
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 20,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 6,
    maxWidth: 220,
  },
  chipTextWrap: {
    flexShrink: 1,
  },
  chipName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  chipTable: {
    color: '#D4AF37',
    fontSize: 11,
    fontWeight: '600',
  },
  chipRemoveBtn: {
    padding: 2,
  },
  confirmButton: {
    backgroundColor: '#F2D875',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#F2D875',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  confirmButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    color: '#111318',
    fontSize: 15,
    fontWeight: '800',
  },
});
