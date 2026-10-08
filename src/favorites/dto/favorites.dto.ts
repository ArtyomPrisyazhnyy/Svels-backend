import { IsUUID } from 'class-validator';

export class FavoritesListResponseDto {
  menuItemIds: string[];
}

export class MergeFavoritesDto {
  @IsUUID('4')
  guestId: string;
}
