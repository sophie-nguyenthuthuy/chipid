import { randomUUID } from 'node:crypto';
import { ChipIDError } from './error.js';
import type {
  List,
  Verification,
  VerificationCreateParams,
  VerificationListParams,
} from './types.js';

export interface ChipIDOptions {
  apiKey?: string;
  baseUrl?: string;
  /** Per-request timeout in ms. Default 30s. */
  timeout?: number;
  /** Retries for idempotent failures (5xx, network). Default 2 → 3 total tries. */
  maxRetries?: number;
  /** Hook for fetch replacement (testing). */
  fetch?: typeof fetch;
}

const SDK_VERSION = '0.1.0';
const DEFAULT_BASE_URL = 'https://api.chipid.vn';

export class ChipID {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly fetcher: typeof fetch;

  readonly verifications = {
    create: (params: VerificationCreateParams, opts?: RequestOptions): Promise<Verification> =>
      this.request<Verification>('POST', '/v1/verifications', params, opts),
    retrieve: (id: string, opts?: RequestOptions): Promise<Verification> =>
      this.request<Verification>('GET', `/v1/verifications/${encodeURIComponent(id)}`, undefined, opts),
    list: (params?: VerificationListParams, opts?: RequestOptions): Promise<List<Verification>> => {
      const qs = new URLSearchParams();
      if (params?.limit !== undefined) qs.set('limit', String(params.limit));
      if (params?.starting_after) qs.set('starting_after', params.starting_after);
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      return this.request<List<Verification>>('GET', `/v1/verifications${suffix}`, undefined, opts);
    },
  };

  constructor(apiKey: string | undefined = process.env.CHIPID_SECRET_KEY, options: ChipIDOptions = {}) {
    const key = options.apiKey ?? apiKey;
    if (!key) {
      throw new Error(
        'ChipID: no API key provided. Pass one to the constructor or set CHIPID_SECRET_KEY.',
      );
    }
    this.apiKey = key;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeout = options.timeout ?? 30_000;
    this.maxRetries = options.maxRetries ?? 2;
    this.fetcher = options.fetch ?? globalThis.fetch;
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body: unknown,
    opts: RequestOptions = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const idempotencyKey =
      opts.idempotencyKey ?? (method !== 'GET' ? `chipid-node:${randomUUID()}` : undefined);

    let attempt = 0;
    let lastError: unknown;
    while (attempt <= this.maxRetries) {
      attempt += 1;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);
      try {
        const res = await this.fetcher(url, {
          method,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': `chipid-node/${SDK_VERSION} (node)`,
            ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        });

        if (res.status >= 500 && attempt <= this.maxRetries) {
          await sleep(backoff(attempt));
          continue;
        }
        const text = await res.text();
        const parsed = text ? (JSON.parse(text) as unknown) : null;
        if (!res.ok) {
          const errBody = (parsed as { error?: ChipIDErrorBodyShape })?.error;
          throw new ChipIDError(res.status, {
            type: errBody?.type ?? 'api_error',
            code: errBody?.code ?? 'api_error',
            message: errBody?.message ?? `Request failed with status ${res.status}`,
            param: errBody?.param,
            doc_url: errBody?.doc_url,
            request_id: errBody?.request_id,
          });
        }
        return parsed as T;
      } catch (err) {
        lastError = err;
        if (err instanceof ChipIDError) throw err;
        if (attempt <= this.maxRetries && isRetryable(err)) {
          await sleep(backoff(attempt));
          continue;
        }
        throw err;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError ?? new Error('ChipID: request failed');
  }
}

export interface RequestOptions {
  idempotencyKey?: string;
}

interface ChipIDErrorBodyShape {
  type?: string;
  code?: string;
  message?: string;
  param?: string;
  doc_url?: string;
  request_id?: string;
}

function isRetryable(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === 'AbortError') return true;
  const code = (err as { code?: string }).code;
  return code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ENOTFOUND' || code === 'EAI_AGAIN';
}

function backoff(attempt: number): number {
  // Decorrelated jitter, capped at 8s
  const base = Math.min(8000, 250 * 2 ** (attempt - 1));
  return Math.floor(Math.random() * base);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
