export interface RegistrationLocationDto {
  label?: string;
  city?: string;
  address: string;
}

export class PendingRegistrationDto {
  id: string;
  name: string;
  description: string | null;
  address: string;
  unp: string;
  isChain: boolean;
  locations: RegistrationLocationDto[];
  applicantId: string;
  status: string;
  createdAt: Date;
}
