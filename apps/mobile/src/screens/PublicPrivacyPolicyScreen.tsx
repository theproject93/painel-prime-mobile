import { routeHrefs } from '@painel-prime/app/navigation';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { goBackOrReplace } from '../lib/router';
import { colors } from '../theme/colors';

const updateDate = '10 de abril de 2026';

const sections = [
  {
    title: '1. Papel do Painel Prime',
    paragraphs: [
      'Na maior parte dos fluxos ligados a convidados, listas, RSVP, recepção, documentos e comunicações do evento, o Painel Prime atua como operador de dados pessoais em nome dos clientes organizadores do evento, como noivos, responsáveis, assessorias e equipes autorizadas, que atuam como controladores.',
      'Em fluxos próprios da plataforma, como cadastro, autenticação, cobrança, suporte, segurança e operação administrativa do serviço, o Painel Prime pode atuar como controlador dos dados estritamente necessários para prestar e proteger a plataforma.',
    ],
  },
  {
    title: '2. Dados tratados',
    paragraphs: [
      'Podemos tratar dados de identificação e contato, nomes de convidados, RSVP, mesa, observações, restrições alimentares informadas, documentos, fotos, registros técnicos de acesso, suporte e operação da recepção.',
      'Não vendemos dados pessoais nem usamos os dados do evento para finalidades incompatíveis com a organização do evento ou com a prestação do serviço.',
    ],
  },
  {
    title: '3. Finalidades e base legal',
    paragraphs: [
      'Os dados são tratados para viabilizar a organização do evento, confirmar presença, operar listas e mesas, controlar acessos, permitir uso do portal do cliente, prestar suporte, proteger a segurança da plataforma e manter trilhas de auditoria.',
      'A base legal aplicável pode incluir execução de contrato, procedimentos preliminares, legítimo interesse para segurança e operação do serviço, exercício regular de direitos e, quando necessário, consentimento.',
    ],
  },
  {
    title: '4. Compartilhamento e retenção',
    paragraphs: [
      'Os dados podem ser compartilhados com operadores e subprocessadores necessários para hospedagem, autenticação, banco de dados, armazenamento seguro, envio de e-mails transacionais e infraestrutura de nuvem, além dos controladores do evento e pessoas autorizadas por eles.',
      'Mantemos os dados pelo tempo necessário para cumprir as finalidades desta política, atender exigências legais e resguardar direitos. Quando aplicável, realizamos exclusão, anonimização ou bloqueio dos dados ao fim do ciclo necessário.',
    ],
  },
  {
    title: '5. Recepção offline e segurança',
    paragraphs: [
      'Na recepção, o Painel Prime pode manter um snapshot local temporário dos dados operacionais do evento para permitir funcionamento offline. Esse armazenamento local é efêmero, não substitui o controlador do evento e não é usado como credencial.',
      'Sem sessão ativa, o snapshot local é limpo automaticamente em até 48 horas. Em operação normal, esse ciclo pode ser encerrado antes, inclusive em janelas de 24 horas. O token de acesso da recepção não fica armazenado de forma durável no aparelho.',
    ],
  },
  {
    title: '6. Direitos do titular e contato',
    paragraphs: [
      'O titular pode solicitar acesso, correção, atualização, anonimização, bloqueio, informações sobre compartilhamento e exclusão de dados pessoais, observadas as hipóteses legais aplicáveis e o papel do Painel Prime em cada fluxo.',
      'Para assuntos de privacidade e exercício de direitos, entre em contato com o encarregado pelo canal oficial lgpd@painelprime.com.br. Nosso prazo operacional de resposta é de até 15 dias corridos.',
    ],
  },
];

export function PublicPrivacyPolicyScreen() {
  const router = useRouter();
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Pressable onPress={() => goBackOrReplace(router, routeHrefs.landing())}>
        <Text style={styles.back}>Voltar</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.title}>Política de Privacidade</Text>
        <Text style={styles.updated}>Última atualização: {updateDate}</Text>

        <View style={styles.highlight}>
          <Text style={styles.highlightText}>
            Em fluxos de organização do evento, o Painel Prime atua, em regra, como operador de
            dados pessoais em nome dos clientes organizadores. Para exclusão de dados e exercício
            de direitos, use lgpd@painelprime.com.br.
          </Text>
        </View>

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
      {paragraphs.map((paragraph) => (
        <Text key={paragraph} style={styles.sectionText}>
          {paragraph}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 8, paddingBottom: 28 },
  back: { color: colors.mutedText, fontSize: 13, fontWeight: '600' },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  updated: { color: colors.mutedText, fontSize: 12, fontWeight: '600' },
  highlight: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#b7f0cf',
    backgroundColor: '#ecfdf3',
    padding: 12,
  },
  highlightText: { color: '#166534', fontSize: 13, lineHeight: 20, fontWeight: '600' },
  section: { gap: 6 },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  sectionText: { color: colors.text, fontSize: 13, lineHeight: 20 },
});
