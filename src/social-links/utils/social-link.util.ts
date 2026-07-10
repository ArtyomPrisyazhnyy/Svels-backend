import { BadRequestException } from '@nestjs/common';
import { SocialPlatform } from '../../common/enums/social-platform.enum';

export function normalizeSocialUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new BadRequestException('Укажите ссылку');
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new BadRequestException('Некорректная ссылка');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new BadRequestException('Допустимы только HTTP(S)-ссылки');
  }

  return parsed.toString();
}

export function detectSocialPlatform(url: string): SocialPlatform {
  try {
    const hostname = new URL(normalizeSocialUrl(url)).hostname.replace(/^www\./i, '').toLowerCase();

    if (hostname === 't.me' || hostname === 'telegram.me' || hostname.endsWith('.t.me')) {
      return SocialPlatform.TELEGRAM;
    }
    if (hostname === 'instagram.com' || hostname.endsWith('.instagram.com')) {
      return SocialPlatform.INSTAGRAM;
    }
    if (
      hostname === 'vk.com' ||
      hostname === 'vk.ru' ||
      hostname.endsWith('.vk.com') ||
      hostname.endsWith('.vk.ru')
    ) {
      return SocialPlatform.VK;
    }
    if (
      hostname === 'facebook.com' ||
      hostname === 'fb.com' ||
      hostname.endsWith('.facebook.com')
    ) {
      return SocialPlatform.FACEBOOK;
    }
    if (
      hostname === 'youtube.com' ||
      hostname === 'youtu.be' ||
      hostname.endsWith('.youtube.com')
    ) {
      return SocialPlatform.YOUTUBE;
    }
    if (hostname === 'tiktok.com' || hostname.endsWith('.tiktok.com')) {
      return SocialPlatform.TIKTOK;
    }
    if (
      hostname === 'twitter.com' ||
      hostname === 'x.com' ||
      hostname.endsWith('.twitter.com') ||
      hostname.endsWith('.x.com')
    ) {
      return SocialPlatform.TWITTER;
    }
    if (
      hostname === 'wa.me' ||
      hostname === 'whatsapp.com' ||
      hostname.endsWith('.whatsapp.com')
    ) {
      return SocialPlatform.WHATSAPP;
    }

    return SocialPlatform.OTHER;
  } catch {
    return SocialPlatform.OTHER;
  }
}
