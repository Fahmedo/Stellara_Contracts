import { AbiRegistryService } from './abi-registry.service';

describe('AbiRegistryService', () => {
  let service: AbiRegistryService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      contractAbiRegistry: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      contractAbiVersion: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    service = new AbiRegistryService(prisma);
  });

  it('uses the current version when decoding a result', async () => {
    prisma.contractAbiRegistry.findUnique.mockResolvedValue({
      id: 'registry-1',
      contractAddress: 'CABC',
      contractType: 'market',
      displayName: 'Market',
      currentVersion: '2.0.0',
      versions: [
        {
          id: 'version-2',
          version: '2.0.0',
          isCurrent: true,
          functionSchemas: {
            settle: {
              outputs: [{ name: 'filled', type: 'u64' }],
            },
          },
          eventSchemas: {
            traded: {
              fields: {
                amount: { type: 'u64' },
              },
            },
          },
        },
      ],
    });

    const result = await service.decodeContractResult('CABC', {
      functionName: 'settle',
      rawResult: '42',
    });

    expect(result.result).toBe(42);
    expect(result.version).toBe('2.0.0');
  });

  it('parses indexed events using the event registry', async () => {
    prisma.contractAbiRegistry.findUnique.mockResolvedValue({
      id: 'registry-1',
      contractAddress: 'CABC',
      contractType: 'market',
      displayName: 'Market',
      currentVersion: '1.0.0',
      versions: [
        {
          id: 'version-1',
          version: '1.0.0',
          isCurrent: true,
          functionSchemas: {
            settle: {
              outputs: [],
            },
          },
          eventSchemas: {
            traded: {
              fields: {
                amount: { type: 'u64' },
                maker: { type: 'string' },
              },
            },
          },
        },
      ],
    });

    const result = await service.parseIndexedEvent({
      contractId: 'CABC',
      eventName: 'traded',
      data: { amount: '15', maker: 'wallet-1' },
    });

    expect(result.decoded).toEqual({
      amount: 15,
      maker: 'wallet-1',
    });
  });
});
