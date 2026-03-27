import { Injectable } from '@nestjs/common';
import { PricesGateway } from './gateways/prices.gateway';
import { TradesGateway } from './gateways/trades.gateway';
import { MessagesGateway } from './gateways/messages.gateway';
import { ConnectionStateService } from './connection-state.service';
import { PriceUpdatePayload, TradeNotificationPayload } from './types/ws.types';

/**
 * Facade service for broadcasting WebSocket events from other modules.
 * Inject this service wherever you need to push real-time updates.
 */
@Injectable()
export class WebsocketService {
  constructor(
    private readonly pricesGateway: PricesGateway,
    private readonly tradesGateway: TradesGateway,
    private readonly messagesGateway: MessagesGateway,
    private readonly connectionState: ConnectionStateService,
  ) {}

  // --- Prices ---

  broadcastPriceUpdate(asset: string, payload: PriceUpdatePayload): void {
    this.pricesGateway.broadcastPriceUpdate(asset, payload);
  }

  // --- Trades ---

  notifyTradeUser(userId: string, payload: TradeNotificationPayload): void {
    this.tradesGateway.notifyUser(userId, payload);
  }

  broadcastTrade(asset: string, payload: TradeNotificationPayload): void {
    this.tradesGateway.broadcastTrade(asset, payload);
  }

  // --- Messages ---

  sendMessageToUser(userId: string, event: string, payload: any): void {
    this.messagesGateway.sendToUser(userId, event, payload);
  }

  // --- Connection state ---

  isUserOnline(userId: string): boolean {
    return this.connectionState.isOnline(userId);
  }

  getStats() {
    return this.connectionState.getStats();
  }
}
