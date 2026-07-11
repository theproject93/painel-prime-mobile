import { useState, useRef } from 'react';
import { Animated, Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { routeHrefs } from '@painel-prime/app/navigation';
import { typography } from '../theme/fonts';
import { colors } from '../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PLANS = [
  { id: 'essencial', name: 'Essencial', price: 'R$ 39/m', desc: 'CRM + Eventos + Convites', popular: false },
  { id: 'profissional', name: 'Profissional', price: 'R$ 59/m', desc: 'Tudo do Essencial + Torre + Financeiro', popular: true },
  { id: 'elite', name: 'Elite', price: 'R$ 89/m', desc: 'Tudo + IA comercial + automações avançadas', popular: false },
];

const FEATURES = [
  { icon: 'grid-outline' as const, title: 'Mapa de Mesas', desc: 'Layout interativo com drag and drop' },
  { icon: 'heart-outline' as const, title: 'Site dos Noivos', desc: 'Portal personalizável para cada casal' },
  { icon: 'people-outline' as const, title: 'Recepção & RSVP', desc: 'Confirmações em tempo real' },
  { icon: 'chatbubbles-outline' as const, title: 'Plan IA', desc: 'Inteligência artificial comercial' },
  { icon: 'trending-up-outline' as const, title: 'Financeiro', desc: 'Relatórios e controle de despesas' },
  { icon: 'briefcase-outline' as const, title: 'Fornecedores', desc: 'Central de homologação' },
];

const FAQ_ITEMS = [
  { q: 'O que está incluído no teste grátis?', a: '30 dias de acesso completo a todos os recursos do plano escolhido, sem necessidade de cartão de crédito.' },
  { q: 'Posso mudar de plano depois?', a: 'Sim, você pode fazer upgrade ou downgrade a qualquer momento. A diferença é ajustada na cobrança.' },
  { q: 'O app funciona offline?', a: 'Sim, as principais funcionalidades operam offline e sincronizam quando houver conexão.' },
  { q: 'Como funciona o suporte?', a: 'Suporte via chat no app, WhatsApp e e-mail. Planos Elite têm prioridade máxima.' },
  { q: 'Posso cancelar quando quiser?', a: 'Sim, cancele a qualquer momento sem multa. Seu acesso continua até o fim do período pago.' },
];

function FadeInView({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: any }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;

  useState(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 600, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 600, delay, useNativeDriver: true }),
    ]).start();
  });

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

export function LandingScreen() {
  const router = useRouter();
  const player = useVideoPlayer(require('../../assets/hero-video.mp4'), (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
    videoPlayer.play();
  });
  const [scrolled, setScrolled] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  return (
    <View style={styles.page}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        scrollEventThrottle={16}
        onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > 20)}
      >
        {/* Header */}
        <View style={[styles.header, scrolled && styles.headerScrolled]}>
          <Text style={styles.logo}>Painel Prime</Text>
          <Pressable
            style={styles.loginBtn}
            onPress={() => router.push(routeHrefs.login())}
          >
            <Text style={styles.loginBtnText}>Entrar</Text>
          </Pressable>
        </View>

        {/* Hero */}
        <View style={styles.heroWrap}>
          <VideoView player={player} style={styles.video} contentFit="cover" allowsPictureInPicture={false} />
          <Image
            source={require('../../assets/plan-face-real.png')}
            style={styles.heroPoster}
            resizeMode="cover"
          />
          <View style={styles.heroShade} />
          <View style={styles.heroOverlay} />
          <View style={styles.heroGradient} />
          <View style={styles.heroRadial} />

          <FadeInView style={styles.heroContent}>
            <View style={styles.badge}>
              <View style={styles.badgeDot} />
              <Text style={styles.badgeText}>Versão 3.0</Text>
            </View>
            <Text style={styles.heroTitle}>
              Software de operação para assessorias que{' '}
              <Text style={styles.heroHighlight}>não admitem erros.</Text>
            </Text>
            <Text style={styles.heroSub}>
              CRM, eventos, reuniões, financeiro e portais públicos no mesmo ecossistema.
            </Text>
            <View style={styles.metricsRow}>
              {[{ v: 'CRM', l: 'pipeline' }, { v: 'Eventos', l: 'timeline' }, { v: 'Portais', l: 'noivos' }].map((m) => (
                <View key={m.v} style={styles.metricPill}>
                  <Text style={styles.metricValue}>{m.v}</Text>
                  <Text style={styles.metricLabel}>{m.l}</Text>
                </View>
              ))}
            </View>
            <View style={styles.ctaRow}>
              <Pressable style={styles.primaryBtn} onPress={() => router.push(routeHrefs.signup('profissional'))}>
                <Text style={styles.primaryBtnText}>Começar Agora</Text>
                <Ionicons name="arrow-forward" size={16} color="#151922" />
              </Pressable>
              <Pressable style={styles.secondaryBtn} onPress={() => router.push(routeHrefs.login())}>
                <Ionicons name="play" size={14} color="#FFFFFF" />
                <Text style={styles.secondaryBtnText}>Ver Recursos</Text>
              </Pressable>
            </View>
          </FadeInView>
        </View>

        {/* Features */}
        <FadeInView delay={200} style={styles.section}>
          <Text style={styles.sectionTag}>RECURSOS</Text>
          <Text style={styles.sectionTitle}>Tudo que sua assessoria precisa</Text>
          <View style={styles.featuresGrid}>
            {FEATURES.map((f) => (
              <View key={f.title} style={styles.featureCard}>
                <View style={styles.featureIconWrap}>
                  <Ionicons name={f.icon} size={22} color={colors.primary} />
                </View>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            ))}
          </View>
        </FadeInView>

        {/* Plans */}
        <FadeInView delay={300} style={styles.section}>
          <Text style={styles.sectionTag}>PLANOS</Text>
          <Text style={styles.sectionTitle}>Escolha o ideal para você</Text>
          <View style={styles.planGrid}>
            {PLANS.map((plan) => (
              <View key={plan.id} style={[styles.planCard, plan.popular && styles.planCardPopular]}>
                {plan.popular && (
                  <View style={styles.planBadge}>
                    <Text style={styles.planBadgeText}>Recomendado</Text>
                  </View>
                )}
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planPrice}>{plan.price}</Text>
                <Text style={styles.planDesc}>{plan.desc}</Text>
                <Pressable
                  style={[styles.planBtn, plan.popular ? styles.planBtnPrimary : styles.planBtnOutline]}
                  onPress={() => router.push(routeHrefs.signup(plan.id))}
                >
                  <Text style={[styles.planBtnText, plan.popular && styles.planBtnTextPrimary]}>
                    Assinar
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        </FadeInView>

        {/* Plan IA */}
        <FadeInView delay={400} style={styles.section}>
          <Text style={styles.sectionTag}>PLAN IA</Text>
          <Text style={styles.sectionTitle}>Atendimento inteligente</Text>
          <Text style={styles.sectionText}>
            Tire dúvidas, receba recomendações de plano e agilize sua assinatura com nossa IA comercial.
          </Text>
          <Pressable
            style={styles.iaBtn}
            onPress={() => router.push(routeHrefs.legacyAi())}
          >
            <Ionicons name="sparkles" size={18} color="#FFFFFF" />
            <Text style={styles.iaBtnText}>Falar com Plan IA</Text>
          </Pressable>
        </FadeInView>

        {/* FAQ */}
        <FadeInView delay={500} style={styles.section}>
          <Text style={styles.sectionTag}>FAQ</Text>
          <Text style={styles.sectionTitle}>Perguntas frequentes</Text>
          {FAQ_ITEMS.map((item, idx) => (
            <View key={idx} style={styles.faqItem}>
              <Pressable style={styles.faqHeader} onPress={() => setFaqOpen(faqOpen === idx ? null : idx)}>
                <Text style={styles.faqQuestion}>{item.q}</Text>
                <Ionicons
                  name={faqOpen === idx ? 'remove' : 'add'}
                  size={20}
                  color="#A1A1AA"
                />
              </Pressable>
              {faqOpen === idx && (
                <Text style={styles.faqAnswer}>{item.a}</Text>
              )}
            </View>
          ))}
        </FadeInView>

        {/* CTA */}
        <FadeInView delay={600} style={styles.ctaSection}>
          <View style={styles.ctaGlow} />
          <Text style={styles.ctaTitle}>Pronto para transformar sua operação?</Text>
          <Text style={styles.ctaText}>30 dias grátis. Sem compromisso. Sem cartão de crédito.</Text>
          <Pressable style={styles.ctaBtn} onPress={() => router.push(routeHrefs.signup('profissional'))}>
            <Text style={styles.ctaBtnText}>Experimentar Grátis</Text>
            <Ionicons name="arrow-forward" size={16} color="#151922" />
          </Pressable>
        </FadeInView>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerLogo}>Painel Prime</Text>
          <View style={styles.footerLinks}>
            <Pressable onPress={() => router.push(routeHrefs.privacyPolicy())}>
              <Text style={styles.footerLink}>Política de Privacidade</Text>
            </Pressable>
            <Pressable>
              <Text style={styles.footerLink}>Termos de Uso</Text>
            </Pressable>
          </View>
          <Text style={styles.footerCopy}>© 2026 Painel Prime. Todos os direitos reservados.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#111113' },
  scroll: { flex: 1 },
  content: { paddingBottom: 0 },

  // Header
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, paddingTop: 48,
  },
  headerScrolled: {
    backgroundColor: 'rgba(17,17,19,0.85)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  logo: { fontFamily: typography.fontFamily.sansBold, fontSize: 20, color: '#FFFFFF' },
  loginBtn: {
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 999,
    paddingHorizontal: 18, paddingVertical: 8,
  },
  loginBtnText: { fontFamily: typography.fontFamily.sansSemiBold, fontSize: 13, color: '#FFFFFF' },

  // Hero
  heroWrap: { height: 600, overflow: 'hidden' },
  video: { ...StyleSheet.absoluteFillObject },
  heroPoster: {
    position: 'absolute', right: -8, bottom: 0, width: 200, height: 300, opacity: 0.28,
  },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(17,17,19,0.35)' },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.40)' },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
    opacity: 0.6,
  },
  heroRadial: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    opacity: 0.15,
  },
  heroContent: { flex: 1, justifyContent: 'flex-end', padding: 20, gap: 12, paddingBottom: 32 },
  badge: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(17,17,25,0.45)', borderWidth: 1, borderColor: 'rgba(222,196,121,0.25)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#DEC479' },
  badgeText: { fontFamily: typography.fontFamily.sansSemiBold, fontSize: 11, color: '#DEC479' },
  heroTitle: {
    fontFamily: typography.fontFamily.sansExtraBold, fontSize: 28, lineHeight: 34,
    color: '#FFFFFF', maxWidth: 340,
  },
  heroHighlight: { color: '#DEC479' },
  heroSub: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: 14, lineHeight: 20,
    color: '#D4D4D8', maxWidth: 320,
  },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metricPill: {
    minWidth: 90, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    gap: 2,
  },
  metricValue: { fontFamily: typography.fontFamily.sansExtraBold, fontSize: 12, color: '#FFFFFF' },
  metricLabel: { fontFamily: typography.fontFamily.sansMedium, fontSize: 10, color: '#A1A1AA' },
  ctaRow: { gap: 10, marginTop: 8 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#DEC479', minHeight: 50, borderRadius: 999,
    shadowColor: '#DEC479', shadowOpacity: 0.3, shadowRadius: 20, elevation: 8,
  },
  primaryBtnText: { fontFamily: typography.fontFamily.sansBold, fontSize: 14, color: '#151922' },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(23,23,25,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    minHeight: 50, borderRadius: 999,
  },
  secondaryBtnText: { fontFamily: typography.fontFamily.sansBold, fontSize: 14, color: '#FFFFFF' },

  // Sections
  section: { paddingHorizontal: 16, paddingTop: 40, paddingBottom: 16, gap: 12 },
  sectionTag: {
    fontFamily: typography.fontFamily.sansBold, fontSize: 11, color: '#DEC479',
    letterSpacing: 2,
  },
  sectionTitle: {
    fontFamily: typography.fontFamily.sansBold, fontSize: 22, color: '#FFFFFF',
  },
  sectionText: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: 14, lineHeight: 20, color: '#A1A1AA',
  },

  // Features
  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  featureCard: {
    width: (SCREEN_WIDTH - 42) / 2,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    padding: 14, gap: 8,
  },
  featureIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(201,165,77,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  featureTitle: { fontFamily: typography.fontFamily.sansBold, fontSize: 14, color: '#FFFFFF' },
  featureDesc: { fontFamily: typography.fontFamily.sansMedium, fontSize: 12, color: '#A1A1AA' },

  // Plans
  planGrid: { gap: 10 },
  planCard: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    padding: 16, gap: 6,
  },
  planCardPopular: {
    borderColor: '#DEC479', backgroundColor: 'rgba(222,196,121,0.06)',
  },
  planBadge: {
    alignSelf: 'flex-start', backgroundColor: '#DEC479',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginBottom: 4,
  },
  planBadgeText: { fontFamily: typography.fontFamily.sansBold, fontSize: 10, color: '#151922' },
  planName: { fontFamily: typography.fontFamily.sansBold, fontSize: 16, color: '#FFFFFF' },
  planPrice: { fontFamily: typography.fontFamily.sansExtraBold, fontSize: 24, color: '#DEC479' },
  planDesc: { fontFamily: typography.fontFamily.sansMedium, fontSize: 12, color: '#A1A1AA' },
  planBtn: {
    marginTop: 8, minHeight: 42, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
  },
  planBtnPrimary: { backgroundColor: '#DEC479' },
  planBtnOutline: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  planBtnText: { fontFamily: typography.fontFamily.sansBold, fontSize: 13, color: '#FFFFFF' },
  planBtnTextPrimary: { color: '#151922' },

  // IA
  iaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(107,91,255,0.15)', borderWidth: 1, borderColor: 'rgba(107,91,255,0.3)',
    minHeight: 48, borderRadius: 999,
  },
  iaBtnText: { fontFamily: typography.fontFamily.sansBold, fontSize: 14, color: '#FFFFFF' },

  // FAQ
  faqItem: {
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    overflow: 'hidden',
  },
  faqHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14,
  },
  faqQuestion: {
    fontFamily: typography.fontFamily.sansSemiBold, fontSize: 14, color: '#FFFFFF', flex: 1,
  },
  faqAnswer: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: 13, lineHeight: 20,
    color: '#A1A1AA', paddingHorizontal: 14, paddingBottom: 14,
  },

  // CTA
  ctaSection: {
    marginHorizontal: 16, marginTop: 40, marginBottom: 40,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    padding: 24, gap: 12, alignItems: 'center', overflow: 'hidden',
  },
  ctaGlow: {
    position: 'absolute', top: -80, width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(201,165,77,0.08)',
  },
  ctaTitle: {
    fontFamily: typography.fontFamily.sansBold, fontSize: 20, color: '#FFFFFF', textAlign: 'center',
  },
  ctaText: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: 13, color: '#A1A1AA', textAlign: 'center',
  },
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#DEC479', minHeight: 48, borderRadius: 999,
    paddingHorizontal: 28, marginTop: 4,
  },
  ctaBtnText: { fontFamily: typography.fontFamily.sansBold, fontSize: 14, color: '#151922' },

  // Footer
  footer: {
    paddingHorizontal: 16, paddingVertical: 24,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
    gap: 12, alignItems: 'center',
  },
  footerLogo: { fontFamily: typography.fontFamily.sansBold, fontSize: 16, color: '#FFFFFF' },
  footerLinks: { flexDirection: 'row', gap: 20 },
  footerLink: { fontFamily: typography.fontFamily.sansMedium, fontSize: 12, color: '#A1A1AA' },
  footerCopy: { fontFamily: typography.fontFamily.sansMedium, fontSize: 11, color: '#52525B' },
});
