import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GUEST_ADDRESS_LOOKUP } from '../common/constants/injection-tokens';
import { GuestAddressLookupService } from './guest-address-lookup.service';
import { GuestAddressesController } from './guest-addresses.controller';
import { GuestAddressesService } from './guest-addresses.service';
import { GuestAddress } from './entities/guest-address.entity';

@Module({
  imports: [TypeOrmModule.forFeature([GuestAddress])],
  controllers: [GuestAddressesController],
  providers: [
    GuestAddressesService,
    GuestAddressLookupService,
    {
      provide: GUEST_ADDRESS_LOOKUP,
      useExisting: GuestAddressLookupService,
    },
  ],
  exports: [GUEST_ADDRESS_LOOKUP],
})
export class GuestAddressesModule {}
