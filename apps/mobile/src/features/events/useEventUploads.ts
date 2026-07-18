import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import {
  deleteStoredFile,
  getPrivateFileDownloadUrl,
  linkStoredFile,
  uploadPrivateAsset,
} from '../../lib/r2FileStorage';
import { supabase } from '../../lib/supabase';
import type { EventDataState, EventDetailsTab } from './eventDetailsData';
import type { EventRow } from './eventDetailsTypes';

type UseEventUploadsArgs = {
  eventId: string;
  event: EventRow | null;
  setEvent: Dispatch<SetStateAction<EventRow | null>>;
  setData: Dispatch<SetStateAction<EventDataState>>;
  setError: Dispatch<SetStateAction<string>>;
  loadTab: (tab: EventDetailsTab, force?: boolean) => Promise<void>;
};

export function useEventUploads({
  eventId,
  event,
  setEvent,
  setData,
  setError,
  loadTab,
}: UseEventUploadsArgs) {
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingInviteImage, setUploadingInviteImage] = useState(false);
  const [uploadingTeamMemberId, setUploadingTeamMemberId] = useState<string | null>(null);

  async function pickAndUploadDocument() {
    if (uploadingDoc) return;
    setUploadingDoc(true);
    setError('');
    let uploadFileId: string | null = null;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/*',
        ],
      });
      if (result.canceled || result.assets.length === 0) {
        setUploadingDoc(false);
        return;
      }

      const asset = result.assets[0];
      const safeName = asset.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const upload = await uploadPrivateAsset({
        uri: asset.uri,
        fileName: `${eventId}-${Date.now()}-${safeName}`,
        contentType: asset.mimeType ?? 'application/octet-stream',
        byteSize: asset.size ?? null,
        entityType: 'event_document',
        entityId: eventId,
      });
      uploadFileId = upload.fileId;

      const { data: inserted, error: insertError } = await supabase
        .from('event_documents')
        .insert({
          event_id: eventId,
          name: asset.name,
          file_url: upload.objectKey,
          file_id: upload.fileId,
          file_type: asset.mimeType ?? null,
          category: 'Outros',
        })
        .select('id')
        .maybeSingle();
      if (insertError) throw new Error(insertError.message);
      if (inserted?.id) {
        void linkStoredFile(upload.fileId, inserted.id).catch(() => {
          // Best effort only.
        });
      }

      await loadTab('documents', true);
    } catch (uploadError: any) {
      if (uploadFileId) {
        void deleteStoredFile(uploadFileId).catch(() => {
          // Best effort only.
        });
      }
      setError(uploadError?.message ?? 'Erro ao fazer upload do documento.');
    } finally {
      setUploadingDoc(false);
    }
  }

  async function pickAndUploadPhoto() {
    if (uploadingPhoto || !event) return;
    setUploadingPhoto(true);
    setError('');
    let nextFileId: string | null = null;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        throw new Error('Permissao de galeria negada.');
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (result.canceled || result.assets.length === 0) {
        setUploadingPhoto(false);
        return;
      }

      const asset = result.assets[0];
      const ext = (asset.fileName?.split('.').pop() ?? 'jpg').toLowerCase();
      const previousFileId = event.couple_photo_file_id ?? null;
      const upload = await uploadPrivateAsset({
        uri: asset.uri,
        fileName: `${eventId}-${Date.now()}.${ext}`,
        contentType: asset.mimeType ?? 'image/jpeg',
        byteSize: asset.fileSize ?? null,
        entityType: 'event_photo',
        entityId: eventId,
      });
      nextFileId = upload.fileId;
      const signedUrl = await getPrivateFileDownloadUrl(upload.fileId);
      const { error: updateError } = await supabase
        .from('events')
        .update({ couple_photo_url: null, couple_photo_file_id: upload.fileId })
        .eq('id', eventId);
      if (updateError) throw new Error(updateError.message);

      if (previousFileId) {
        void deleteStoredFile(previousFileId).catch(() => {
          // Best effort only.
        });
      }
      setEvent((previous) => previous
        ? { ...previous, couple_photo_url: signedUrl, couple_photo_file_id: upload.fileId }
        : previous);
    } catch (photoError: any) {
      if (nextFileId) {
        void deleteStoredFile(nextFileId).catch(() => {
          // Best effort only.
        });
      }
      setError(photoError?.message ?? 'Erro ao fazer upload da foto.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function pickAndUploadInviteImage() {
    if (uploadingInviteImage || !event) return;
    setUploadingInviteImage(true);
    let nextFileId: string | null = null;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error('Permissão de galeria negada.');
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.82 });
      if (result.canceled || result.assets.length === 0) return;
      const asset = result.assets[0];
      const extension = (asset.fileName?.split('.').pop() ?? 'jpg').toLowerCase();
      const upload = await uploadPrivateAsset({ uri: asset.uri, fileName: `convite-${eventId}-${Date.now()}.${extension}`, contentType: asset.mimeType ?? 'image/jpeg', byteSize: asset.fileSize ?? null, entityType: 'event_invite_whatsapp_image', entityId: eventId });
      nextFileId = upload.fileId;
      const signedUrl = await getPrivateFileDownloadUrl(upload.fileId);
      const { error: updateError } = await supabase.from('events').update({ whatsapp_image_file_id: upload.fileId, whatsapp_image_url: null }).eq('id', eventId);
      if (updateError) throw new Error(updateError.message);
      if (event.whatsapp_image_file_id) void deleteStoredFile(event.whatsapp_image_file_id).catch(() => undefined);
      setEvent((current) => current ? { ...current, whatsapp_image_file_id: upload.fileId, whatsapp_image_url: signedUrl } : current);
    } catch (uploadError: any) {
      if (nextFileId) void deleteStoredFile(nextFileId).catch(() => undefined);
      setError(uploadError?.message ?? 'Não foi possível enviar a imagem do convite.');
    } finally { setUploadingInviteImage(false); }
  }

  async function pickAndUploadTeamPhoto(member: any) {
    if (uploadingTeamMemberId) return;
    setUploadingTeamMemberId(String(member.id));
    let nextFileId: string | null = null;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error('Permissão de galeria negada.');
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (result.canceled || result.assets.length === 0) return;
      const asset = result.assets[0];
      const extension = (asset.fileName?.split('.').pop() ?? 'jpg').toLowerCase();
      const upload = await uploadPrivateAsset({ uri: asset.uri, fileName: `equipe-${member.id}-${Date.now()}.${extension}`, contentType: asset.mimeType ?? 'image/jpeg', byteSize: asset.fileSize ?? null, entityType: 'event_team_member_photo', entityId: eventId });
      nextFileId = upload.fileId;
      const signedUrl = await getPrivateFileDownloadUrl(upload.fileId);
      const { error: updateError } = await supabase.from('event_team_members').update({ photo_file_id: upload.fileId, photo_url: null }).eq('id', member.id).eq('event_id', eventId);
      if (updateError) throw new Error(updateError.message);
      if (member.photo_file_id) void deleteStoredFile(String(member.photo_file_id)).catch(() => undefined);
      setData((current) => ({ ...current, team: current.team.map((item) => item.id === member.id ? { ...item, photo_file_id: upload.fileId, photo_url: signedUrl } : item) }));
    } catch (uploadError: any) {
      if (nextFileId) void deleteStoredFile(nextFileId).catch(() => undefined);
      setError(uploadError?.message ?? 'Não foi possível enviar a foto da equipe.');
    } finally { setUploadingTeamMemberId(null); }
  }

  return {
    uploadingDoc,
    uploadingPhoto,
    uploadingInviteImage,
    uploadingTeamMemberId,
    pickAndUploadDocument,
    pickAndUploadPhoto,
    pickAndUploadInviteImage,
    pickAndUploadTeamPhoto,
  };
}
