import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.survivorzero.game',
  appName: 'Survivor Zero',
  webDir: 'dist',
  backgroundColor: '#05060a',
  android: {
    backgroundColor: '#05060a',
  },
  ios: {
    backgroundColor: '#05060a',
    contentInset: 'never',
  },
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK',
      backgroundColor: '#00000000',
    },
  },
}

export default config
