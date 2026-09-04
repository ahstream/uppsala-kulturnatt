#!/usr/bin/env node
import { FARM_INTERVAL_BEFORE_START_DATE, FARM_INTERVAL_ON_START_DATE, GLOBAL_START_DATE } from '../globals';
import { farmEvents } from './farmEvents';

const INTERVAL_MULTIPLIERS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

function parseInterval(value: string): number {
  const match = value.trim().match(/^(\d+)\s*([smhd])$/i);
  if (!match) throw new Error(`Invalid farm interval "${value}". Use a number followed by s, m, h, or d.`);

  const duration = Number(match[1]) * INTERVAL_MULTIPLIERS[match[2].toLowerCase()];
  if (!Number.isSafeInteger(duration) || duration <= 0) throw new Error(`Invalid farm interval "${value}".`);
  return duration;
}

function startDateTimestamp(): number {
  const timestamp = Date.parse(`${GLOBAL_START_DATE}T00:00:00`);
  if (Number.isNaN(timestamp)) throw new Error(`Invalid GLOBAL_START_DATE "${GLOBAL_START_DATE}". Use YYYY-MM-DD.`);
  return timestamp;
}

export function farmInterval(now = Date.now()): { label: string; milliseconds: number } {
  const onOrAfterStartDate = now >= startDateTimestamp();
  const label = onOrAfterStartDate ? FARM_INTERVAL_ON_START_DATE : FARM_INTERVAL_BEFORE_START_DATE;
  return { label, milliseconds: parseInterval(label) };
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat('sv-SE', { dateStyle: 'short', timeStyle: 'medium' }).format(timestamp);
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function farmLooper(): Promise<void> {
  console.log(`Farm loop started. Start date: ${GLOBAL_START_DATE}.`);
  while (true) {
    console.log(`\nFarm run started: ${formatTime(Date.now())}`);
    const error = farmEvents();
    if (error) console.error(`Farm run failed: ${error.message}`);
    else console.log(`Farm run completed: ${formatTime(Date.now())}`);

    const interval = farmInterval();
    const nextRun = Date.now() + interval.milliseconds;
    console.log(`Waiting ${interval.label}; next run: ${formatTime(nextRun)}.`);
    await wait(interval.milliseconds);
  }
}

if (require.main === module) {
  farmLooper().catch((error) => {
    console.error('Farm loop failed:', error.message || error);
    process.exitCode = 1;
  });
}
