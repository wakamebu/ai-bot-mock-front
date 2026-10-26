# ai-bot-mock front-mock

AI チャットボットのバックエンド（[ai-bot-mock-backend](https://github.com/wakamebu/ai-bot-mock-backend)）を試すための、ごく軽いテスト用フロントエンド。
同じ質問を複数のバックエンド（mock / Dify / OpenAI）に同時に送り、回答を横に並べて比べられる。

## 動かし方

```bash
npm install
cp .env.example .env   # 接続先を変えるときだけ編集
npm run dev            # http://localhost:5173
```

バックエンドは別に起動しておく（各ワークツリーで）。

| 列 | ブランチ | 既定の接続先 | 起動 |
| --- | --- | --- | --- |
| mock | `main` | http://localhost:3001 | `npm run start:dev` |
| Dify | `dify-develop` | http://localhost:3011 | `npm run fake:dify` と `npm run start:dev` |
| OpenAI | `openai-develop` | http://localhost:3021 | `npm run fake:openai` と `npm run start:dev` |

- 開発サーバーが `/api/<mock|dify|openai>/...` をそれぞれのバックエンドへ中継する（`vite.config.ts`）。接続先は `.env` で変える。
- 公開キーの既定はデモテナントの `pk_demo_clinic`。

## 画面で見られるもの

- 回答／案内（担当者へ・資料にない・確信度不足・エラー）の区別、根拠の資料とスコア、応答時間
- 確信度とトークン数などの利用量（バックエンドの会話ログ `GET /admin/tenants/:id/conversations/:id` から取得。管理 API はモックのため認証なし）
- 各バックエンドの費用の見積もり画面（`/cost.html`）へのリンク

「新しい会話」で会話をリセットする。公開キーと選んだバックエンドはブラウザに保存する。
