import { routeHrefs } from '@painel-prime/app/navigation';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { PublicAccessState } from '../components/PublicAccessState';
import {
  deleteCouplePortalFile,
  getCouplePortalFileDownloadUrl,
  uploadCouplePortalAsset,
} from '../lib/r2FileStorage';
import { supabase } from '../lib/supabase';
import { goBackOrReplace, normalizeSingleParam } from '../lib/router';
import { colors } from '../theme/colors';

type PortalEvent = {
  event_id: string;
  event_name: string;
  event_date: string;
  location: string | null;
  couple: string | null;
};

type CouplePost = {
  id: string;
  title: string;
  message: string;
  photo_file_id?: string | null;
  photo_url: string | null;
  author_role: 'assessoria' | 'noivos';
  author_name: string | null;
  created_at: string;
};

export function PublicCouplePortalScreen() {
  const router = useRouter();
  const { token: routeToken } = useLocalSearchParams<{ token?: string | string[] }>();
  const token = normalizeSingleParam(routeToken);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [eventInfo, setEventInfo] = useState<PortalEvent | null>(null);
  const [posts, setPosts] = useState<CouplePost[]>([]);
  const [authorName, setAuthorName] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [photoAsset, setPhotoAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);

  const hydratePosts = useCallback(async (rows: CouplePost[]) => {
    return Promise.all(
      rows.map(async (post) => {
        if (!post.photo_file_id) return post;

        try {
          const signedUrl = await getCouplePortalFileDownloadUrl(post.photo_file_id, token);
          return {
            ...post,
            photo_url: signedUrl,
          };
        } catch {
          return post;
        }
      }),
    );
  }, [token]);

  const loadPortal = useCallback(async () => {
    setLoading(true);
    setError('');
    const [eventRes, postsRes] = await Promise.all([
      supabase.rpc('get_couple_portal_event_by_token', { p_token: token }).single(),
      supabase.rpc('get_couple_updates_by_token', { p_token: token }),
    ]);
    if (eventRes.error || !eventRes.data) {
      setError('Link dos noivos inválido ou expirado.');
      setLoading(false);
      return;
    }
    setEventInfo(eventRes.data as PortalEvent);
    const nextPosts = await hydratePosts((postsRes.data as CouplePost[]) ?? []);
    setPosts(nextPosts);
    setLoading(false);
  }, [hydratePosts, token]);

  useEffect(() => {
    void loadPortal();
  }, [loadPortal]);

  const displayName = useMemo(() => {
    if (!eventInfo) return '';
    return eventInfo.couple?.trim() || eventInfo.event_name;
  }, [eventInfo]);

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Permissão da galeria negada.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled || result.assets.length === 0) return;
    setPhotoAsset(result.assets[0]);
  }

  async function uploadPhoto() {
    if (!photoAsset) return null;
    setUploading(true);
    try {
      const ext = (photoAsset.fileName?.split('.').pop() ?? 'jpg').toLowerCase();
      const upload = await uploadCouplePortalAsset({
        uri: photoAsset.uri,
        fileName: `portal-${Date.now()}.${ext}`,
        contentType: photoAsset.mimeType ?? 'image/jpeg',
        byteSize: photoAsset.fileSize ?? null,
        portalToken: token,
      });
      return upload.fileId;
    } catch (uploadError: any) {
      setError(uploadError?.message ?? 'Falha no upload da foto.');
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function publish() {
    if (!message.trim() || saving) return;
    setSaving(true);
    setError('');
    setSuccess('');

    let photoFileId: string | null = null;
    if (photoAsset) {
      photoFileId = await uploadPhoto();
      if (!photoFileId) {
        setSaving(false);
        return;
      }
    }

    const res = await supabase.rpc('create_couple_update_by_token', {
      p_token: token,
      p_title: title.trim() || null,
      p_message: message.trim(),
      p_photo_file_id: photoFileId,
      p_author_name: authorName.trim() || null,
    });
    if (res.error) {
      if (photoFileId) {
        void deleteCouplePortalFile(photoFileId, token).catch(() => {
          // Best effort only.
        });
      }
      setError(res.error.message || 'Não foi possível publicar agora.');
      setSaving(false);
      return;
    }
    setTitle('');
    setMessage('');
    setPhotoAsset(null);
    setSuccess('Publicação enviada com sucesso.');
    setSaving(false);
    await loadPortal();
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primaryStrong} />
      </View>
    );
  }

  if (!eventInfo) {
    return (
      <View style={styles.emptyPage}>
        <PublicAccessState
          eyebrow="PORTAL PRIVADO"
          title="Esse portal não está disponível agora"
          description="O link dos noivos pode ter expirado, sido substituído ou ainda não estar publicado."
          detail={error || 'Solicite um novo link para continuar acompanhando as atualizações do evento.'}
          primaryLabel="Ir para o início"
          onPrimaryPress={() => router.replace(routeHrefs.landing())}
          secondaryLabel="Voltar"
          onSecondaryPress={() => goBackOrReplace(router, routeHrefs.landing())}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Pressable onPress={() => goBackOrReplace(router, routeHrefs.landing())}>
        <Text style={styles.back}>Voltar</Text>
      </Pressable>
      {error ? <Text style={styles.err}>{error}</Text> : null}
      {success ? <Text style={styles.ok}>{success}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.title}>{displayName}</Text>
        <Text style={styles.meta}>
          {new Date(eventInfo.event_date).toLocaleDateString('pt-BR')} | {eventInfo.location || 'Local a definir'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.subtitle}>Compartilhar atualização</Text>
        <TextInput style={styles.input} value={authorName} onChangeText={setAuthorName} placeholder="Seu nome (opcional)" />
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Título (opcional)" />
        <TextInput style={[styles.input, styles.area]} value={message} onChangeText={setMessage} placeholder="Mensagem" multiline />
        <Pressable style={styles.ghostButton} onPress={() => void pickPhoto()}>
          <Text style={styles.ghostButtonText}>{photoAsset ? 'Trocar foto' : 'Adicionar foto'}</Text>
        </Pressable>
        {photoAsset ? <Text style={styles.meta}>{photoAsset.fileName || 'imagem selecionada'}</Text> : null}
        <Pressable style={styles.button} onPress={() => void publish()}>
          <Text style={styles.buttonText}>{saving || uploading ? 'Publicando...' : 'Publicar no mural'}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.subtitle}>Mural</Text>
        {posts.length === 0 ? (
          <Text style={styles.meta}>Sem publicações ainda.</Text>
        ) : (
          posts.map((post) => (
            <View key={post.id} style={styles.post}>
              <Text style={styles.postTitle}>{post.title || 'Atualização'}</Text>
              <Text style={styles.meta}>{new Date(post.created_at).toLocaleString('pt-BR')}</Text>
              <Text style={styles.postMessage}>{post.message}</Text>
              {post.photo_url ? <Image source={{ uri: post.photo_url }} style={styles.postImage} /> : null}
              <Text style={styles.meta}>{post.author_name || (post.author_role === 'noivos' ? 'Noivos' : 'Assessoria')}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FFF7ED' },
  content: { padding: 16, gap: 10, paddingBottom: 26 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF7ED' },
  emptyPage: { flex: 1, justifyContent: 'center', backgroundColor: '#FFF7ED', padding: 18 },
  back: { color: colors.mutedText, fontSize: 13, fontWeight: '600' },
  err: { color: colors.dangerText, backgroundColor: colors.dangerBg, borderRadius: 8, padding: 8 },
  ok: { color: '#166534', backgroundColor: '#ECFDF5', borderRadius: 8, padding: 8 },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, gap: 8 },
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  subtitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  meta: { color: colors.mutedText, fontSize: 12, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, color: colors.text },
  area: { minHeight: 90, textAlignVertical: 'top' },
  button: { minHeight: 42, borderRadius: 10, backgroundColor: '#E11D48', alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  ghostButton: { minHeight: 40, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  ghostButtonText: { color: colors.text, fontWeight: '600', fontSize: 12 },
  post: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 8, gap: 4 },
  postTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  postMessage: { color: colors.text, fontSize: 13, lineHeight: 19 },
  postImage: { width: '100%', height: 180, borderRadius: 10, backgroundColor: '#E5E7EB' },
});
