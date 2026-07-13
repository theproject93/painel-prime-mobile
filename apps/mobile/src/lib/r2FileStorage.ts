import { supabase } from './supabase';

export type StorageEntityType =
  | 'finance_entry_proof'
  | 'finance_expense_proof'
  | 'event_document'
  | 'event_photo'
  | 'event_invite_whatsapp_image'
  | 'event_team_member_photo'
  | 'crm_portfolio_pdf'
  | 'couple_update_photo';

type UploadIntentResponse = {
  fileId: string;
  objectKey: string;
  uploadUrl: string;
  requiredHeaders?: Record<string, string>;
};

type DownloadIntentResponse = {
  url: string;
};

function functionUrl(functionName: string) {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('supabase_function_missing_env');
  }
  return `${supabaseUrl}/functions/v1/${functionName}`;
}

function anonHeaders() {
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseAnonKey) {
    throw new Error('supabase_function_missing_env');
  }

  return {
    'Content-Type': 'application/json',
    apikey: supabaseAnonKey,
  };
}

function normalizeAccessToken(token: string | null | undefined) {
  if (!token) return null;

  let normalized = token.trim();
  if (!normalized) return null;

  if (normalized.toLowerCase().startsWith('bearer ')) {
    normalized = normalized.slice(7).trim();
  }

  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }

  return normalized.split('.').length === 3 ? normalized : null;
}

async function validateAccessToken(token: string | null) {
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  return token;
}

async function getValidAccessToken(forceRefresh = false) {
  if (!forceRefresh) {
    const { data: sessionData } = await supabase.auth.getSession();
    const sessionToken = normalizeAccessToken(sessionData.session?.access_token ?? null);
    const validatedSessionToken = await validateAccessToken(sessionToken);
    if (validatedSessionToken) return validatedSessionToken;
  }

  const { data: refreshed } = await supabase.auth.refreshSession();
  const refreshedToken = normalizeAccessToken(refreshed.session?.access_token ?? null);
  return validateAccessToken(refreshedToken);
}

async function parseFunctionResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const raw = await response.text();
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { error?: unknown; message?: unknown };
        const message =
          (typeof parsed.message === 'string' && parsed.message) ||
          (typeof parsed.error === 'string' && parsed.error) ||
          raw;
        throw new Error(message);
      } catch {
        throw new Error(raw);
      }
    }

    throw new Error(`storage_function_${response.status}`);
  }
  return (await response.json()) as T;
}

async function callStorageAction<T = Record<string, unknown>>(
  body: Record<string, unknown>
) {
  const accessToken = await getValidAccessToken(false);
  if (!accessToken) {
    throw new Error('supabase_function_unauthorized');
  }

  let response = await fetch(functionUrl('storage-r2'), {
    method: 'POST',
    headers: {
      ...anonHeaders(),
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (response.status === 401) {
    const refreshedToken = await getValidAccessToken(true);
    if (refreshedToken) {
      response = await fetch(functionUrl('storage-r2'), {
        method: 'POST',
        headers: {
          ...anonHeaders(),
          Authorization: `Bearer ${refreshedToken}`,
        },
        body: JSON.stringify(body),
      });
    }
  }

  return parseFunctionResponse<T>(response);
}

async function callPublicStorageAction<T = Record<string, unknown>>(
  body: Record<string, unknown>
) {
  const response = await fetch(functionUrl('storage-r2'), {
    method: 'POST',
    headers: anonHeaders(),
    body: JSON.stringify(body),
  });

  return parseFunctionResponse<T>(response);
}

async function fetchBlobFromUri(uri: string) {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(`asset_fetch_failed_${response.status}`);
  }
  return response.blob();
}

async function putBlobToSignedUrl(
  uploadIntent: UploadIntentResponse,
  blob: Blob
) {
  const uploadResponse = await fetch(uploadIntent.uploadUrl, {
    method: 'PUT',
    headers: {
      ...(uploadIntent.requiredHeaders ?? {}),
    },
    body: blob,
  });

  if (!uploadResponse.ok) {
    throw new Error(`r2_upload_failed_${uploadResponse.status}`);
  }
}

export async function uploadPrivateAsset(params: {
  uri: string;
  fileName: string;
  contentType?: string | null;
  byteSize?: number | null;
  entityType: StorageEntityType;
  entityId?: string | null;
}) {
  const blob = await fetchBlobFromUri(params.uri);
  const uploadIntent = await callStorageAction<UploadIntentResponse>({
    action: 'create_upload',
    entityType: params.entityType,
    entityId: params.entityId ?? null,
    fileName: params.fileName,
    contentType: params.contentType || 'application/octet-stream',
    byteSize: params.byteSize ?? blob.size,
  });

  try {
    await putBlobToSignedUrl(uploadIntent, blob);
    await callStorageAction({
      action: 'complete_upload',
      fileId: uploadIntent.fileId,
    });
  } catch (error) {
    try {
      await callStorageAction({
        action: 'delete_file',
        fileId: uploadIntent.fileId,
      });
    } catch {
      // Best effort cleanup only.
    }
    throw error;
  }

  return {
    fileId: uploadIntent.fileId,
    objectKey: uploadIntent.objectKey,
  };
}

export async function uploadCouplePortalAsset(params: {
  uri: string;
  fileName: string;
  contentType?: string | null;
  byteSize?: number | null;
  portalToken: string;
}) {
  const blob = await fetchBlobFromUri(params.uri);
  const uploadIntent = await callPublicStorageAction<UploadIntentResponse>({
    action: 'create_public_upload',
    entityType: 'couple_update_photo',
    portalToken: params.portalToken,
    fileName: params.fileName,
    contentType: params.contentType || 'application/octet-stream',
    byteSize: params.byteSize ?? blob.size,
  });

  try {
    await putBlobToSignedUrl(uploadIntent, blob);
    await callPublicStorageAction({
      action: 'complete_public_upload',
      fileId: uploadIntent.fileId,
      portalToken: params.portalToken,
    });
  } catch (error) {
    try {
      await callPublicStorageAction({
        action: 'delete_public_file',
        fileId: uploadIntent.fileId,
        portalToken: params.portalToken,
      });
    } catch {
      // Best effort cleanup only.
    }
    throw error;
  }

  return {
    fileId: uploadIntent.fileId,
    objectKey: uploadIntent.objectKey,
  };
}

export async function getPrivateFileDownloadUrl(fileId: string) {
  const response = await callStorageAction<DownloadIntentResponse>({
    action: 'create_download',
    fileId,
  });

  return response.url;
}

export async function getCouplePortalFileDownloadUrl(
  fileId: string,
  portalToken: string
) {
  const response = await callPublicStorageAction<DownloadIntentResponse>({
    action: 'create_public_download',
    fileId,
    portalToken,
  });

  return response.url;
}

export async function getPortfolioShareFileDownloadUrl(
  fileId: string,
  shareToken: string
) {
  const response = await callPublicStorageAction<DownloadIntentResponse>({
    action: 'create_public_download',
    fileId,
    shareToken,
  });

  return response.url;
}

export async function linkStoredFile(fileId: string, entityId: string) {
  await callStorageAction({
    action: 'link_entity',
    fileId,
    entityId,
  });
}

export async function deleteStoredFile(fileId: string) {
  await callStorageAction({
    action: 'delete_file',
    fileId,
  });
}

export async function deleteCouplePortalFile(fileId: string, portalToken: string) {
  await callPublicStorageAction({
    action: 'delete_public_file',
    fileId,
    portalToken,
  });
}
