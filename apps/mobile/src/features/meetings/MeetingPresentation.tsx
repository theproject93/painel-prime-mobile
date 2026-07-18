import type React from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { formatMeetingDateTime, type Meeting } from './meetingModel';
import { meetingStyles as styles } from './meetingStyles';

export function MeetingSection({
  title,
  tone,
  children,
}: {
  title: string;
  tone?: 'live';
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        {tone === 'live' ? <View style={styles.liveDot} /> : null}
        <Text style={[styles.sectionTitle, tone === 'live' ? styles.liveTitle : null]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

export function MeetingCard({
  meeting,
  busyAction,
  notes,
  onNotesChange,
  onHost,
  onShare,
  onSaveNotes,
  onComplete,
}: {
  meeting: Meeting;
  busyAction: string;
  notes: string;
  onNotesChange: (value: string) => void;
  onHost: () => void;
  onShare: () => void;
  onSaveNotes: () => void;
  onComplete: () => void;
}) {
  const isActive = meeting.status === 'active';
  return (
    <View style={[styles.meetingCard, isActive ? styles.meetingCardLive : null]}>
      <View style={styles.cardHeading}>
        <View style={styles.cardHeadingCopy}>
          <Text style={styles.cardTitle}>{meeting.title}</Text>
          <Text style={styles.muted}>{formatMeetingDateTime(meeting.scheduled_at)}</Text>
        </View>
        <StatusPill label={isActive ? 'Em andamento' : 'Agendada'} danger={isActive} />
      </View>
      <View style={styles.actionRow}>
        <ActionButton
          label={isActive ? 'Voltar à sala' : 'Entrar como anfitriã'}
          icon="videocam-outline"
          onPress={onHost}
          primary
          loading={busyAction === `host:${meeting.id}`}
        />
        <ActionButton label="Enviar convite" icon="share-social-outline" onPress={onShare} />
      </View>
      {isActive ? (
        <View style={styles.notesBox}>
          <Text style={styles.inputLabel}>Anotações da assessoria</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={onNotesChange}
            placeholder="Registre decisões e próximos passos..."
            placeholderTextColor={colors.mutedText}
            multiline
            textAlignVertical="top"
          />
          <View style={styles.actionRow}>
            <ActionButton
              label="Salvar anotações"
              icon="save-outline"
              onPress={onSaveNotes}
              loading={busyAction === `notes:${meeting.id}`}
            />
            <ActionButton
              label="Encerrar reunião"
              icon="stop-circle-outline"
              onPress={onComplete}
              danger
              loading={busyAction === `complete:${meeting.id}`}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function StatusPill({ label, danger }: { label: string; danger?: boolean }) {
  return (
    <View style={[styles.statusPill, danger ? styles.statusPillDanger : null]}>
      <Text style={[styles.statusText, danger ? styles.statusTextDanger : null]}>{label}</Text>
    </View>
  );
}

export function ActionButton({
  label,
  icon,
  onPress,
  primary,
  danger,
  loading,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  primary?: boolean;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      style={[
        styles.actionButton,
        primary ? styles.actionButtonPrimary : null,
        danger ? styles.actionButtonDanger : null,
        loading ? styles.disabled : null,
      ]}
      disabled={loading}
      onPress={onPress}
    >
      {loading ? (
        <ActivityIndicator size="small" color={primary ? colors.primaryTextOn : colors.primaryStrong} />
      ) : (
        <>
          <Ionicons
            name={icon}
            size={16}
            color={primary ? colors.primaryTextOn : danger ? colors.dangerText : colors.primaryStrong}
          />
          <Text
            style={[
              styles.actionButtonText,
              primary ? styles.actionButtonTextPrimary : null,
              danger ? styles.actionButtonTextDanger : null,
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function EmptyMeetingCopy({ text }: { text: string }) {
  return (
    <View style={styles.emptyBox}>
      <Ionicons name="calendar-outline" size={22} color={colors.mutedText} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}
