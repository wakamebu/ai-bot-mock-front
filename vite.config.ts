import { defineConfig, loadEnv } from 'vite';
import { BACKENDS } from './backends';

// /api/<id>/... をそれぞれのバックエンドへ中継する（ブラウザから見ると同じオリジンになる）
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const urls = Object.fromEntries(
    BACKENDS.map((b) => [b.id, env[b.envKey] || b.defaultUrl]),
  );

  return {
    define: { __BACKEND_URLS__: JSON.stringify(urls) },
    server: {
      port: Number(env.PORT) || 5173,
      proxy: Object.fromEntries(
        BACKENDS.map((b) => [
          `/api/${b.id}`,
          {
            target: urls[b.id],
            changeOrigin: true,
            rewrite: (path: string) => path.replace(`/api/${b.id}`, ''),
          },
        ]),
      ),
    },
  };
});
