import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useId } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { colors } from '../../theme/colors';
import { WHATSAPP_CREDITS_CATALOG } from './constants';

type Props = {
  currentCredits: number;
  loading: boolean;
  onBuyPackage: (packageId: string) => void;
};

export function WhatsappCreditsSection({ currentCredits, loading, onBuyPackage }: Props) {
  const gradientId = `whatsapp-wallet-grad-${useId().replace(/:/g, '')}`;

  return (
    <View style={styles.container}>
      {/* Wallet Card com Saldo Atual de Créditos */}
      <View style={styles.walletCard}>
        <View style={styles.walletHeader}>
          <View style={styles.walletIconWrap}>
            <MaterialCommunityIcons name="whatsapp" size={24} color="#16A34A" />
          </View>
          <View style={styles.walletCopy}>
            <Text style={styles.walletTitle}>Disparos WhatsApp Plan IA</Text>
            <Text style={styles.walletSubtitle}>
              RSVP Oficial com inteligência artificial cognitiva
            </Text>
          </View>
          <View style={styles.balanceBadge}>
            <Text style={styles.balanceNumber}>{currentCredits}</Text>
            <Text style={styles.balanceLabel}>créditos</Text>
          </View>
        </View>
        <Text style={styles.walletExplainer}>
          1 crédito = 1 mensagem enviada. Respostas e acompanhantes processados pela IA sem custo adicional.
        </Text>
      </View>

      {/* Título da Seção */}
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>Recarregar Pacotes de Créditos</Text>
        <Text style={styles.sectionSubtitle}>
          Sem mensalidade obrigatória • Créditos nunca expiram
        </Text>
      </View>

      {/* Grid de Pacotes */}
      <View style={styles.packagesGrid}>
        {WHATSAPP_CREDITS_CATALOG.map((pkg) => {
          return (
            <View
              key={pkg.id}
              style={[
                styles.packageCard,
                pkg.popular ? styles.packageCardPopular : null,
              ]}
            >
              {pkg.badge || pkg.popular ? (
                <View style={styles.packageBadge}>
                  <Text style={styles.packageBadgeText}>{pkg.badge || 'Mais Escolhido'}</Text>
                </View>
              ) : null}

              <View style={styles.packageHeader}>
                <Text style={styles.packageName}>{pkg.name}</Text>
                <View style={styles.creditsRow}>
                  <Text style={styles.creditsCount}>{pkg.credits}</Text>
                  <Text style={styles.creditsUnit}>disparos</Text>
                </View>
              </View>

              <View style={styles.pricingWrap}>
                <Text style={styles.priceFormatted}>{pkg.priceFormatted}</Text>
                <Text style={styles.unitPrice}>{pkg.unitPriceFormatted}</Text>
              </View>

              <Text style={styles.packageDescription}>{pkg.description}</Text>

              <View style={styles.featuresList}>
                {pkg.features.slice(0, 3).map((f, i) => (
                  <View key={i} style={styles.featureItem}>
                    <MaterialCommunityIcons name="check" size={14} color="#16A34A" />
                    <Text style={styles.featureText}>{f}</Text>
                  </View>
                ))}
              </View>

              <Pressable
                style={[
                  styles.buyBtn,
                  pkg.popular ? styles.buyBtnPopular : null,
                  loading ? styles.buyBtnDisabled : null,
                ]}
                disabled={loading}
                onPress={() => onBuyPackage(pkg.id)}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.buyBtnText}>Recarregar {pkg.name}</Text>
                )}
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    marginVertical: 8,
  },
  walletCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    padding: 16,
    gap: 10,
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  walletIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  walletCopy: {
    flex: 1,
  },
  walletTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#166534',
  },
  walletSubtitle: {
    fontSize: 11,
    color: '#15803D',
    marginTop: 1,
  },
  balanceBadge: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  balanceNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: '#15803D',
  },
  balanceLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#166534',
  },
  walletExplainer: {
    fontSize: 11,
    color: '#166534',
    lineHeight: 15,
  },
  sectionHeading: {
    gap: 2,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.mutedText,
  },
  packagesGrid: {
    gap: 12,
  },
  packageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  packageCardPopular: {
    borderColor: '#16A34A',
    borderWidth: 2,
    backgroundColor: '#F7FEF9',
  },
  packageBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#16A34A',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
  },
  packageBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  packageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  packageName: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  creditsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  creditsCount: {
    fontSize: 18,
    fontWeight: '900',
    color: '#16A34A',
  },
  creditsUnit: {
    fontSize: 12,
    color: colors.mutedText,
  },
  pricingWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  priceFormatted: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
  },
  unitPrice: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedText,
  },
  packageDescription: {
    fontSize: 12,
    color: colors.mutedText,
    lineHeight: 16,
  },
  featuresList: {
    gap: 6,
    paddingTop: 4,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  featureText: {
    fontSize: 12,
    color: colors.text,
  },
  buyBtn: {
    backgroundColor: colors.text,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  buyBtnPopular: {
    backgroundColor: '#16A34A',
  },
  buyBtnDisabled: {
    opacity: 0.6,
  },
  buyBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
