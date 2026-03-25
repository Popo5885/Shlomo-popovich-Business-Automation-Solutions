/**
 * Anti-Ban Engine
 *
 * Strategies:
 * 1. Warmup mode: gradually increase messages per day over 7 days
 * 2. Randomized delays: human-like pauses between sends
 * 3. "Typing" presence simulation before sending
 * 4. Daily limits per number (not just per client)
 * 5. Profile-based delay configs
 */

import { WASocket } from '@whiskeysockets/baileys';
import { prisma } from '@/lib/prisma';
import { sleep, randomDelay } from '@/lib/utils';

export type AntiBanProfile = 'conservative' | 'moderate' | 'aggressive';

interface DelayConfig {
  min: number;  // seconds
  max: number;  // seconds
  typingSimulation: boolean;
  typingDuration: [number, number]; // [min, max] ms
}

const PROFILES: Record<AntiBanProfile, DelayConfig> = {
  conservative: {
    min: 30, max: 90,
    typingSimulation: true,
    typingDuration: [2000, 5000],
  },
  moderate: {
    min: 10, max: 30,
    typingSimulation: true,
    typingDuration: [1000, 3000],
  },
  aggressive: {
    min: 3, max: 10,
    typingSimulation: false,
    typingDuration: [500, 1500],
  },
};

// Warmup schedule: max messages per day by warmup day
const WARMUP_SCHEDULE: Record<number, number> = {
  1: 10, 2: 20, 3: 40, 4: 60, 5: 80, 6: 100, 7: 150,
};

export class AntiBanEngine {
  /**
   * Get the effective delay config for a client (override > profile > default)
   */
  static getDelayConfig(
    profile: string,
    customMin?: number | null,
    customMax?: number | null,
  ): DelayConfig {
    const base = PROFILES[profile as AntiBanProfile] || PROFILES.conservative;
    if (customMin && customMax) {
      return { ...base, min: customMin, max: customMax };
    }
    return base;
  }

  /**
   * Pre-send routine: simulate typing presence, check warmup limits
   */
  static async preSend(
    sock: WASocket,
    targetJid: string,
    numberId: string,
    profile: string,
    customMin?: number | null,
    customMax?: number | null,
  ): Promise<void> {
    const config = AntiBanEngine.getDelayConfig(profile, customMin, customMax);

    // Check warmup limits
    const number = await prisma.connectedNumber.findUnique({
      where: { id: numberId },
      select: { messagesSentToday: true, warmupDay: true, status: true },
    });

    if (number?.status === 'WARMUP') {
      const maxToday = WARMUP_SCHEDULE[number.warmupDay] || 10;
      if ((number.messagesSentToday || 0) >= maxToday) {
        throw new Error(`WARMUP_LIMIT: Number ${numberId} reached warmup daily limit of ${maxToday}`);
      }
    }

    // Simulate "typing..." presence
    if (config.typingSimulation) {
      try {
        await sock.sendPresenceUpdate('composing', targetJid);
        const typingMs = randomDelay(config.typingDuration[0], config.typingDuration[1]);
        await sleep(typingMs);
        await sock.sendPresenceUpdate('paused', targetJid);
      } catch {
        // Non-critical — continue even if presence fails
      }
    }
  }

  /**
   * Post-send routine: update counters, apply delay
   */
  static async postSend(numberId: string, profile: string, customMin?: number | null, customMax?: number | null): Promise<void> {
    // Increment counter
    await prisma.connectedNumber.update({
      where: { id: numberId },
      data: {
        messagesSentToday: { increment: 1 },
        lastMessageAt: new Date(),
      },
    });

    const config = AntiBanEngine.getDelayConfig(profile, customMin, customMax);
    const delayMs = randomDelay(config.min * 1000, config.max * 1000);
    await sleep(delayMs);
  }

  /**
   * Reset daily counters (called by cron at midnight)
   */
  static async resetDailyCounters(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.connectedNumber.updateMany({
      where: { lastMessageAt: { lt: today } },
      data: { messagesSentToday: 0 },
    });

    // Advance warmup day for WARMUP numbers
    await prisma.connectedNumber.updateMany({
      where: { status: 'WARMUP', warmupDay: { lt: 7 } },
      data: { warmupDay: { increment: 1 } },
    });

    // Graduate from warmup after day 7
    await prisma.connectedNumber.updateMany({
      where: { status: 'WARMUP', warmupDay: { gte: 7 } },
      data: { status: 'ONLINE' },
    });
  }
}
