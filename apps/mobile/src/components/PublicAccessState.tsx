import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

type PublicAccessStateProps = {
  eyebrow: string;
  title: string;
  description: string;
  detail?: string;
  primaryLabel: string;
  onPrimaryPress: () => void;
  secondaryLabel?: string;
  onSecondaryPress?: () => void;
};

export function PublicAccessState({
  eyebrow,
  title,
  description,
  detail,
  primaryLabel,
  onPrimaryPress,
  secondaryLabel,
  onSecondaryPress,
}: PublicAccessStateProps) {
  return (
    <View style={styles.shell}>
      <View style={styles.heroPanel}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{eyebrow}</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>O que fazer agora</Text>
        <Text style={styles.cardText}>
          Volte para o início do app, solicite um link atualizado ou abra novamente a mensagem
          original para conferir se o endereço está completo.
        </Text>

        <Pressable style={styles.primaryButton} onPress={onPrimaryPress}>
          <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
        </Pressable>

        {secondaryLabel && onSecondaryPress ? (
          <Pressable style={styles.secondaryButton} onPress={onSecondaryPress}>
            <Text style={styles.secondaryButtonText}>{secondaryLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    gap: 16,
  },
  heroPanel: {
    backgroundColor: '#16120D',
    borderRadius: 26,
    paddingHorizontal: 22,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
    gap: 10,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: 'rgba(212,175,55,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: {
    color: '#F8E7B7',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
  },
  description: {
    color: '#F3F4F6',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  detail: {
    color: '#D6D3D1',
    fontSize: 13,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E7E5E4',
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 12,
  },
  cardTitle: {
    color: '#1C1917',
    fontSize: 18,
    fontWeight: '700',
  },
  cardText: {
    color: '#57534E',
    fontSize: 14,
    lineHeight: 21,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: colors.primaryTextOn,
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D6D3D1',
    backgroundColor: '#FFFBEB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#57534E',
    fontSize: 13,
    fontWeight: '700',
  },
});
