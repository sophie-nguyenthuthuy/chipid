// Wire-shape types for the public API. Mirrored in @chipid/node and used
// internally by @chipid/api. Keep these in sync with apps/api/src/schemas/*.

export type Environment = 'test' | 'live';

export type VerificationType = 'chip_nfc' | 'document_ocr';

export type VerificationStatus =
  | 'requires_input'
  | 'processing'
  | 'verified'
  | 'failed'
  | 'canceled'
  | 'expired';

export type FailureCode =
  | 'passive_auth_failed'
  | 'csca_chain_failed'
  | 'data_group_hash_mismatch'
  | 'chip_clone_suspected'
  | 'document_expired'
  | 'face_mismatch'
  | 'liveness_failed'
  | 'user_canceled'
  | 'client_secret_expired'
  | 'internal_error';

export interface VerifiedOutputs {
  full_name: string;
  date_of_birth: string;
  sex: string;
  nationality: string;
  id_number: string;
  id_expires_at: string | null;
  portrait_url: string | null;
}

export interface Verification {
  id: string;
  object: 'verification';
  type: VerificationType;
  status: VerificationStatus;
  client_secret: string | null;
  return_url: string | null;
  metadata: Record<string, string>;
  verified_outputs: VerifiedOutputs | null;
  last_error: { code: FailureCode; message: string } | null;
  created: number;
  verified_at: number | null;
}

export interface ApiErrorBody {
  error: {
    type: string;
    code: string;
    message: string;
    param?: string;
    doc_url?: string;
    request_id: string;
  };
}

export interface WebhookEnvelope<T = unknown> {
  id: string;
  type: string;
  created: number;
  data: T;
}
