declare module "*.css" {
  const content: { [className: string]: string };
  export default content;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      username?: string;
      first_name?: string;
      last_name?: string;
    };
    [key: string]: unknown;
  };
  ready(): void;
  close(): void;
}

interface Window {
  Telegram?: {
    WebApp: TelegramWebApp;
  };
}