import { Global, Module } from '@nestjs/common';
import { NextRevalidationService } from './next-revalidation.service';

@Global()
@Module({
  providers: [NextRevalidationService],
  exports: [NextRevalidationService],
})
export class NextRevalidationModule {}
