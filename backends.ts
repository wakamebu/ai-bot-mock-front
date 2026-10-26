/**
 * 接続先のバックエンド。vite.config.ts（プロキシ）と画面の両方で使う。
 * URL は .env の値（例：DIFY_API_URL）で上書きできる。
 */
export const BACKENDS = [
  {
    id: 'mock',
    label: 'mock（main）',
    envKey: 'MOCK_API_URL',
    defaultUrl: 'http://localhost:3001',
  },
  {
    id: 'dify',
    label: 'Dify（dify-develop）',
    envKey: 'DIFY_API_URL',
    defaultUrl: 'http://localhost:3011',
  },
  {
    id: 'openai',
    label: 'OpenAI（openai-develop）',
    envKey: 'OPENAI_API_URL',
    defaultUrl: 'http://localhost:3021',
  },
] as const;

export type BackendId = (typeof BACKENDS)[number]['id'];
