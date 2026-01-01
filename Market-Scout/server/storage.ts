import { db } from "./db";
import { signals, type InsertSignal, type Signal } from "@shared/schema";
import { desc } from "drizzle-orm";

export interface IStorage {
  saveSignal(signal: InsertSignal): Promise<Signal>;
  getLatestSignals(): Promise<Signal[]>;
  clearSignals(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async saveSignal(signal: InsertSignal): Promise<Signal> {
    const [saved] = await db.insert(signals).values(signal).returning();
    return saved;
  }

  async getLatestSignals(): Promise<Signal[]> {
    // Get the most recent batch of signals
    // For simplicity, we just return the last 50, sorted by timestamp descending
    return await db.select()
      .from(signals)
      .orderBy(desc(signals.timestamp))
      .limit(50);
  }

  async clearSignals(): Promise<void> {
    // Optional: implement if we want to clear old history
    // await db.delete(signals);
  }
}

export const storage = new DatabaseStorage();
