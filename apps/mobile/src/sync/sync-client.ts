import { SyncBatchResponseSchema, type QuitEventEnvelope, type SyncBatchResponse } from '../../../../packages/contracts/src/index';

export interface SyncClient {
  send(events: QuitEventEnvelope[]): Promise<SyncBatchResponse>;
}

export interface FetchResponseLike {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type FetchLike = (
  input: string,
  init: { method: 'POST'; headers: Record<string, string>; body: string },
) => Promise<FetchResponseLike>;

export class HttpSyncClient implements SyncClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetcher: FetchLike,
  ) {}

  async send(events: QuitEventEnvelope[]): Promise<SyncBatchResponse> {
    const response = await this.fetcher(`${this.baseUrl.replace(/\/$/, '')}/v1/events/batch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ events }),
    });
    if (!response.ok) throw new Error(`sync_http_${response.status}`);
    return SyncBatchResponseSchema.parse(await response.json());
  }
}
