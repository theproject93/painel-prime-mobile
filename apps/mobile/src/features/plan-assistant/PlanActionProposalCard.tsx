import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppHaptics } from '../../lib/haptics';
import { colors } from '../../theme/colors';
import type { PlanAssistantActionProposal } from './types';

type PlanActionProposalCardProps = {
  proposal: PlanAssistantActionProposal;
  isExecuted?: boolean;
  isCancelled?: boolean;
  executionMessage?: string;
  onConfirm: (proposalId: string, confirmationToken: string) => Promise<void> | void;
  onCancel?: (proposalId: string) => void;
};

export function PlanActionProposalCard({
  proposal,
  isExecuted = false,
  isCancelled = false,
  executionMessage,
  onConfirm,
  onCancel,
}: PlanActionProposalCardProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isFinancial =
    proposal.tool_name.includes('finance') || proposal.tool_name.includes('payment');

  const handleConfirm = async () => {
    if (!proposal.confirmation_token || isConfirming || isExecuted || isCancelled) return;
    setIsConfirming(true);
    setErrorMessage(null);
    try {
      void AppHaptics.medium();
      await onConfirm(proposal.proposal_id, proposal.confirmation_token);
      void AppHaptics.success();
    } catch (err) {
      void AppHaptics.error();
      setErrorMessage(
        err instanceof Error ? err.message : 'Não foi possível confirmar a ação. Tente novamente.',
      );
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancel = () => {
    if (isConfirming || isExecuted || isCancelled) return;
    void AppHaptics.light();
    onCancel?.(proposal.proposal_id);
  };

  if (isExecuted) {
    return (
      <View style={styles.executedContainer}>
        <View style={styles.statusHeader}>
          <Ionicons name="checkmark-circle" size={16} color="#059669" />
          <Text style={styles.executedTitle}>Ação confirmada e executada</Text>
        </View>
        <Text style={styles.executedDescription}>
          {executionMessage || 'As alterações foram registradas com sucesso no sistema.'}
        </Text>
      </View>
    );
  }

  if (isCancelled) {
    return (
      <View style={styles.cancelledContainer}>
        <View style={styles.statusHeader}>
          <Ionicons name="close-circle-outline" size={16} color={colors.mutedText} />
          <Text style={styles.cancelledTitle}>Proposta de ação cancelada pelo usuário.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.badgeRow}>
          <Ionicons
            name={isFinancial ? 'cash-outline' : 'sparkles-outline'}
            size={14}
            color={isFinancial ? '#059669' : colors.primaryStrong}
          />
          <Text
            style={[
              styles.badgeText,
              { color: isFinancial ? '#059669' : colors.primaryStrong },
            ]}
          >
            Ação proposta pela Plan IA
          </Text>
        </View>
        <View style={styles.expireRow}>
          <Ionicons name="time-outline" size={12} color={colors.mutedText} />
          <Text style={styles.expireText}>Expira em 15 min</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>{proposal.title || 'Ação assistida'}</Text>
        {proposal.description ? (
          <Text style={styles.description}>{proposal.description}</Text>
        ) : null}
      </View>

      {errorMessage ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={14} color="#DC2626" />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      <View style={styles.actionsRow}>
        <Pressable
          style={[styles.confirmButton, isConfirming && styles.buttonDisabled]}
          onPress={handleConfirm}
          disabled={isConfirming}
          accessibilityRole="button"
          accessibilityLabel="Confirmar ação agora"
        >
          {isConfirming ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark" size={15} color="#FFFFFF" />
              <Text style={styles.confirmButtonText}>Confirmar agora</Text>
            </>
          )}
        </Pressable>

        {onCancel ? (
          <Pressable
            style={[styles.cancelButton, isConfirming && styles.buttonDisabled]}
            onPress={handleCancel}
            disabled={isConfirming}
            accessibilityRole="button"
            accessibilityLabel="Cancelar proposta"
          >
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  expireRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  expireText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.mutedText,
  },
  body: {
    gap: 4,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  description: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorText: {
    fontSize: 11,
    color: '#B91C1C',
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.primaryStrong,
  },
  confirmButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cancelButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  cancelButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  executedContainer: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
    padding: 10,
    gap: 4,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  executedTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  executedDescription: {
    fontSize: 10,
    color: '#047857',
    lineHeight: 14,
  },
  cancelledContainer: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F8FAFC',
    padding: 8,
  },
  cancelledTitle: {
    fontSize: 11,
    color: colors.mutedText,
    fontStyle: 'italic',
  },
});
