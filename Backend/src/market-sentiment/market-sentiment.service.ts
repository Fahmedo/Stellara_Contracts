import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma.service';

export type SentimentLabel = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
export type TradingSignal = 'BUY' | 'SELL' | 'HOLD';

interface SentimentAnalysisResult {
  score: number;
  label: SentimentLabel;
  assets: string[];
}

@Injectable()
export class MarketSentimentService {
  private readonly logger = new Logger(MarketSentimentService.name);
  private sentimentPipeline: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
  ) {}

  async ingestSources() {
    const sources = [
      { name: 'twitter', handler: () => this.collectTwitter('XLM BTC ETH') },
      { name: 'reddit', handler: () => this.collectReddit('XLM OR BTC OR ETH') },
      { name: 'telegram', handler: () => this.collectTelegram('StellaraNews') },
      { name: 'news', handler: () => this.collectNewsSources() },
    ];

    const records = [];
    for (const source of sources) {
      try {
        const snippets = await source.handler();
        for (const snippet of snippets) {
          const sentiment = await this.analyzeText(snippet.text);
          if (!sentiment.assets.length) {
            sentiment.assets = this.extractAssets(snippet.text);
          }

          if (sentiment.assets.length === 0) {
            sentiment.assets = ['GENERAL'];
          }

          for (const asset of sentiment.assets) {
            const record = await (this.prisma as any).sentimentRecord.create({
              data: {
                source: source.name,
                asset,
                text: snippet.text,
                sentiment: sentiment.score,
                label: sentiment.label,
                metadata: {
                  collectedAt: new Date().toISOString(),
                  sourceId: snippet.id || null,
                },
              },
            });
            records.push(record);
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to ingest ${source.name} source: ${error?.message || error}`);
      }
    }

    return records;
  }

  async getLatestSentiment(asset?: string) {
    const where = asset ? { asset } : {};
    const latestRecords: any[] = await (this.prisma as any).sentimentRecord.findMany({
      where,
      orderBy: { collectedAt: 'desc' },
      take: asset ? 10 : 50,
    });

    if (asset && latestRecords.length) {
      const average = latestRecords.reduce((sum, record) => sum + Number(record.sentiment), 0) / latestRecords.length;
      return {
        asset,
        latest: latestRecords[0],
        meanScore: Number(average.toFixed(4)),
        sampleSize: latestRecords.length,
      };
    }

    const records = latestRecords as any[];
    const grouped = records.reduce((map, record) => {
      map[record.asset] = map[record.asset] || [];
      map[record.asset].push(record);
      return map;
    }, {} as Record<string, any[]>);

    return Object.entries(grouped).map(([assetKey, records]) => {
      const average = records.reduce((sum, record) => sum + Number(record.sentiment), 0) / records.length;
      return {
        asset: assetKey,
        latest: records[0],
        meanScore: Number(average.toFixed(4)),
        sampleSize: records.length,
      };
    });
  }

  async getTradingSignals() {
    const assets = ['XLM', 'BTC', 'ETH', 'GENERAL'];
    const signals = [];
    for (const asset of assets) {
      const signal = await this.generateSignal(asset);
      signals.push(signal);
      await (this.prisma as any).sentimentSignal.create({
        data: {
          asset,
          signal: signal.signal,
          score: signal.score,
          reason: signal.reason,
        },
      });
    }
    return signals;
  }

  async backtestAsset(asset: string) {
    const sentimentHistory = await (this.prisma as any).sentimentRecord.findMany({
      where: { asset },
      orderBy: { collectedAt: 'asc' },
    });
    const priceHistory = await this.fetchPriceHistory(asset, 7);

    const correlation = this.calculateCorrelation(sentimentHistory, priceHistory);
    return {
      asset,
      records: sentimentHistory.length,
      priceSnapshots: priceHistory.length,
      correlation: Number(correlation.toFixed(4)),
      trendShift: this.detectSuddenShift(sentimentHistory),
    };
  }

  private async generateSignal(asset: string) {
    const records: any[]: any[] = await (this.prisma as any).sentimentRecord.findMany({
      where: { asset },
      orderBy: { collectedAt: 'asc' },
    });
    const latest = records[records.length - 1];
    const score = latest ? Number(latest.sentiment) : 0;
    const shift = this.detectSuddenShift(records);
    const correlation = await this.calculateCorrelation(records, await this.fetchPriceHistory(asset, 7));

    const signal: TradingSignal = score > 0.25 && shift && correlation > 0.25
      ? 'BUY'
      : score < -0.25 && shift && correlation < -0.25
      ? 'SELL'
      : 'HOLD';

    const reason = shift
      ? `Detected sudden sentiment shift for ${asset} with current score ${score.toFixed(3)} and price correlation ${correlation.toFixed(3)}.`
      : `No strong market sentiment shift detected for ${asset}.`;

    return { asset, signal, score: Number(score.toFixed(4)), reason };
  }

  private extractAssets(text: string) {
    const matches = text.match(/\b(XLM|BTC|ETH)\b/gi) || [];
    return Array.from(new Set(matches.map((match) => match.toUpperCase())));
  }

  private async analyzeText(text: string): Promise<SentimentAnalysisResult> {
    const cleaned = text.trim().slice(0, 512);
    try {
      const prediction = await this.runBertSentiment(cleaned);
      return {
        score: prediction.score,
        label: prediction.label as SentimentLabel,
        assets: this.extractAssets(cleaned),
      };
    } catch (error) {
      this.logger.warn(`BERT sentiment pipeline failed, falling back to lexicon: ${error?.message || error}`);
      return this.fallbackSentiment(cleaned);
    }
  }

  private async runBertSentiment(text: string) {
    const pipeline = await this.loadSentimentPipeline();
    const [result] = await pipeline(text, { top_k: 1 });
    return {
      label: result.label.toUpperCase() as SentimentLabel,
      score: this.normalizeScore(result.score, result.label),
    };
  }

  private async loadSentimentPipeline() {
    if (this.sentimentPipeline) {
      return this.sentimentPipeline;
    }

    try {
      const transformers = await import('@xenova/transformers');
      const pipeline = transformers.pipeline as any;
      this.sentimentPipeline = await pipeline('sentiment-analysis', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english');
      return this.sentimentPipeline;
    } catch (error) {
      this.logger.warn(`Unable to initialize BERT pipeline: ${error?.message || error}`);
      throw error;
    }
  }

  private async fetchPriceCorrelation(asset: string, records: any[]) {
    const priceHistory = await this.fetchPriceHistory(asset, 7);
    return this.calculateCorrelation(records, priceHistory);
  }

  private normalizeScore(score: number, label: string) {
    return label.toLowerCase() === 'negative' ? -score : score;
  }

  private fallbackSentiment(text: string): SentimentAnalysisResult {
    const positiveKeywords = ['bull', 'rise', 'surge', 'moon', 'rally', 'up', 'bullish'];
    const negativeKeywords = ['dump', 'crash', 'bear', 'sell', 'down', 'panic', 'fear'];
    const lowerText = text.toLowerCase();
    const positiveMatches = positiveKeywords.filter((word) => lowerText.includes(word)).length;
    const negativeMatches = negativeKeywords.filter((word) => lowerText.includes(word)).length;
    const score = Math.max(-1, Math.min(1, (positiveMatches - negativeMatches) / 3));
    let label: SentimentLabel = 'NEUTRAL';
    if (score > 0.2) label = 'POSITIVE';
    if (score < -0.2) label = 'NEGATIVE';
    return { score, label, assets: this.extractAssets(text) };
  }

  private async collectTwitter(query: string) {
    const env = (globalThis as any).process?.env as Record<string, string | undefined> | undefined;
    const bearer = env?.TWITTER_BEARER_TOKEN;
    if (!bearer) {
      return [];
    }
    const url = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=5&tweet.fields=text,created_at`;
    const response = await firstValueFrom(this.httpService.get(url, { headers: { Authorization: `Bearer ${bearer}` } }) as any);
    const tweets = (response as any).data?.data || [];
    return tweets.map((tweet) => ({ id: tweet.id, text: tweet.text }));
  }

  private async collectReddit(query: string) {
    const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=5&sort=relevance&type=link`;
    const response = await firstValueFrom(this.httpService.get(url, { headers: { 'User-Agent': 'StellaraSentiment/1.0' } }) as any);
    const posts = (response as any).data?.data?.children || [];
    return posts.map((item) => ({ id: item.data.id, text: `${item.data.title} ${item.data.selftext || ''}`.trim() }));
  }

  private async collectTelegram(channel: string) {
    const url = `https://t.me/s/${encodeURIComponent(channel)}`;
    const response = await firstValueFrom(this.httpService.get(url, { headers: { 'User-Agent': 'StellaraSentiment/1.0' } }) as any);
    const textBlocks = Array.from(((response as any).data || '').matchAll(/<div class="tgme_widget_message_text js-message_text">([\s\S]*?)<\/div>/g));
    return textBlocks.slice(0, 5).map((match) => ({ id: null, text: match[1].replace(/<[^>]+>/g, '').trim() }));
  }

  private async collectNewsSources() {
    const sources = [
      'https://www.coindesk.com/',
      'https://cointelegraph.com/',
    ];
    const articles = [];
    for (const source of sources) {
      try {
        const response = await firstValueFrom(this.httpService.get(source, { headers: { 'User-Agent': 'Mozilla/5.0' } }) as any);
        const snippets = Array.from(((response as any).data || '').matchAll(/<p>([^<]{50,})<\/p>/gi)).slice(0, 5);
        for (const snippet of snippets) {
          articles.push({ id: null, text: snippet[1].replace(/\s+/g, ' ').trim() });
        }
      } catch {
        continue;
      }
    }
    return articles;
  }

  private detectSuddenShift(records: Array<{ sentiment: any }>) {
    if (records.length < 4) {
      return false;
    }
    const scores = records.map((record) => Number(record.sentiment));
    const mean = this.mean(scores.slice(0, -1));
    const sigma = this.std(scores.slice(0, -1), mean);
    const last = scores[scores.length - 1];
    return sigma > 0 && Math.abs(last - mean) > 2 * sigma;
  }

  private mean(values: number[]) {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private std(values: number[], mean: number) {
    const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private async fetchPriceHistory(asset: string, days: number) {
    const mapping = { XLM: 'stellar', BTC: 'bitcoin', ETH: 'ethereum' };
    const coinId = mapping[asset.toUpperCase()];
    if (!coinId) {
      return [];
    }

    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`;
    const response = await firstValueFrom(this.httpService.get(url) as any);
    return ((response as any).data?.prices || []).map((row: [number, number]) => ({ timestamp: row[0], price: row[1] }));
  }

  private calculateCorrelation(sentimentHistory: any[], priceHistory: Array<{ timestamp: number; price: number }>) {
    if (sentimentHistory.length < 3 || priceHistory.length < 3) {
      return 0;
    }

    const sentimentAverages = this.aggregateDailySentiment(sentimentHistory);
    const aligned = priceHistory
      .map((snapshot) => {
        const day = new Date(snapshot.timestamp).toISOString().slice(0, 10);
        return {
          sentiment: sentimentAverages[day] ?? null,
          price: snapshot.price,
        };
      })
      .filter((row) => row.sentiment !== null);

    if (aligned.length < 3) {
      return 0;
    }

    const sentimentScores = aligned.map((row) => row.sentiment as number);
    const prices = aligned.map((row) => row.price);
    const sentimentMean = this.mean(sentimentScores);
    const priceMean = this.mean(prices);
    const covariance = sentimentScores.reduce((sum, score, idx) => sum + (score - sentimentMean) * (prices[idx] - priceMean), 0) / sentimentScores.length;
    const sentimentStd = this.std(sentimentScores, sentimentMean);
    const priceStd = this.std(prices, priceMean);
    if (sentimentStd === 0 || priceStd === 0) {
      return 0;
    }
    return covariance / (sentimentStd * priceStd);
  }

  private aggregateDailySentiment(records: any[]) {
    return records.reduce((map, record) => {
      const day = new Date(record.collectedAt).toISOString().slice(0, 10);
      map[day] = map[day] || [];
      map[day].push(Number(record.sentiment));
      return map;
    }, {} as Record<string, number[]>);
  }
}
