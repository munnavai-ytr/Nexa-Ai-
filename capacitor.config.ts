import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nexaai.app',
  appName: 'Nexa Ai',
  webDir: 'out',
  server: {
    url: 'https://playnexaai.vercel.app',
    cleartext: true
  },
  ...( { bundledWebRuntime: false } as any )
};

export default config;


