import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.purrfectlove.app',
  appName: '我们的小窝',
  webDir: 'dist',
  server: {
    androidScheme: 'https' // 建议加上这个，让安卓也使用 https 协议运行本地服务
  },
};

export default config;
