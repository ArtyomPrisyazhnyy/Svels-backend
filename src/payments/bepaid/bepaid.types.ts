export interface BePaidCredentials {
  shopId: string;
  secretKey: string;
}

export interface BePaidCheckoutCreateParams {
  amountMinor: number;
  currency: string;
  description: string;
  trackingId: string;
  transactionType: 'payment' | 'authorization';
  test: boolean;
  notificationUrl: string;
  successUrl: string;
  failUrl: string;
  declineUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  customerPhone?: string;
  customerFirstName?: string;
}

export interface BePaidCheckoutCreateResult {
  token: string;
  redirectUrl: string;
}

export interface BePaidTransactionResult {
  uid: string;
  parentUid: string | null;
  status: string;
  type: string;
  amount: number;
  currency: string;
  trackingId: string | null;
  message: string | null;
  test: boolean;
  raw: Record<string, unknown>;
}
