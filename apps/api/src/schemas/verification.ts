import { z } from 'zod';

export const VerificationCreateBody = z.object({
  type: z.enum(['chip_nfc', 'document_ocr']),
  return_url: z.string().url().optional(),
  metadata: z.record(z.string().max(500)).default({}).refine(
    (m) => Object.keys(m).length <= 50,
    'metadata may contain at most 50 keys',
  ),
});
export type VerificationCreateBody = z.infer<typeof VerificationCreateBody>;

/**
 * Submitted by the mobile client (authenticated by client_secret, not API key).
 * dataGroups is a map of DG number → base64-encoded raw TLV bytes as read
 * from the chip. sod is the Document Security Object (EF.SOD), also base64.
 */
export const VerificationSubmitBody = z.object({
  client_secret: z.string().regex(/^cs_(test|live)_[a-z0-9]+$/),
  sod: z.string().base64(),
  data_groups: z.record(z.string().regex(/^\d{1,2}$/), z.string().base64()),
  active_auth_response: z.string().base64().optional(),
  selfie: z.string().base64().optional(),
});
export type VerificationSubmitBody = z.infer<typeof VerificationSubmitBody>;

export const VerificationResource = z.object({
  id: z.string(),
  object: z.literal('verification'),
  type: z.enum(['chip_nfc', 'document_ocr']),
  status: z.enum(['requires_input', 'processing', 'verified', 'failed', 'canceled', 'expired']),
  client_secret: z.string().nullable(),
  return_url: z.string().nullable(),
  metadata: z.record(z.string()),
  // verified_outputs is populated only when status=verified.
  verified_outputs: z
    .object({
      full_name: z.string(),
      date_of_birth: z.string(),
      sex: z.string(),
      nationality: z.string(),
      id_number: z.string(),
      id_expires_at: z.string().nullable(),
      portrait_url: z.string().url().nullable(),
    })
    .nullable(),
  last_error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .nullable(),
  created: z.number().int(),
  verified_at: z.number().int().nullable(),
});
export type VerificationResource = z.infer<typeof VerificationResource>;
