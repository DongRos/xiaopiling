import path from 'path';
import { fileURLToPath } from 'url'; // [新增]
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// [新增] 手动定义 __dirname (因为在 "type": "module" 模式下不可用)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
        'process.env.API_KEY': JSON.stringify(apiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(apiKey)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'), // ✅ 现在可以正常使用了
        }
      }
    };
});
