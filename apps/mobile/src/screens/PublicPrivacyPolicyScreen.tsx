import { routeHrefs } from '@painel-prime/app/navigation';
import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { goBackOrReplace } from '../lib/router';
import { colors } from '../theme/colors';
import { typography } from '../theme/fonts';

const updateDate = '21 de outubro de 2026';
const DELETION_URL = 'https://painelprime.com.br/privacidade/exclusao-de-dados';

const sections = [
  {
    title: '1. Papel do Painel Prime no Tratamento de Dados',
    paragraphs: [
      'Na maior parte dos fluxos operacionais ligados a convidados, confirmações de presença (RSVP), mesas, cronogramas, reuniões e documentos do evento, o Painel Prime atua estritamente como operador de dados pessoais em nome dos clientes organizadores (noivos, aniversariantes, comissões, cerimonialistas e assessorias de eventos), que figuram como controladores perante a LGPD.',
      'Em fluxos próprios da plataforma (cadastro de contas, autenticação, cobrança de planos de assinatura, suporte técnico, telemetria de performance e segurança), o Painel Prime atua como controlador dos dados estritamente necessários para prestar e proteger a plataforma.',
    ],
  },
  {
    title: '2. Dados Tratados e Categorias Coletadas',
    paragraphs: [
      'Podemos tratar dados cadastrais e de contato (nome completo, e-mail, telefone, cargo e empresa), informações de eventos e noivos, listas de convidados (nomes, parentesco, mesa alocada e restrições informadas), histórico do CRM, atas geradas por inteligência artificial e registros técnicos de conexão.',
      'Não comercializamos dados pessoais com terceiros e não utilizamos os dados para finalidades incompatíveis com o serviço contratado.',
    ],
  },
  {
    title: '3. Finalidades e Bases Legais',
    paragraphs: [
      'Os dados são tratados para viabilizar a organização do evento, confirmação de presença (RSVP), controle de acesso, gestão de assinaturas, atendimento de suporte, cumprimento de obrigações legais (Marco Civil da Internet e normas fiscais) e legítimo interesse para segurança da plataforma.',
    ],
  },
  {
    title: '4. Subprocessadores, Telemetria Técnica e Mensuração (Sentry e Meta)',
    paragraphs: [
      'Para garantir estabilidade, segurança e diagnóstico preventivo, compartilhamos dados técnicos exclusivamente com subprocessadores homologados:',
      '• Sentry (Telemetria Técnica e Crashes): Coleta diagnósticos de performance, relatórios de falha (crash logs) e stack traces das aplicações. Dados de identificação pessoal (PII como e-mails e senhas) passam por sanitização ativa antes do envio.',
      '• Meta Platforms / WhatsApp Business (Mensageria e Mensuração Web): Mensuração institucional via Meta Pixel e Conversions API (CAPI) com hashing criptográfico SHA-256 no portal web, além de disparos oficiais de confirmação de presença (RSVP) via API do WhatsApp.',
      '• Supabase & Cloudflare: Provedores de banco de dados relacional e infraestrutura em nuvem protegidos por criptografia em trânsito (TLS 1.3) e em repouso (AES-256).',
    ],
  },
  {
    title: '5. Autenticação e Biometria Local no Aparelho',
    paragraphs: [
      'A autenticação dos usuários é realizada via Supabase Auth, utilizando tokens de sessão criptografados (JWT).',
      'O recurso de entrada por biometria no aplicativo Android opera 100% no hardware de segurança do dispositivo (Android Keystore / Secure Element via expo-local-authentication). O Painel Prime NÃO armazena, NÃO transmite e NÃO tem acesso a impressões digitais, mapeamentos faciais ou dados biométricos do usuário.',
    ],
  },
  {
    title: '6. Recepção Offline e Retenção de Dados',
    paragraphs: [
      'Para viabilizar a recepção presencial sem conexão à internet, o aplicativo pode manter um snapshot local temporário e criptografado da lista de convidados. Sem sessão ativa, esse snapshot é purgado automaticamente em até 48 horas.',
      'Registros de conexão e logs de acesso a aplicações de internet são retidos sob sigilo por 6 meses conforme exigência do Artigo 15 do Marco Civil da Internet (Lei 12.965/2014), com expurgo automatizado após o prazo.',
    ],
  },
  {
    title: '7. Exclusão de Conta e Dados Pessoais (LGPD & Google Play)',
    paragraphs: [
      'Conforme as políticas da Google Play Store e a LGPD, você pode excluir sua conta e dados pessoais diretamente no app em Mais > Perfil ou Mais > Configurações > Zona de Perigo, confirmando a ação com a digitação de "EXCLUIR MINHA CONTA".',
      'Caso não tenha o aplicativo instalado, você pode solicitar a exclusão pela nossa página web pública oficial ou via e-mail direto com nosso DPO.',
    ],
  },
  {
    title: '8. Direitos do Titular e Contato do DPO',
    paragraphs: [
      'O titular pode solicitar confirmação de tratamento, acesso, retificação, eliminação, portabilidade ou revogação do consentimento contatando nosso Encarregado pelo e-mail oficial: lgpd@painelprime.com.br.',
      'O prazo regulamentar de resposta é de até 15 (quinze) dias corridos.',
    ],
  },
];

export function PublicPrivacyPolicyScreen() {
  const router = useRouter();

  async function openDeletionUrl() {
    try {
      await Linking.openURL(DELETION_URL);
    } catch {
      // noop
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Pressable
        onPress={() => goBackOrReplace(router, routeHrefs.landing())}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={styles.backButton}
        accessibilityRole="button"
        accessibilityLabel="Voltar para a tela anterior"
      >
        <Ionicons name="arrow-back" size={20} color="#DEC479" />
        <Text style={styles.backText}>Voltar</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.title}>Política de Privacidade</Text>
        <Text style={styles.updated}>Última atualização: {updateDate}</Text>

        <View style={styles.highlight}>
          <Ionicons name="shield-checkmark" size={18} color="#DEC479" />
          <Text style={styles.highlightText}>
            Em fluxos operacionais de eventos, o Painel Prime atua predominantemente como operador de dados sob diretriz dos organizadores. Para solicitar exclusão ou exercer seus direitos, utilize lgpd@painelprime.com.br.
          </Text>
        </View>

        <Pressable
          style={styles.deletionBtn}
          onPress={() => void openDeletionUrl()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Abrir página pública com regras e instruções de exclusão de dados"
        >
          <Ionicons name="trash-outline" size={16} color="#DEC479" />
          <Text style={styles.deletionBtnText}>Página pública de exclusão de conta e dados →</Text>
        </Pressable>

        {sections.map((section) => (
          <Section key={section.title} title={section.title} paragraphs={section.paragraphs} />
        ))}
      </View>
    </ScrollView>
  );
}

function Section({ title, paragraphs }: { title: string; paragraphs: string[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {paragraphs.map((paragraph, idx) => (
        <Text key={idx} style={styles.sectionText}>
          {paragraph}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#0A0D14',
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 36,
  },
  backButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  backText: {
    color: '#DEC479',
    fontSize: 14,
    fontFamily: typography.fontFamily.sansSemiBold,
  },
  card: {
    backgroundColor: '#11141E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 18,
    gap: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontFamily: typography.fontFamily.sansBold,
  },
  updated: {
    color: '#A1A1AA',
    fontSize: 12,
    fontFamily: typography.fontFamily.sansMedium,
  },
  highlight: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(222, 196, 121, 0.3)',
    backgroundColor: 'rgba(222, 196, 121, 0.08)',
    padding: 14,
    alignItems: 'flex-start',
  },
  highlightText: {
    color: '#E4E4E7',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: typography.fontFamily.sansMedium,
    flex: 1,
  },
  deletionBtn: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(222, 196, 121, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(222, 196, 121, 0.35)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  deletionBtnText: {
    color: '#DEC479',
    fontSize: 13,
    fontFamily: typography.fontFamily.sansBold,
    flex: 1,
  },
  section: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 14,
  },
  sectionTitle: {
    color: '#F4F4F5',
    fontSize: 15,
    fontFamily: typography.fontFamily.sansBold,
  },
  sectionText: {
    color: '#A1A1AA',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: typography.fontFamily.sans,
  },
});
