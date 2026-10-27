import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsUUID } from 'class-validator';

export class ChangeSubscriptionPlanDto {
  @IsUUID('7')
  planId!: string;
}

export class ExtendTrialDto {
  @Type(() => Date)
  @IsDate()
  trialEndsAt!: Date;
}

export class CreateInvoiceDto {
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  periodStart?: Date;
}
