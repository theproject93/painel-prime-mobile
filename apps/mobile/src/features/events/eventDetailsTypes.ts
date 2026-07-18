export type VisibleKey = 'tasks' | 'guests' | 'vendors' | 'documents' | 'timeline';

export type EventRow = {
  id: string;
  name: string;
  couple: string | null;
  couple_photo_file_id?: string | null;
  couple_photo_url: string | null;
  event_date: string;
  location: string | null;
  status: string | null;
  event_type: string | null;
  budget_total: number | null;
  invite_message_template: string | null;
  invite_dress_code: string | null;
  whatsapp_image_file_id?: string | null;
  whatsapp_image_url?: string | null;
  created_at: string;
};

export type SmartTimelineSuggestion = {
  id: string;
  title: string;
  reason: string;
  activity: string;
  time: string;
  assignee: string;
  priority: 'high' | 'normal';
  source: 'rules' | 'ai';
};

export type PaymentMethod = 'pix' | 'dinheiro' | 'debito' | 'credito' | 'boleto' | 'transferencia' | 'outro';
export type HistoryKind = 'event' | 'task' | 'guest' | 'timeline' | 'vendor' | 'document' | 'expense' | 'payment' | 'invite' | 'rsvp';
export type PaymentMeta = { receipt_document_id?: string | null };
export type AlertLevel = 'error' | 'warning' | 'info';
export type OverviewAlert = { type: AlertLevel; message: string };
export type ProjectMilestoneKind = 'start' | 'vendor' | 'guest' | 'expense' | 'document' | 'payment' | 'invite' | 'rsvp';
export type ProjectMilestone = {
  id: string;
  date: Date;
  dayNumber: number;
  title: string;
  detail: string;
  kind: ProjectMilestoneKind;
};

export type CommandVendorStatus = 'pending' | 'en_route' | 'arrived' | 'done';
export type CommandStatusRow = {
  vendor_id: string;
  status: CommandVendorStatus;
  created_at: string;
  updated_by: 'assessoria' | 'fornecedor';
  note: string | null;
};
export type CommandConfig = { lead_minutes: number[]; late_grace_minutes: number };
export type CommandIncidentRow = {
  id: string;
  event_id: string;
  vendor_id: string | null;
  severity: 'warning' | 'critical';
  status: 'open' | 'resolved';
  title: string;
  note: string | null;
  action_plan: string | null;
  created_at: string;
  resolved_at: string | null;
  vendor?: { name: string; category: string } | { name: string; category: string }[] | null;
};
export type CommandComputedAlert = {
  vendor_id: string;
  alert_type: 'arrival_pre_alert' | 'arrival_late' | 'done_late';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  dedupe_key: string;
};
