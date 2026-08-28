// Centralized constants for the yearbook application
// This file can be imported by both client and server

// Current academic year - change this value to update the current year throughout the entire app
export const CURRENT_YEAR = 2027;

// Default prices (in USD - base currency) - now from environment variables with fallback values
// Check if we're in a server environment (Node.js) before accessing process.env
const isServer = typeof process !== 'undefined' && process.env;
export const SCHOOL_YEAR_PRICE = isServer ? parseFloat(process.env.SCHOOL_YEAR_PRICE || '16.99') : 16.99;
export const VIEWER_YEAR_PRICE = isServer ? parseFloat(process.env.VIEWER_YEAR_PRICE || '6.99') : 6.99;
export const BADGE_SLOT_PRICE = isServer ? parseFloat(process.env.BADGE_SLOT_PRICE || '0.99') : 0.99;

// Application settings
export const MIN_FOUNDING_YEAR = 1800;

// Beta version flag — when true, purchases are replaced with free unlocks (no payment)
export const BETA_VERSION = true;
