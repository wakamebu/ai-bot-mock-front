import './style.css';
import { BACKENDS, type BackendId } from '../backends';
import {
  type ChatResponse,
  findStoredMessage,
  findTenant,
  sendChat,
  type Tenant,
} from './api';

declare const __BACKEND_URLS__: Record<BackendId, string>;

const SAMPLE_QUESTIONS = [
  '予約方法を教えてください',
  '全身脱毛の料金はいくらですか',
  '脱毛は痛いですか',
  '駐車場はありますか',
  '妊娠中ですが施術できますか',
];

const REASONS: Record<string, string> = {
  sensitive: '担当者へ（要注意の質問）',
  out_of_scope: '資料にない',
  low_confidence: '確信度不足',
  provider_error: '方式のエラー',
};

interface Column {
  id: BackendId;
  label: string;
  tenant: Tenant | null;
  conversationId?: string;
  el: HTMLElement;
  log: HTMLElement;
  info: HTMLElement;
}

const $ = <T extends HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;

const keyInput = $<HTMLInputElement>('#widget-key');
const backendList = $('#backends');
const columnsEl = $('#columns');
const form = $<HTMLFormElement>('#composer');
const input = $<HTMLTextAreaElement>('#message');
const samples = $('#samples');

const saved = load();
keyInput.value = saved.widgetKey ?? 'pk_demo_clinic';
const enabled = new Set<BackendId>(saved.enabled ?? ['dify', 'openai']);
let columns: Column[] = [];

for (const b of BACKENDS) {
  const label = document.createElement('label');
  label.innerHTML = `<input type="checkbox" value="${b.id}"> ${b.label}`;
  const box = label.querySelector('input')!;
  box.checked = enabled.has(b.id);
  box.addEventListener('change', () => {
    if (box.checked) enabled.add(b.id);
    else enabled.delete(b.id);
    save();
    void reset();
  });
  backendList.append(label);
}

for (const q of SAMPLE_QUESTIONS) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = q;
  button.addEventListener('click', () => void ask(q));
  samples.append(button);
}

keyInput.addEventListener('change', () => {
  save();
  void reset();
});
$('#reset').addEventListener('click', () => void reset());
form.addEventListener('submit', (e) => {
  e.preventDefault();
  void ask(input.value);
});
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    form.requestSubmit();
  }
});

void reset();

/** 選んだバックエンドごとに列を作り直し、新しい会話にする */
async function reset() {
  columnsEl.replaceChildren();
  columns = BACKENDS.filter((b) => enabled.has(b.id)).map((b) => {
    const el = document.createElement('section');
    el.className = 'column';
    el.innerHTML = `
      <header>
        <h2>${b.label}</h2>
        <a href="${__BACKEND_URLS__[b.id]}/cost.html" target="_blank" rel="noreferrer">費用の見積もり</a>
      </header>
      <p class="info">接続を確認中…</p>
      <div class="log"></div>`;
    columnsEl.append(el);
    return {
      id: b.id,
      label: b.label,
      tenant: null,
      el,
      log: el.querySelector('.log')!,
      info: el.querySelector('.info')!,
    };
  });
  columnsEl.style.setProperty('--cols', String(Math.max(columns.length, 1)));

  await Promise.all(
    columns.map(async (col) => {
      try {
        col.tenant = await findTenant(col.id, keyInput.value);
        col.info.textContent = col.tenant
          ? `${col.tenant.name}・方式 ${col.tenant.provider}・しきい値 ${col.tenant.confidenceThreshold}`
          : 'この公開キーのテナントがありません';
        col.info.classList.toggle('error', !col.tenant);
      } catch (error) {
        col.info.textContent = `接続できません（${__BACKEND_URLS__[col.id]}）：${describe(error)}`;
        col.info.classList.add('error');
      }
    }),
  );
}

/** 同じ質問を、選んだすべてのバックエンドに送る */
async function ask(text: string) {
  const message = text.trim();
  if (!message || columns.length === 0) return;
  input.value = '';
  await Promise.all(columns.map((col) => askOne(col, message)));
}

async function askOne(col: Column, message: string) {
  append(col.log, 'user', escape(message));
  const pending = append(col.log, 'bot pending', '…');
  const started = performance.now();
  try {
    const res = await sendChat(
      col.id,
      keyInput.value,
      message,
      col.conversationId,
    );
    const ms = Math.round(performance.now() - started);
    col.conversationId = res.conversationId;
    renderAnswer(pending, res, ms);
    if (col.tenant) void renderDetail(col, col.tenant.id, res, pending);
  } catch (error) {
    pending.className = 'msg bot error';
    pending.textContent = `エラー：${describe(error)}`;
  }
  col.log.scrollTop = col.log.scrollHeight;
}

function renderAnswer(el: HTMLElement, res: ChatResponse, ms: number) {
  el.className = `msg bot ${res.status}`;
  const badge =
    res.status === 'answered'
      ? '<span class="badge ok">回答</span>'
      : `<span class="badge ng">案内：${REASONS[res.fallback?.reason ?? ''] ?? res.fallback?.reason}</span>`;
  const sources = res.sources.length
    ? `<ul class="sources">${res.sources
        .map(
          (s) =>
            `<li>${s.url ? `<a href="${escape(s.url)}" target="_blank" rel="noreferrer">${escape(s.title)}</a>` : escape(s.title)}${
              s.score !== undefined ? ` <small>${s.score.toFixed(2)}</small>` : ''
            }</li>`,
        )
        .join('')}</ul>`
    : '';
  el.innerHTML = `
    <div class="meta">${badge}<small>${ms}ms</small></div>
    <div class="answer">${escape(res.answer)}</div>
    ${sources}
    <div class="detail"></div>`;
}

/** 確信度と利用量はレスポンスに無いので、会話ログから取って表示する */
async function renderDetail(
  col: Column,
  tenantId: string,
  res: ChatResponse,
  el: HTMLElement,
) {
  try {
    const stored = await findStoredMessage(
      col.id,
      tenantId,
      res.conversationId,
      res.messageId,
    );
    if (!stored) return;
    const parts: string[] = [];
    if (stored.confidence !== null)
      parts.push(`確信度 ${stored.confidence.toFixed(2)}`);
    const u = stored.usage;
    if (u) {
      parts.push(`入力 ${u.inputTokens}・出力 ${u.outputTokens} トークン`);
      if (u.model) parts.push(u.model);
      if (u.searchCalls) parts.push(`検索 ${u.searchCalls}回`);
      if (u.reportedCostUsd !== undefined)
        parts.push(`$${u.reportedCostUsd.toFixed(6)}`);
    }
    el.querySelector('.detail')!.textContent = parts.join('・');
  } catch {
    // 会話ログが取れなくても回答の表示には影響しない
  }
}

function append(log: HTMLElement, className: string, html: string) {
  const el = document.createElement('div');
  el.className = `msg ${className}`;
  el.innerHTML = html;
  log.append(el);
  log.scrollTop = log.scrollHeight;
  return el;
}

function escape(text: string) {
  return text.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
}

function describe(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function load(): { widgetKey?: string; enabled?: BackendId[] } {
  try {
    return JSON.parse(localStorage.getItem('front-mock') ?? '{}');
  } catch {
    return {};
  }
}

function save() {
  try {
    localStorage.setItem(
      'front-mock',
      JSON.stringify({ widgetKey: keyInput.value, enabled: [...enabled] }),
    );
  } catch {
    // 保存できなくても動く
  }
}
