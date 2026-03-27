export interface AuthenticatedSocket {
  id: string;
  userId: string;
  walletAddress: string;
  roles: string[];
  rooms: Set<string>;
}

export interface WsPayload<T = any> {
  event: string;
  data: T;
  room?: string;
}

export interface PriceUpdatePayload {
  asset: string;
  price: number;
  change24h: number;
  volume24h: number;
  timestamp: number;
}

export interface TradeNotificationPayload {
  tradeId: string;
  userId: string;
  asset: string;
  type: 'BUY' | 'SELL';
  amount: number;
  price: number;
  status: 'PENDING' | 'EXECUTED' | 'FAILED';
  timestamp: number;
}

export interface MessagePayload {
  messageId: string;
  senderId: string;
  recipientId?: string;
  room?: string;
  content: string;
  timestamp: number;
}
