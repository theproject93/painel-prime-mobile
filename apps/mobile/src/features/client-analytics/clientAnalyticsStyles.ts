import { StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

export const clientAnalyticsStyles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statPlaceholder: {
    flex: 1,
  },
  funnelCard: {
    gap: 10,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  funnelBars: {
    gap: 8,
  },
  funnelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  funnelLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '600',
    width: 100,
  },
  funnelBarTrack: {
    flex: 1,
    height: 18,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  funnelBar: {
    height: '100%',
    borderRadius: 4,
  },
  funnelCount: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    width: 32,
    textAlign: 'right',
  },
  pipelineCard: {
    gap: 10,
  },
  pipelineTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pipelineTotalLabel: {
    color: colors.mutedText,
    fontSize: 13,
    fontWeight: '600',
  },
  pipelineTotalValue: {
    color: colors.primaryStrong,
    fontSize: 20,
    fontWeight: '800',
  },
  emptyText: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 8,
  },
  pipelineStages: {
    gap: 8,
  },
  pipelineStageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    backgroundColor: colors.surfaceSubtle,
  },
  pipelineStageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pipelineStageDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  pipelineStageLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  pipelineStageCount: {
    color: colors.mutedText,
    fontSize: 11,
  },
  pipelineStageValue: {
    color: colors.primaryStrong,
    fontSize: 13,
    fontWeight: '700',
  },
  conversionCard: {
    gap: 10,
  },
  conversionMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  conversionMainLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  conversionMainHint: {
    color: colors.mutedText,
    fontSize: 12,
    marginTop: 2,
  },
  conversionMainRate: {
    color: colors.successText,
    fontSize: 26,
    fontWeight: '800',
  },
  conversionDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  conversionSubtitle: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '700',
  },
  conversionStageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  conversionStageLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '600',
    width: 130,
  },
  conversionStageBarTrack: {
    flex: 1,
    height: 14,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  conversionStageBar: {
    height: '100%',
    borderRadius: 3,
  },
  conversionStageRate: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    width: 44,
    textAlign: 'right',
  },
  errorBanner: {
    backgroundColor: colors.dangerBg,
    borderRadius: 8,
    padding: 10,
  },
  errorText: {
    color: colors.dangerText,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
