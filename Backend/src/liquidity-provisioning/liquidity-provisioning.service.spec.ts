import { Test, TestingModule } from '@nestjs/testing';
import { LiquidityProvisioningService } from './liquidity-provisioning.service';
import { LiquidityAggregationService } from '../liquidity-aggregation/services/liquidity-aggregation.service';
import { PrismaService } from '../prisma.service';

describe('LiquidityProvisioningService', () => {
  let service: LiquidityProvisioningService;
  let liquidityAggregationService: LiquidityAggregationService;
  let prisma: any;

  beforeEach(async () => {
    const mockAggregationService = {
      getSupportedSymbols: jest.fn(),
      getAggregatedOrderBook: jest.fn(),
      createExecutionPlan: jest.fn(),
      executeOrder: jest.fn(),
    };

    const mockPrismaService = {
      liquidityProvisioningPosition: {
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
      liquidityProvisioningPnl: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LiquidityProvisioningService,
        {
          provide: LiquidityAggregationService,
          useValue: mockAggregationService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<LiquidityProvisioningService>(LiquidityProvisioningService);
    liquidityAggregationService = module.get<LiquidityAggregationService>(LiquidityAggregationService);
    prisma = module.get<any>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate a quote for a healthy order book', async () => {
    const symbol = 'BTC/USDT';
    const orderBook = {
      symbol,
      bids: [{ price: '50000', amount: '5', timestamp: Date.now(), source: 'binance' }],
      asks: [{ price: '50050', amount: '5', timestamp: Date.now(), source: 'binance' }],
      timestamp: Date.now(),
      sources: ['binance'],
      totalVolume: { bid: '5', ask: '5' },
      weightedSpread: '50',
      liquidityDistribution: {},
    };

    jest.spyOn(liquidityAggregationService, 'getAggregatedOrderBook').mockResolvedValue(orderBook as any);

    const quote = await service.getQuote(symbol);

    expect(liquidityAggregationService.getAggregatedOrderBook).toHaveBeenCalledWith(symbol);
    expect(quote.symbol).toBe(symbol);
    expect(quote.enabled).toBe(true);
    expect(quote.bid).toBeGreaterThan(0);
    expect(quote.ask).toBeGreaterThan(quote.bid);
  });

  it('should skip quoting when market conditions are not safe', async () => {
    const symbol = 'ETH/USDT';
    const orderBook = {
      symbol,
      bids: [{ price: '2000', amount: '0.01', timestamp: Date.now(), source: 'binance' }],
      asks: [{ price: '2200', amount: '0.01', timestamp: Date.now(), source: 'binance' }],
      timestamp: Date.now(),
      sources: ['binance'],
      totalVolume: { bid: '0.01', ask: '0.01' },
      weightedSpread: '200',
      liquidityDistribution: {},
    };

    jest.spyOn(liquidityAggregationService, 'getAggregatedOrderBook').mockResolvedValue(orderBook as any);

    const quote = await service.getQuote(symbol);

    expect(quote.enabled).toBe(false);
    expect(quote.reason).toContain('Market conditions');
  });

  it('should rebalance when inventory skew exceeds the threshold', async () => {
    const symbol = 'BTC/USDT';
    service['positions'][symbol] = {
      symbol,
      baseBalance: 10,
      quoteBalance: 0,
      averageCost: 50000,
      realizedPnl: 0,
      unrealizedPnl: 0,
      lastUpdated: Date.now(),
    };

    const orderBook = {
      symbol,
      bids: [{ price: '50000', amount: '10', timestamp: Date.now(), source: 'binance' }],
      asks: [{ price: '50100', amount: '10', timestamp: Date.now(), source: 'binance' }],
      timestamp: Date.now(),
      sources: ['binance'],
      totalVolume: { bid: '10', ask: '10' },
      weightedSpread: '100',
      liquidityDistribution: {},
    };

    const mockPlan = {
      orderId: 'liq-provision-1',
      splits: [{ source: 'binance', amount: '1', expectedSlippage: 0.001, fee: '0.001', estimatedExecutionTime: 100 }],
      totalExpectedSlippage: 0.001,
      totalFees: '0.001',
      estimatedExecutionTime: 100,
      confidence: 0.95,
    };

    const mockExecutions = [
      {
        id: 'exec-1',
        orderId: 'liq-provision-1',
        source: 'binance',
        symbol,
        side: 'sell' as const,
        amount: '1.00000000',
        price: '50000',
        fee: '0.001',
        status: 'filled' as const,
        filledAmount: '1.00000000',
        averagePrice: '50000',
        timestamp: Date.now(),
      },
    ];

    jest.spyOn(liquidityAggregationService, 'getAggregatedOrderBook').mockResolvedValue(orderBook as any);
    jest.spyOn(liquidityAggregationService, 'createExecutionPlan').mockResolvedValue(mockPlan as any);
    jest.spyOn(liquidityAggregationService, 'executeOrder').mockResolvedValue(mockExecutions as any);
    jest.spyOn(prisma.liquidityProvisioningPosition, 'upsert').mockResolvedValue({} as any);
    jest.spyOn(prisma.liquidityProvisioningPnl, 'create').mockResolvedValue({} as any);

    const result = await service.rebalance(symbol);

    expect(liquidityAggregationService.createExecutionPlan).toHaveBeenCalled();
    expect(liquidityAggregationService.executeOrder).toHaveBeenCalled();
    expect(prisma.liquidityProvisioningPosition.upsert).toHaveBeenCalled();
    expect(prisma.liquidityProvisioningPnl.create).toHaveBeenCalled();
    expect(result.rebalance).toBe(true);
  });
});
