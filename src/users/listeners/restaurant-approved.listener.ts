import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';
import { RestaurantApprovedEvent } from '../../restaurants/events/restaurant-approved.event';
import { User } from '../entities/user.entity';

@Injectable()
export class RestaurantApprovedListener {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  @OnEvent('restaurant.approved')
  async handleRestaurantApproved(event: RestaurantApprovedEvent): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: event.ownerId } });
    if (!user) {
      return;
    }

    user.role = UserRole.RESTAURANT_ADMIN;
    user.restaurantId = event.restaurantId;
    await this.userRepository.save(user);
  }
}
