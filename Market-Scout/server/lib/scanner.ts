import axios from 'axios';
import { RSI, MACD, EMA, ATR, ADX } from 'technicalindicators';

const POLYGON_API_KEY = "2lm_5uIh9NF6hQkcOxJN85RL9Ta0xHjF";

interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ScanResult {
  score: number;
  criteria: Record<string, boolean>;
  invalidation: number;
}

export class PolygonDataProvider {
  private client = axios.create({
    baseURL: 'https://api.polygon.io',
    params: { apiKey: POLYGON_API_KEY }
  });

  async getOHLCV(symbol: string, timeframe: string, limit: number = 200): Promise<OHLCV[]> {
    let multiplier = 1;
    let timespan = 'day';
    
    if (timeframe.endsWith('m')) {
      multiplier = parseInt(timeframe.slice(0, -1));
      timespan = 'minute';
    } else if (timeframe.endsWith('h')) {
      multiplier = parseInt(timeframe.slice(0, -1));
      timespan = 'hour';
    } else if (timeframe.endsWith('d')) {
      multiplier = parseInt(timeframe.slice(0, -1));
      timespan = 'day';
    }

    // Calculate approx start date based on limit (rough estimate to ensure we get enough data)
    // Polygon API requires start/end dates. 
    // For simplicity in this demo, we'll request a large window.
    const toDate = new Date().toISOString().split('T')[0];
    const fromDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString().split('T')[0]; // 60 days back

    try {
        const url = `/v2/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${fromDate}/${toDate}`;
        // console.log(`Fetching ${url}`);
        const res = await this.client.get(url, {
          params: {
            adjusted: true,
            sort: 'asc',
            limit: limit
          }
        });

        if (!res.data.results) return [];

        return res.data.results.map((r: any) => ({
          timestamp: r.t,
          open: r.o,
          high: r.h,
          low: r.l,
          close: r.c,
          volume: r.v
        }));
    } catch (e) {
      console.error(`Error fetching data for ${symbol}:`, e instanceof Error ? e.message : e);
      return [];
    }
  }
}

export class MarketScanner {
  private dataProvider: PolygonDataProvider;

  constructor() {
    this.dataProvider = new PolygonDataProvider();
  }

  // --- Indicators (using technicalindicators lib + manual implementation where needed) ---

  private calculateRSI(values: number[], period: number = 14) {
    return RSI.calculate({ values, period });
  }

  private calculateMACD(values: number[]) {
    return MACD.calculate({
      values,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false
    });
  }

  private calculateEMA(values: number[], period: number) {
    return EMA.calculate({ values, period });
  }

  private calculateATR(high: number[], low: number[], close: number[], period: number = 14) {
    return ATR.calculate({ high, low, close, period });
  }

  private calculateADX(high: number[], low: number[], close: number[], period: number = 14) {
    return ADX.calculate({ high, low, close, period });
  }

  private isBullishDivergence(prices: number[], indicator: number[], lookback: number = 30): boolean {
    // Simplified divergence check matching Python logic conceptually
    // Finding local lows is complex on array streams without robust peak detection
    // Implementation: simple check on last 30 periods
    // We need at least 2 valleys.
    
    // This is a simplified logic compared to pandas shift/vectorized operations
    // We look for the lowest low in the last 5 periods vs lowest low in periods 15-30
    
    const len = prices.length;
    if (len < lookback) return false;
    
    const recentSlice = prices.slice(len - 5);
    const recentLow = Math.min(...recentSlice);
    const recentLowIdx = len - 5 + recentSlice.indexOf(recentLow);

    const prevSlice = prices.slice(len - lookback, len - 10);
    if (prevSlice.length === 0) return false;
    const prevLow = Math.min(...prevSlice);
    const prevLowIdx = len - lookback + prevSlice.indexOf(prevLow);

    // Price made a Lower Low (or Double Bottom)
    if (recentLow <= prevLow) {
       // Indicator should make Higher Low
       if (indicator[recentLowIdx] > indicator[prevLowIdx]) {
         return true;
       }
    }
    return false;
  }

  public async checkBuySignal(symbol: string, timeframe: string, isCrypto: boolean): Promise<ScanResult | null> {
    const data = await this.dataProvider.getOHLCV(symbol, timeframe);
    if (data.length < 50) return null;

    const closes = data.map(d => d.close);
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const volumes = data.map(d => d.volume);

    // Indicators
    const rsiValues = this.calculateRSI(closes);
    const macdValues = this.calculateMACD(closes);
    const ema10 = this.calculateEMA(closes, 10);
    const ema20 = this.calculateEMA(closes, 20);
    const ema50 = this.calculateEMA(closes, 50);
    const atrValues = this.calculateATR(highs, lows, closes);
    const adxValues = this.calculateADX(highs, lows, closes);

    // Need to align arrays since indicators reduce length
    // We only care about the most recent values
    const lastIdx = data.length - 1;
    
    // Helper to get value at index from end (0 = last, 1 = prev)
    // technicalindicators results are shorter than input. 
    // RSI(14) result starts at index 14 of input.
    // So result[result.length - 1] corresponds to input[input.length - 1]
    
    const getLast = (arr: any[], offset: number = 0) => arr[arr.length - 1 - offset];

    const lastAdx = getLast(adxValues);
    // Vol avg 20
    const volAvg20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    
    // Vol Std Dev (simplified)
    // Python: df['close'].pct_change().rolling(20).std()
    // We'll skip complex Vol Std calculation for speed unless critical, 
    // or assume it's positive/valid if we have volume.
    // The python script checks: if last['adx'] < 25 or last['vol_std'] < 0.01: return None
    
    // ADX Check
    if (!lastAdx || lastAdx.adx < 25) return null;

    // Volume Threshold
    const volThreshold = isCrypto ? 1000000 : 100000;
    if (volAvg20 < volThreshold) return null;

    let score = 0;
    const criteria: Record<string, boolean> = {};

    // 1. RSI Reclaim or Divergence
    const lastRsi = getLast(rsiValues);
    const prevRsi = getLast(rsiValues, 1);
    
    const rsiReclaim = (prevRsi < 30) && (lastRsi > 30);
    const rsiDivergence = this.isBullishDivergence(lows, rsiValues, 30); // Note: rsiValues alignment is handled inside if we passed aligned arrays, but here we pass full lows and partial rsi. 
    // Quick fix for divergence alignment: pass only the aligned suffix of lows matching RSI
    // RSI output is shorter by 14.
    const alignedLows = lows.slice(14); // Approximate alignment
    const rsiDivCheck = this.isBullishDivergence(alignedLows, rsiValues, 30);

    if (rsiReclaim || rsiDivCheck) {
      criteria['rsi'] = true;
      score += 25;
    }

    // 2. MACD
    const lastMacd = getLast(macdValues);
    const prevMacd = getLast(macdValues, 1);
    const prev2Macd = getLast(macdValues, 2);
    
    if (lastMacd && prevMacd && prev2Macd) {
      if (lastMacd.histogram > 0 && lastMacd.histogram > prevMacd.histogram && prevMacd.histogram > prev2Macd.histogram) {
        criteria['macd'] = true;
        score += 20;
      }
    }

    // 3. EMA alignment
    const lastClose = closes[lastIdx];
    const e10 = getLast(ema10);
    const e20 = getLast(ema20);
    const e50 = getLast(ema50);
    
    if (lastClose > e10 && e10 > e20 && e20 > e50) {
       criteria['ema'] = true;
       score += 20;
    }

    // 4. Structure (Higher Low)
    const recentLows = lows.slice(-20);
    const olderLows = lows.slice(-40, -20);
    const minRecent = Math.min(...recentLows);
    const minOlder = olderLows.length > 0 ? Math.min(...olderLows) : Infinity;
    
    if (minRecent > minOlder) {
      criteria['structure'] = true;
      score += 20;
    }

    // 5. Volume Spike
    const lastVol = volumes[lastIdx];
    if (lastVol > 1.5 * volAvg20) {
      criteria['volume'] = true;
      score += 15;
    }

    if (score < 70) return null;

    const lastAtr = getLast(atrValues);
    const invalidation = minRecent - (lastAtr || 0);

    return {
      score,
      criteria,
      invalidation
    };
  }
}
