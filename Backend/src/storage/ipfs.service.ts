import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface PinataResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

interface PinStatusResponse {
  rows: Array<{ ipfs_pin_hash: string; date_pinned: string; status: string }>;
}

@Injectable()
export class IpfsService implements OnModuleInit {
  private readonly logger = new Logger(IpfsService.name);

  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly jwt: string;
  private readonly gatewayUrl: string;
  private readonly maxRetries: number;

  constructor(private readonly config: ConfigService) {
    this.apiKey = config.get<string>('PINATA_API_KEY', '');
    this.apiSecret = config.get<string>('PINATA_API_SECRET', '');
    this.jwt = config.get<string>('PINATA_JWT', '');
    this.gatewayUrl = config.get<string>('PINATA_GATEWAY_URL', 'https://gateway.pinata.cloud');
    this.maxRetries = config.get<number>('IPFS_PIN_MAX_RETRIES', 3);
  }

  onModuleInit() {
    if (!this.jwt && (!this.apiKey || !this.apiSecret)) {
      this.logger.warn('Pinata credentials not configured — IPFS pinning will be unavailable');
    } else {
      this.logger.log('Pinata IPFS service initialized');
    }
  }

  private get authHeaders(): Record<string, string> {
    if (this.jwt) {
      return { Authorization: `Bearer ${this.jwt}` };
    }
    return {
      pinata_api_key: this.apiKey,
      pinata_secret_api_key: this.apiSecret,
    };
  }

  isConfigured(): boolean {
    return !!(this.jwt || (this.apiKey && this.apiSecret));
  }

  /**
   * Pin a file buffer to IPFS via Pinata with automatic retry.
   * Returns the CID (IPFS hash).
   */
  async upload(
    data: Buffer | string,
    options: { contentType?: string; filename?: string } = {},
  ): Promise<string> {
    this.assertConfigured();

    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const filename = options.filename ?? `upload-${Date.now()}`;

    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const formData = new FormData();
        formData.append(
          'file',
          new Blob([buffer], { type: options.contentType ?? 'application/octet-stream' }),
          filename,
        );
        formData.append(
          'pinataOptions',
          JSON.stringify({ cidVersion: 1 }),
        );

        const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
          method: 'POST',
          headers: this.authHeaders,
          body: formData,
        });

        if (!res.ok) {
          throw new Error(`Pinata API error ${res.status}: ${await res.text()}`);
        }

        const json = (await res.json()) as PinataResponse;
        this.logger.log(`Pinned to IPFS: ${json.IpfsHash} (${json.PinSize} bytes)`);
        return json.IpfsHash;
      } catch (err) {
        lastError = err as Error;
        this.logger.warn(`Pin attempt ${attempt}/${this.maxRetries} failed: ${lastError.message}`);
        if (attempt < this.maxRetries) {
          await this.delay(attempt * 1000);
        }
      }
    }

    throw new Error(`IPFS pinning failed after ${this.maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Pin JSON metadata directly to IPFS via Pinata.
   */
  async uploadJson(metadata: Record<string, unknown>, name?: string): Promise<string> {
    this.assertConfigured();

    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
          method: 'POST',
          headers: { ...this.authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pinataContent: metadata,
            pinataMetadata: { name: name ?? 'metadata' },
            pinataOptions: { cidVersion: 1 },
          }),
        });

        if (!res.ok) {
          throw new Error(`Pinata API error ${res.status}: ${await res.text()}`);
        }

        const json = (await res.json()) as PinataResponse;
        this.logger.log(`JSON pinned to IPFS: ${json.IpfsHash}`);
        return json.IpfsHash;
      } catch (err) {
        lastError = err as Error;
        this.logger.warn(`JSON pin attempt ${attempt}/${this.maxRetries} failed: ${lastError.message}`);
        if (attempt < this.maxRetries) {
          await this.delay(attempt * 1000);
        }
      }
    }

    throw new Error(`IPFS JSON pinning failed after ${this.maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Fetch content from IPFS via the configured Pinata gateway.
   */
  async download(cid: string): Promise<Buffer> {
    const url = this.getGatewayUrl(cid);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`IPFS fetch failed for ${cid}: ${res.status}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  /**
   * Check pin status for a given CID.
   */
  async getPinStatus(cid: string): Promise<string | null> {
    if (!this.isConfigured()) return null;
    try {
      const res = await fetch(
        `https://api.pinata.cloud/pinning/pinJobs?ipfs_pin_hash=${cid}`,
        { headers: this.authHeaders },
      );
      if (!res.ok) return null;
      const json = (await res.json()) as PinStatusResponse;
      return json.rows[0]?.status ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Unpin a CID from Pinata.
   */
  async unpin(cid: string): Promise<void> {
    this.assertConfigured();
    const res = await fetch(`https://api.pinata.cloud/pinning/unpin/${cid}`, {
      method: 'DELETE',
      headers: this.authHeaders,
    });
    if (!res.ok) {
      throw new Error(`Unpin failed for ${cid}: ${res.status}`);
    }
    this.logger.log(`Unpinned CID: ${cid}`);
  }

  /** Returns the public gateway URL for a CID. */
  getGatewayUrl(cid: string): string {
    return `${this.gatewayUrl}/ipfs/${cid}`;
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new Error('Pinata credentials not configured');
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
