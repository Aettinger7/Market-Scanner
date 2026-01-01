import { pgTable, text, serial, integer, boolean, timestamp, jsonb, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===

// Store scan results to display history or current state
export const signals = pgTable("signals", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  score: integer("score").notNull(),
  criteria: jsonb("criteria").notNull(), // Stores { rsi: boolean, macd: boolean, ... }
  invalidationPrice: doublePrecision("invalidation_price").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  type: text("type").notNull(), // 'stock' or 'crypto'
});

export const insertSignalSchema = createInsertSchema(signals).omit({ id: true, timestamp: true });

// === EXPLICIT API CONTRACT TYPES ===

export type Signal = typeof signals.$inferSelect;
export type InsertSignal = z.infer<typeof insertSignalSchema>;

export type ScanResponse = Signal[];

// Configuration for assets to scan
export type AssetConfig = {
  symbol: string;
  type: 'stock' | 'crypto';
}

export const DEFAULT_ASSETS: AssetConfig[] = [
  { symbol: 'AAPL', type: 'stock' },
  { symbol: 'MSFT', type: 'stock' },
  { symbol: 'TSLA', type: 'stock' },
  { symbol: 'X:BTCUSD', type: 'crypto' },
  { symbol: 'X:ETHUSD', type: 'crypto' }
];
