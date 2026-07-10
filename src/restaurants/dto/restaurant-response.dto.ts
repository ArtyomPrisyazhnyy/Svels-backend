import { RestaurantStatus } from '../../common/enums/restaurant-status.enum';

export class RestaurantResponseDto {
  id: string;
  name: string;
  description: string | null;
  address: string;
  status: RestaurantStatus;
  ownerId: string;
  customDomain: string | null;
  logoUrl: string | null;
  createdAt: Date;
}
