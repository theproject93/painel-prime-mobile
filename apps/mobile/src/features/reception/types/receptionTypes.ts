/**
 * Reception Prime Nativo - Tipos e Contratos de Dados
 *
 * Máquina de estados finitos local, fila de persistência offline SQLite,
 * snapshot de evento, convidados e grupos familiares.
 */

export type CheckInState =
  | 'pending' // 🟡 Amarelo: Gravado localmente no SQLite, aguardando envio
  | 'in_flight' // 🟡 Amarelo: Em transmissão no lote atual para o servidor
  | 'confirmed' // 🟢 Verde: Confirmado com sucesso pelo servidor (applied ou replay legítimo)
  | 'already_checked_in' // 🟠 Laranja: Já confirmado previamente no evento
  | 'rejected' // 🔴 Vermelho: Rejeitado (convidado de outro evento ou inconsistência)
  | 'needs_attention'; // 🟣 Roxo: Erro irrecuperável ou limite de retries atingido

export type ReceptionBadgeColor = 'green' | 'yellow' | 'orange' | 'red' | 'purple';

export interface ReceptionOperator {
  id: string;
  name: string;
  role: string;
}

export interface ReceptionEvent {
  id: string;
  name: string;
  event_date: string;
  status: string;
  location: string | null;
  reception_offline_expires_at: string | null;
}

export interface ReceptionTable {
  id: string;
  name: string;
  seats: number;
}

export interface ReceptionGuest {
  id: string;
  event_id?: string;
  name: string;
  phone?: string | null;
  qr_token: string | null;
  family_group_id: string | null;
  is_group_leader: boolean;
  group_leader_id: string | null;
  group_sort_order?: number | null;
  checked_in_at: string | null;
  checked_in_by: string | null;
  table_id: string | null;
  table_name?: string | null;
}

export interface ReceptionEventSnapshot {
  event: ReceptionEvent;
  operator?: ReceptionOperator | null;
  guests: ReceptionGuest[];
  tables: ReceptionTable[];
  snapshot_at: string;
}

export interface ReceptionSnapshotRow {
  event_id: string;
  name: string;
  event_date: string;
  status: string;
  location: string | null;
  reception_offline_expires_at: string | null;
  snapshot_at: string;
  raw_json: string;
  created_at: string;
  updated_at: string;
}

export interface ReceptionQueueRow {
  client_scan_id: string; // UUIDv4 gerado no scan
  event_id: string;
  scanned_qr_token: string | null;
  scanned_guest_id: string | null;
  confirmed_guest_ids: string[]; // Deserializado do JSON
  canonical_payload_hash: string; // Determinístico SHA-256
  state: CheckInState;
  retry_count: number;
  created_at: string;
  scanned_at: string;
  synced_at: string | null;
  error_code: string | null;
  error_message: string | null;
  server_response: Record<string, unknown> | null;
}

export interface CreateReceptionQueueInput {
  client_scan_id?: string;
  clientScanId?: string;
  event_id: string;
  scanned_qr_token?: string | null;
  scanned_guest_id?: string | null;
  confirmed_guest_ids: string[];
  canonical_payload_hash?: string;
  scanned_at?: string;
}

export interface ApplyReceptionOperationPayload {
  client_scan_id: string;
  scanned_qr_token: string | null;
  scanned_guest_id: string | null;
  confirmed_guest_ids: string[];
  scanned_at: string;
}

export interface ApplyReceptionResult {
  client_scan_id: string;
  status: 'applied' | 'already_checked_in' | 'rejected';
  idempotent_replay: boolean;
  scanned_at: string;
  checked_in_by: string | null;
  confirmed_guest_ids: string[];
  newly_checked_in_ids: string[];
  already_checked_in_ids: string[];
  error: string | null;
}

export interface ApplyReceptionResponse {
  success: boolean;
  synced_at: string;
  results: ApplyReceptionResult[];
}
