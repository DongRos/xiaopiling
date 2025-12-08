import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // 加载 .env 文件中的变量
    const env = loadEnv(mode, process.cwd(), '');
    
    // 优先使用 process.env (Vercel 环境)，如果没有则使用 .env 文件中的 (本地开发)
    const apiKey = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // 这里是将 API Key 注入到前端代码的关键
        // 注意：这会将 Key 硬编码到构建后的 JS 文件中，属于不安全做法（详见下文）
        'process.env.API_KEY': JSON.stringify(apiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(apiKey)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
