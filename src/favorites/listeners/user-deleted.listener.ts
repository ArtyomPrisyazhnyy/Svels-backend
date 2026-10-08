import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserDeletedEvent } from '../../users/events/user-deleted.event';
import { Favorite } from '../entities/favorite.entity';

@Injectable()
export class UserDeletedFavoritesListener {
  constructor(
    @InjectRepository(Favorite)
    private readonly favoriteRepository: Repository<Favorite>,
  ) {}

  @OnEvent(UserDeletedEvent.EVENT)
  async handle(event: UserDeletedEvent): Promise<void> {
    await this.favoriteRepository.delete({ userId: event.userId });
  }
}
