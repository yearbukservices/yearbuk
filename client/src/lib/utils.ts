import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Currency conversion utilities
let exchangeRateCache: { rate: number; timestamp: number } | null = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

export async function getUSDToNGNRate(): Promise<number> {
  // Check if we have a cached rate that's less than 1 hour old
  if (exchangeRateCache && (Date.now() - exchangeRateCache.timestamp) < CACHE_DURATION) {
    return exchangeRateCache.rate;
  }

  try {
    // Use free Fawaz Exchange API - no rate limits
    const response = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
    const data = await response.json();
    
    if (data && data.usd && data.usd.ngn) {
      const rate = data.usd.ngn;
      // Cache the rate
      exchangeRateCache = {
        rate,
        timestamp: Date.now()
      };
      return rate;
    } else {
      throw new Error('Invalid API response');
    }
  } catch (error) {
    console.error('Failed to fetch exchange rate:', error);
    // Fallback to approximate rate if API fails
    return 1650; // Approximate USD to NGN rate as fallback
  }
}

export function convertUSDToNGN(usdAmount: number, exchangeRate: number): number {
  return usdAmount * exchangeRate;
}

export function formatNGN(amount: number): string {
  return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatUSD(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
