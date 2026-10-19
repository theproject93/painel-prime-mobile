import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radii, shadows } from '../../theme/colors';
import type {
  ConversationReviewGuest,
  GuestStatus,
  ReviewSelectionStatus,
} from './rsvpInboxModel';

type Props = {
  guests: ConversationReviewGuest[];
  selections: Record<string, ReviewSelectionStatus>;
  onSelectStatus: (guestId: string, status: GuestStatus) => void;
  onResendQr: (guestId: string, guestName: string) => void;
  resendingGuestId?: string | null;
};

export function RsvpFamilyGroupBar({
  guests,
  selections,
  onSelectStatus,
  onResendQr,
  resendingGuestId,
}: Props) {
  if (!guests || guests.length === 0) return null;

  return (
    <View style={[styles.container, shadows.sm]}>
      <View style={styles.headerRow}>
        <Ionicons name="people" size={15} color={colors.gold700} />
        <Text style={styles.headerTitle}>Membros do Grupo Familiar / Convite</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {guests.map((guest) => {
          const currentStatus = selections[guest.id] ?? guest.rsvp_status ?? 'pending';
          const isConfirmed = currentStatus === 'confirmed';
          const isDeclined = currentStatus === 'declined';
          const isPending = currentStatus === 'pending';
          const isResending = resendingGuestId === guest.id;

          return (
            <View key={guest.id} style={styles.guestCard}>
              <View style={styles.guestTop}>
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.guestName} numberOfLines={1}>
                      {guest.name}
                    </Text>
                    {guest.is_group_leader ? (
                      <View style={styles.leaderBadge}>
                        <Text style={styles.leaderBadgeText}>Titular</Text>
                      </View>
                    ) : null}
                  </View>
                  {guest.phone ? (
                    <Text style={styles.guestPhone}>{guest.phone}</Text>
                  ) : null}
                </View>

                {/* Resend QR Code button if confirmed */}
                {isConfirmed ? (
                  <Pressable
                    onPress={() => onResendQr(guest.id, guest.name)}
                    disabled={isResending}
                    style={styles.qrBtn}
                    accessibilityLabel="Reenviar QR Code de Check-in"
                  >
                    {isResending ? (
                      <ActivityIndicator size="small" color={colors.gold700} />
                    ) : (
                      <>
                        <Ionicons name="qr-code" size={13} color={colors.gold700} />
                        <Text style={styles.qrBtnText}>QR</Text>
                      </>
                    )}
                  </Pressable>
                ) : null}
              </View>

              {/* 3-way toggle buttons */}
              <View style={styles.toggleRow}>
                <Pressable
                  onPress={() => onSelectStatus(guest.id, 'confirmed')}
                  style={[styles.toggleBtn, isConfirmed && styles.toggleConfirmed]}
                >
                  <Ionicons
                    name="checkmark"
                    size={13}
                    color={isConfirmed ? '#FFFFFF' : colors.success600}
                  />
                  <Text
                    style={[styles.toggleText, isConfirmed && styles.toggleTextActive]}
                  >
                    Confirmar
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => onSelectStatus(guest.id, 'declined')}
                  style={[styles.toggleBtn, isDeclined && styles.toggleDeclined]}
                >
                  <Ionicons
                    name="close"
                    size={13}
                    color={isDeclined ? '#FFFFFF' : colors.dangerText}
                  />
                  <Text
                    style={[styles.toggleText, isDeclined && styles.toggleTextActive]}
                  >
                    Recusar
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => onSelectStatus(guest.id, 'pending')}
                  style={[styles.toggleBtn, isPending && styles.togglePending]}
                >
                  <Ionicons
                    name="time"
                    size={13}
                    color={isPending ? '#FFFFFF' : colors.gold700}
                  />
                  <Text
                    style={[styles.toggleText, isPending && styles.toggleTextActive]}
                  >
                    Pendente
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scrollContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  guestCard: {
    backgroundColor: '#FAF7F1',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    width: 250,
  },
  guestTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  guestName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    maxWidth: 150,
  },
  leaderBadge: {
    backgroundColor: colors.gold100,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  leaderBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.gold700,
    textTransform: 'uppercase',
  },
  guestPhone: {
    fontSize: 11,
    color: colors.mutedText,
    marginTop: 1,
  },
  qrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.gold50,
    borderWidth: 1,
    borderColor: colors.gold200,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  qrBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.gold700,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 5,
  },
  toggleConfirmed: {
    backgroundColor: '#16A34A',
  },
  toggleDeclined: {
    backgroundColor: '#DC2626',
  },
  togglePending: {
    backgroundColor: colors.gold600,
  },
  toggleText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
