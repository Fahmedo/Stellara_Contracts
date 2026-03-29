/// <reference types="jest" />
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { MarketSentimentService } from './market-sentiment.service';

const mockPrisma = {
  sentimentRecord: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  sentimentSignal: {
    create: jest.fn(),
  },
};

const mockHttpService = {
  get: jest.fn(),
};

describe('MarketSentimentService', () => {
  let service: MarketSentimentService;

  beforeEach(() => {
    service = new MarketSentimentService(mockPrisma as any, mockHttpService as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('extracts asset mentions from text', () => {
    const assets = service['extractAssets']('BTC and XLM news with ETH mention');
    expect(assets).toEqual(['BTC', 'XLM', 'ETH']);
  });

  it('falls back when BERT pipeline is unavailable', async () => {
    jest.spyOn(service as any, 'loadSentimentPipeline').mockImplementation(async () => {
      throw new Error('no model');
    });
    const result = await service['analyzeText']('Bitcoin is pumping, bullish momentum everywhere');
    expect(result.label).toBe('POSITIVE');
    expect(result.score).toBeGreaterThan(0);
  });

  it('detects a sudden sentiment shift', () => {
    const records = [
      { sentiment: 0.1 },
      { sentiment: 0.05 },
      { sentiment: 0.2 },
      { sentiment: 0.9 },
    ];
    const shift = service['detectSuddenShift'](records as any[]);
    expect(shift).toBe(true);
  });

  it('returns zero correlation when not enough price data', async () => {
    mockPrisma.sentimentRecord.findMany.mockResolvedValue([]);
    const result = await service.backtestAsset('XLM');
    expect(result.correlation).toBe(0);
  });
});
