import { RestaurantStatus } from '../../common/enums/restaurant-status.enum';

export class RestaurantResponseDto {
  id: string;
  name: string;
  description: string | null;
  address: string;
  unp: string | null;
  legalName: string | null;
  legalAddress: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  status: RestaurantStatus;
  ownerId: string;
  customDomain: string | null;
  logoUrl: string | null;
  logoWebpUrl: string | null;
  createdAt: Date;
}
