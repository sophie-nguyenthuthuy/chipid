export interface ChipIDErrorBody {
  type: string;
  code: string;
  message: string;
  param?: string;
  doc_url?: string;
  request_id?: string;
}

export class ChipIDError extends Error {
  readonly type: string;
  readonly code: string;
  readonly param: string | undefined;
  readonly docUrl: string | undefined;
  readonly requestId: string | undefined;
  readonly statusCode: number;

  constructor(statusCode: number, body: ChipIDErrorBody) {
    super(body.message);
    this.name = 'ChipIDError';
    this.statusCode = statusCode;
    this.type = body.type;
    this.code = body.code;
    this.param = body.param;
    this.docUrl = body.doc_url;
    this.requestId = body.request_id;
  }
}
