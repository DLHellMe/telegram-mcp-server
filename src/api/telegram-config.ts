export interface TelegramApiConfig {
  apiId: number;
  apiHash: string;
  sessionName?: string;
}

// Default configuration - users will need to set their own API credentials
export const defaultConfig: TelegramApiConfig = {
  apiId: 0, // Get from https://my.telegram.org
  apiHash: '', // Get from https://my.telegram.org
  sessionName: 'telegram_mcp_session'
};