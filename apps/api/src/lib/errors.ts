/**
 * Stripe-style errors. The wire shape is stable forever:
 *
 *   { error: { type, code, message, param?, doc_url?, request_id } }
 *
 * Adding a new code is non-breaking. Renaming one is breaking, so don't.
 */

export type ErrorCode =
  | 'authentication_required'
  | 'invalid_api_key'
  | 'permission_denied'
  | 'resource_missing'
  | 'parameter_invalid'
  | 'parameter_missing'
  | 'idempotency_key_in_use'
  | 'idempotency_mismatch'
  | 'rate_limited'
  | 'verification_failed'
  | 'client_secret_invalid'
  | 'client_secret_expired'
  | 'api_error';

export type ErrorType =
  | 'authentication_error'
  | 'permission_error'
  | 'invalid_request_error'
  | 'idempotency_error'
  | 'rate_limit_error'
  | 'verification_error'
  | 'api_error';

const CODE_TO_TYPE: Record<ErrorCode, ErrorType> = {
  authentication_required: 'authentication_error',
  invalid_api_key: 'authentication_error',
  permission_denied: 'permission_error',
  resource_missing: 'invalid_request_error',
  parameter_invalid: 'invalid_request_error',
  parameter_missing: 'invalid_request_error',
  idempotency_key_in_use: 'idempotency_error',
  idempotency_mismatch: 'idempotency_error',
  rate_limited: 'rate_limit_error',
  verification_failed: 'verification_error',
  client_secret_invalid: 'verification_error',
  client_secret_expired: 'verification_error',
  api_error: 'api_error',
};

const CODE_TO_STATUS: Record<ErrorCode, number> = {
  authentication_required: 401,
  invalid_api_key: 401,
  permission_denied: 403,
  resource_missing: 404,
  parameter_invalid: 400,
  parameter_missing: 400,
  idempotency_key_in_use: 409,
  idempotency_mismatch: 409,
  rate_limited: 429,
  verification_failed: 402, // matches Stripe Identity's "verification declined"
  client_secret_invalid: 401,
  client_secret_expired: 401,
  api_error: 500,
};

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly param: string | undefined;
  readonly docUrl: string | undefined;

  constructor(code: ErrorCode, message: string, opts: { param?: string; docUrl?: string } = {}) {
    super(message);
    this.code = code;
    this.statusCode = CODE_TO_STATUS[code];
    this.param = opts.param;
    this.docUrl = opts.docUrl ?? `https://chipid.vn/docs/errors#${code}`;
  }

  toJSON(requestId: string) {
    return {
      error: {
        type: CODE_TO_TYPE[this.code],
        code: this.code,
        message: this.message,
        param: this.param,
        doc_url: this.docUrl,
        request_id: requestId,
      },
    };
  }
}
