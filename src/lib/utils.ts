import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function randomDelay(minSeconds: number, maxSeconds: number): number {
  return Math.floor(Math.random() * (maxSeconds - minSeconds + 1) + minSeconds) * 1000;
}

export function formatPhoneNumber(phone: string): string {
  // Normalize WhatsApp phone number
  return phone.replace(/[^0-9]/g, '').replace(/^0/, '972');
}

export function getJidFromPhone(phone: string): string {
  const normalized = formatPhoneNumber(phone);
  return `${normalized}@s.whatsapp.net`;
}

export function maskPhone(phone: string): string {
  if (phone.length < 6) return phone;
  return phone.slice(0, 3) + '****' + phone.slice(-3);
}
