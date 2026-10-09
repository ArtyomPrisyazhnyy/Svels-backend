import { createHash, randomBytes } from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TelegramApiClient } from './telegram-api.client';
import type {
  TelegramChatResponseDto,
  TelegramLinkCodeResponseDto,
} from './dto/telegram-bot.dto';
import { RestaurantTelegramChat } from './entities/restaurant-telegram-chat.entity';
import { TelegramLinkCode } from './entities/telegram-link-code.entity';

const LINK_CODE_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class TelegramLinkService {
  constructor(
    @InjectRepository(RestaurantTelegramChat)
    private readonly chatsRepository: Repository<RestaurantTelegramChat>,
    @InjectRepository(TelegramLinkCode)
    private readonly linkCodesRepository: Repository<TelegramLinkCode>,
    private readonly telegramApi: TelegramApiClient,
  ) {}

  async createLinkCode(
    restaurantId: string,
  ): Promise<TelegramLinkCodeResponseDto> {
    const code = randomBytes(18).toString('base64url');
    const codeHash = this.hashCode(code);
    const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MS);

    await this.linkCodesRepository.save({
      codeHash,
      restaurantId,
      expiresAt,
      usedAt: null,
    });

    const username = this.telegramApi.getBotUsername().replace(/^@/, '');
    const deepLink = username
      ? `https://t.me/${username}?start=${code}`
      : `https://t.me/?start=${code}`;

    return {
      code,
      deepLink,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async listChats(restaurantId: string): Promise<TelegramChatResponseDto[]> {
    const chats = await this.chatsRepository.find({
      where: { restaurantId },
      order: { createdAt: 'DESC' },
    });
    return chats.map((chat) => ({
      id: chat.id,
      chatId: chat.chatId,
      title: chat.title,
      createdAt: chat.createdAt.toISOString(),
    }));
  }

  async unlinkChat(restaurantId: string, chatRowId: string): Promise<void> {
    const result = await this.chatsRepository.delete({
      id: chatRowId,
      restaurantId,
    });
    if (!result.affected) {
      throw new NotFoundException('Чат не найден');
    }
  }

  async bindChatFromStartCommand(
    chatId: string,
    rawCode: string,
    chatTitle: string | null,
  ): Promise<void> {
    const code = rawCode.trim();
    if (!code) {
      await this.telegramApi.sendMessage(
        chatId,
        'Чтобы привязать чат к заведению, откройте ссылку из панели управления Svels.',
      );
      return;
    }

    const codeHash = this.hashCode(code);
    const linkCode = await this.linkCodesRepository.findOne({
      where: { codeHash },
    });

    if (!linkCode || linkCode.usedAt || linkCode.expiresAt < new Date()) {
      await this.telegramApi.sendMessage(
        chatId,
        'Код привязки недействителен или уже использован. Запросите новый код в панели Svels.',
      );
      return;
    }

    const existing = await this.chatsRepository.findOne({
      where: { restaurantId: linkCode.restaurantId, chatId },
    });
    if (!existing) {
      await this.chatsRepository.save({
        restaurantId: linkCode.restaurantId,
        chatId,
        title: chatTitle,
      });
    } else if (chatTitle && existing.title !== chatTitle) {
      existing.title = chatTitle;
      await this.chatsRepository.save(existing);
    }

    linkCode.usedAt = new Date();
    await this.linkCodesRepository.save(linkCode);

    await this.telegramApi.sendMessage(
      chatId,
      'Чат привязан к заведению. Сюда будут приходить новые заказы.',
    );
  }

  async findRestaurantIdByChatId(chatId: string): Promise<string | null> {
    const chat = await this.chatsRepository.findOne({ where: { chatId } });
    return chat?.restaurantId ?? null;
  }

  async listChatIdsForRestaurant(restaurantId: string): Promise<string[]> {
    const chats = await this.chatsRepository.find({
      where: { restaurantId },
      select: { chatId: true },
    });
    return chats.map((c) => c.chatId);
  }

  private hashCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }
}
