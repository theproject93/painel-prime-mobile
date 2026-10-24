import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { AppHaptics } from '../../lib/haptics';
import { colors } from '../../theme/colors';

type PlanActionCardProps = {
  text: string;
};

export function PlanActionCard({ text }: PlanActionCardProps) {
  if (!text) return null;

  // 1. Detect WhatsApp Link
  const waMatch = text.match(/https:\/\/(?:api\.whatsapp\.com\/send\?[^\s)]+|wa\.me\/[^\s)]+)/i);
  const waUrl = waMatch ? waMatch[0] : null;

  // 2. Detect Buffet or Dietary Restrictions
  const isBuffetReport =
    /restriç(?:ão|ões)|alérgic[oa]|vegano|vegetarian[oa]|celíac[oa]|sem glúten|buffet/i.test(text) &&
    /mesa|convidado|quantidade/i.test(text);

  if (!waUrl && !isBuffetReport) {
    return null;
  }

  const handleOpenWhatsApp = async () => {
    if (!waUrl) return;
    try {
      void AppHaptics.light();
      const supported = await Linking.canOpenURL(waUrl);
      if (supported) {
        await Linking.openURL(waUrl);
      } else {
        await Linking.openURL(waUrl);
      }
    } catch (err) {
      console.warn('Erro ao abrir link do WhatsApp:', err);
    }
  };

  const handleShareBuffet = async () => {
    try {
      void AppHaptics.light();
      await Share.share({
        title: 'Relatório para o Buffet — Painel Prime',
        message: text,
      });
    } catch (err) {
      console.warn('Erro ao compartilhar relatório para o buffet:', err);
    }
  };

  return (
    <View style={styles.container}>
      {waUrl && (
        <Pressable
          style={styles.waButton}
          onPress={handleOpenWhatsApp}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Abrir no WhatsApp"
        >
          <Ionicons name="logo-whatsapp" size={15} color="#FFFFFF" />
          <Text style={styles.waButtonText}>Abrir no WhatsApp</Text>
          <Ionicons name="open-outline" size={13} color="rgba(255, 255, 255, 0.85)" />
        </Pressable>
      )}

      {isBuffetReport && (
        <Pressable
          style={styles.buffetButton}
          onPress={handleShareBuffet}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Compartilhar relatório para o buffet"
        >
          <Ionicons name="restaurant-outline" size={15} color="#B45309" />
          <Text style={styles.buffetButtonText}>Relatório para o Buffet</Text>
          <Ionicons name="share-outline" size={13} color="#B45309" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  waButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    minHeight: 44,
  },
  waButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  buffetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    minHeight: 44,
  },
  buffetButtonText: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '700',
  },
});
