export interface Verification {
  id: string;
  object: 'verification';
  type: 'chip_nfc' | 'document_ocr';
  status: 'requires_input' | 'processing' | 'verified' | 'failed' | 'canceled' | 'expired';
  client_secret: string | null;
  return_url: string | null;
  metadata: Record<string, string>;
  verified_outputs: {
    full_name: string;
    date_of_birth: string;
    sex: string;
    nationality: string;
    id_number: string;
    id_expires_at: string | null;
    portrait_url: string | null;
  } | null;
  last_error: { code: string; message: string } | null;
  created: number;
  verified_at: number | null;
}

export interface VerificationCreateParams {
  type: 'chip_nfc' | 'document_ocr';
  return_url?: string;
  metadata?: Record<string, string>;
}

export interface VerificationListParams {
  limit?: number;
  starting_after?: string;
}

export interface List<T> {
  object: 'list';
  data: T[];
  has_more: boolean;
  url: string;
}

export interface WebhookEvent<T = unknown> {
  id: string;
  type: string;
  created: number;
  data: T;
}
