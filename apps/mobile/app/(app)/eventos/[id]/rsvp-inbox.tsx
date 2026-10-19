import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../../src/lib/supabase';
import { colors } from '../../../../src/theme/colors';
import { RsvpInboxScreen } from '../../../../src/features/rsvp-inbox/RsvpInboxScreen';

export default function EventRsvpInboxRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const eventId = Array.isArray(params.id) ? params.id[0] ?? '' : params.id ?? '';

  const [eventName, setEventName] = useState<string>('Evento');

  useEffect(() => {
    if (!eventId) return;
    let isMounted = true;
    void supabase
      .from('events')
      .select('id, name')
      .eq('id', eventId)
      .maybeSingle()
      .then(({ data }) => {
        if (!isMounted || !data) return;
        setEventName(data.name || 'Evento');
      });

    return () => {
      isMounted = false;
    };
  }, [eventId]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Voltar aos detalhes do evento"
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Inbox WhatsApp RSVP
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {eventName}
          </Text>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.contentWrap}>
        <RsvpInboxScreen eventId={eventId} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 1,
  },
  contentWrap: {
    flex: 1,
  },
});
