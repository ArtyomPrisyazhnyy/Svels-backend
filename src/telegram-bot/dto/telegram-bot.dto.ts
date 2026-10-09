export class TelegramLinkCodeResponseDto {
  code: string;
  deepLink: string;
  expiresAt: string;
}

export class TelegramChatResponseDto {
  id: string;
  chatId: string;
  title: string | null;
  createdAt: string;
}
