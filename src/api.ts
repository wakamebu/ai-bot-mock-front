import type { BackendId } from '../backends';

export interface AnswerSource {
  title: string;
  url?: string;
  snippet?: string;
  score?: number;
}

export interface ChatResponse {
  conversationId: string;
  messageId: string;
  status: 'answered' | 'fallback';
  answer: string;
  sources: AnswerSource[];
  fallback?: { reason: string; contactUrl?: string };
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  publicKey: string;
  provider: string;
  confidenceThreshold: number;
}

export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  confidence: number | null;
  usage: {
    model?: string;
    inputTokens: number;
    cachedInputTokens?: number;
    outputTokens: number;
    searchCalls?: number;
    reportedCostUsd?: number;
  } | null;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(
  backend: BackendId,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`/api/${backend}${path}`, init);
  const text = await res.text();
  const body: unknown = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message =
      (body as { message?: unknown } | null)?.message ?? res.statusText;
    throw new ApiError(
      res.status,
      Array.isArray(message) ? message.join(', ') : String(message),
    );
  }
  return body as T;
}

export function sendChat(
  backend: BackendId,
  widgetKey: string,
  message: string,
  conversationId?: string,
) {
  return request<ChatResponse>(backend, '/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Widget-Key': widgetKey },
    body: JSON.stringify({ message, conversationId }),
  });
}

/** 公開キーからテナントを探す（管理 API。モックのため認証なし） */
export async function findTenant(backend: BackendId, widgetKey: string) {
  const tenants = await request<Tenant[]>(backend, '/admin/tenants');
  return tenants.find((t) => t.publicKey === widgetKey) ?? null;
}

/** 会話ログから、レスポンスに含まれない確信度と利用量を取る */
export async function findStoredMessage(
  backend: BackendId,
  tenantId: string,
  conversationId: string,
  messageId: string,
) {
  const conversation = await request<{ messages: StoredMessage[] }>(
    backend,
    `/admin/tenants/${tenantId}/conversations/${conversationId}`,
  );
  return conversation.messages.find((m) => m.id === messageId) ?? null;
}
