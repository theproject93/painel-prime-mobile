import { routeHrefs } from '@painel-prime/app/navigation';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { PublicAccessState } from '../components/PublicAccessState';
import { getPortfolioShareFileDownloadUrl } from '../lib/r2FileStorage';
import { supabase } from '../lib/supabase';
import { goBackOrReplace, normalizeSingleParam } from '../lib/router';
import { colors } from '../theme/colors';

type PortfolioSharePayload = {
  title: string;
  pdf_file_id?: string | null;
  pdf_url: string;
  sender_name: string | null;
  sender_email: string | null;
  sender_whatsapp: string | null;
  sender_instagram: string | null;
  created_at: string;
};

export function PublicPortfolioScreen() {
  const router = useRouter();
  const { token: routeToken } = useLocalSearchParams<{ token?: string | string[] }>();
  const token = normalizeSingleParam(routeToken);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [share, setShare] = useState<PortfolioSharePayload | null>(null);
  const [pdfUrl, setPdfUrl] = useState('');

  useEffect(() => {
    async function loadShare() {
      setLoading(true);
      const { data, error: rpcError } = await supabase.rpc('get_portfolio_share_by_token', {
        p_token: token,
      });
      if (rpcError) {
        setError('Não foi possível abrir o portfólio.');
      } else if (Array.isArray(data) && data[0]) {
        const nextShare = data[0] as PortfolioSharePayload;
        setShare(nextShare);
        if (nextShare.pdf_file_id) {
          try {
            const signedUrl = await getPortfolioShareFileDownloadUrl(nextShare.pdf_file_id, token);
            setPdfUrl(signedUrl);
          } catch {
            setError('Não foi possível abrir o PDF agora.');
          }
        } else {
          setPdfUrl(nextShare.pdf_url);
        }
      } else {
        setError('Este link expirou ou não existe.');
      }
      setLoading(false);
    }
    void loadShare();
  }, [token]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primaryStrong} />
      </View>
    );
  }

  if (!share) {
    return (
      <View style={styles.emptyPage}>
        <PublicAccessState
          eyebrow="PORTFOLIO PRIVADO"
          title="Não foi possível abrir este portfólio"
          description="Esse link pode ter sido encerrado, substituido ou digitado de forma incompleta."
          detail={error || 'Abra novamente a mensagem original ou solicite um novo compartilhamento.'}
          primaryLabel="Ir para o início"
          onPrimaryPress={() => router.replace(routeHrefs.landing())}
          secondaryLabel="Voltar"
          onSecondaryPress={() => goBackOrReplace(router, routeHrefs.landing())}
        />
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <Pressable onPress={() => goBackOrReplace(router, routeHrefs.landing())}>
        <Text style={styles.back}>Voltar</Text>
      </Pressable>
      <View style={styles.card}>
        <Text style={styles.title}>{share?.title || 'Portfolio'}</Text>
        {error ? <Text style={styles.err}>{error}</Text> : null}
        {share ? (
          <>
            <Text style={styles.meta}>Publicado em {new Date(share.created_at).toLocaleDateString('pt-BR')}</Text>
            <Text style={styles.subtitle}>Contato</Text>
            <Text style={styles.meta}>{share.sender_name || '-'}</Text>
            <Text style={styles.meta}>{share.sender_email || '-'}</Text>
            <Text style={styles.meta}>{share.sender_whatsapp || '-'}</Text>
            <Text style={styles.meta}>{share.sender_instagram || '-'}</Text>
            <Pressable style={styles.button} onPress={() => void Linking.openURL(pdfUrl || share.pdf_url)}>
              <Text style={styles.buttonText}>Abrir portfolio (PDF)</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background, padding: 16, gap: 8 },
  emptyPage: { flex: 1, justifyContent: 'center', backgroundColor: '#F5F5F4', padding: 18 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  back: { color: colors.mutedText, fontSize: 13, fontWeight: '600' },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, gap: 8 },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  subtitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  meta: { color: colors.mutedText, fontSize: 12, fontWeight: '600' },
  err: { color: colors.dangerText, backgroundColor: colors.dangerBg, borderRadius: 8, padding: 8 },
  button: { minHeight: 42, borderRadius: 10, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
