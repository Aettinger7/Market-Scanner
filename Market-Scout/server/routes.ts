import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { MarketScanner } from "./lib/scanner";
import { DEFAULT_ASSETS } from "@shared/schema";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  const scanner = new MarketScanner();
  let isScanning = false;

  app.post(api.scan.run.path, async (req, res) => {
    if (isScanning) {
      return res.status(200).json({ message: "Scan already in progress." });
    }

    isScanning = true;
    res.json({ message: "Scan started in background. Results will appear as they are found." });

    // Run in background
    (async () => {
      try {
        console.log("Starting Background Market Scan...");
        const timeframes = ['1h', '4h', '1d'];

        for (const asset of DEFAULT_ASSETS) {
          const isCrypto = asset.type === 'crypto';
          const mtfSignals: any[] = [];
          
          for (const tf of timeframes) {
             // Rate limit handling: sleep 12s between calls to respect 5 calls/min free tier
             // If the key is paid, this is slow, but safe.
             // We'll try 12 seconds.
             console.log(`Scanning ${asset.symbol} ${tf}...`);
             try {
                const signal = await scanner.checkBuySignal(asset.symbol, tf, isCrypto);
                if (signal) {
                  mtfSignals.push({ tf, ...signal });
                }
             } catch (err) {
                console.error(`Error scanning ${asset.symbol} ${tf}:`, err);
             }
             
             await sleep(12000); 
          }

          if (mtfSignals.length >= 2) {
             const totalScore = mtfSignals.reduce((sum, s) => sum + s.score, 0);
             const criteriaAll: Record<string, boolean> = {};
             mtfSignals.forEach(s => {
               Object.entries(s.criteria).forEach(([k, v]) => {
                  if (v) criteriaAll[`${s.tf}_${k}`] = true;
               });
             });
             
             const invalidation = Math.min(...mtfSignals.map(s => s.invalidation));

             const signalRecord = {
               symbol: asset.symbol,
               score: totalScore,
               criteria: criteriaAll,
               invalidationPrice: invalidation,
               type: asset.type
             };
             
             console.log(`Found opportunity: ${asset.symbol}`);
             await storage.saveSignal(signalRecord);
          }
        }
        console.log("Market Scan Completed.");
      } catch (error) {
        console.error("Scan error:", error);
      } finally {
        isScanning = false;
      }
    })();
  });

  app.get(api.scan.latest.path, async (req, res) => {
    const signals = await storage.getLatestSignals();
    res.json(signals);
  });

  return httpServer;
}
