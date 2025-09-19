export interface AppConfig {
  'game-url': string;
  version?: string;
  demo?: boolean;
}

declare global {
  interface Window {
    APP_CONFIG?: AppConfig;
  }
  const __APP_VERSION__: string;
}

export {};


