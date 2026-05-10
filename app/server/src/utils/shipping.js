import prisma from '../config/prisma.js';

// Country code map — normalises common country names to ISO codes
const COUNTRY_NAME_TO_CODE = {
  'new zealand': 'NZ',
  'australia': 'AU',
  'united states': 'US',
  'usa': 'US',
  'united kingdom': 'GB',
  'uk': 'GB',
  'nepal': 'NP',
  'india': 'IN',
  'canada': 'CA',
  'germany': 'DE',
  'france': 'FR',
  'japan': 'JP',
  'china': 'CN',
  'singapore': 'SG',
};

/**
 * Shipping method definitions.
 * Each method has a base cost multiplier applied on top of the country rate,
 * plus a fixed label and estimated delivery window.
 */
export const SHIPPING_METHODS = [
  {
    id: 'standard',
    label: 'Standard Shipping',
    description: 'Delivered in 5–10 business days',
    multiplier: 1.0,   // base rate × 1.0
    freeThreshold: null, // use env SHIPPING_FREE_THRESHOLD if set
  },
  {
    id: 'express',
    label: 'Express Shipping',
    description: 'Delivered in 2–4 business days',
    multiplier: 1.8,
    freeThreshold: null,
  },
  {
    id: 'overnight',
    label: 'Overnight Shipping',
    description: 'Next business day delivery',
    multiplier: 3.0,
    freeThreshold: null,
  },
];

/**
 * Resolves a country name or ISO code to an ISO code.
 */
const resolveCode = (country = '') => {
  const normalized = country.trim().toLowerCase();
  return COUNTRY_NAME_TO_CODE[normalized] || country.trim().toUpperCase();
};

/**
 * Looks up a country in the database by name or ISO code.
 * Returns the ShippingCountry row with active methods, or null.
 */
const getDbCountry = async (country = '') => {
  const normalized = country.trim();
  return prisma.shippingCountry.findFirst({
    where: {
      active: true,
      OR: [
        { code: { equals: normalized.toUpperCase() } },
        { name: { equals: normalized, mode: 'insensitive' } },
      ],
    },
    include: { methods: { where: { active: true } } },
  });
};

/**
 * Returns the base shipping cost for a country (before method multiplier).
 * Checks the database first, then falls back to .env variables.
 */
const getBaseRate = async (code) => {
  // Try database first
  const dbCountry = await getDbCountry(code);
  if (dbCountry) {
    return dbCountry.baseCost;
  }

  // Fallback to .env
  const envKey = `SHIPPING_RATE_${code}`;
  const rate = process.env[envKey];
  if (rate !== undefined) return parseFloat(rate);
  const defaultRate = process.env.SHIPPING_RATE_DEFAULT;
  return defaultRate !== undefined ? parseFloat(defaultRate) : 0;
};

/**
 * Returns the shipping cost for a given country + method.
 * Checks the database first for country/method rates, then falls back to .env.
 * Falls back to 'standard' if methodId is unrecognised.
 */
export const getShippingCost = async (country = '', methodId = 'standard') => {
  const code = resolveCode(country);
  
  // Try database first
  const dbCountry = await getDbCountry(code);
  if (dbCountry) {
    const methodRow = dbCountry.methods.find((m) => m.methodId === methodId);
    const baseCost = methodRow ? methodRow.cost : dbCountry.baseCost;
    
    // Free threshold check
    const freeThreshold = process.env.SHIPPING_FREE_THRESHOLD;
    if (freeThreshold && baseCost === 0) return 0;
    
    return Math.round(baseCost * 100) / 100;
  }

  // Fallback to .env-based calculation
  const base = await getBaseRate(code);

  // Free threshold check (env SHIPPING_FREE_THRESHOLD, e.g. "100")
  const freeThreshold = process.env.SHIPPING_FREE_THRESHOLD;
  if (freeThreshold && base === 0) return 0; // already free country

  const method = SHIPPING_METHODS.find((m) => m.id === methodId) || SHIPPING_METHODS[0];
  const cost = base * method.multiplier;
  return Math.round(cost * 100) / 100; // round to 2 dp
};

/**
 * Returns all available shipping methods with their computed costs for a country.
 * Checks the database first, then falls back to .env.
 */
export const getShippingMethods = async (country = '') => {
  const code = resolveCode(country);
  
  // Try database first
  const dbCountry = await getDbCountry(code);
  if (dbCountry) {
    const methods = dbCountry.methods.map((m) => ({
      id: m.methodId,
      label: m.label,
      description: m.description,
      cost: m.cost,
      isFree: m.cost === 0,
      displayCost: m.cost === 0 ? 'Free' : `$${m.cost.toFixed(2)}`,
    }));
    
    // If no methods configured, return base cost as standard
    if (methods.length === 0) {
      return [{
        id: 'standard',
        label: 'Standard Shipping',
        description: '5–10 business days',
        cost: dbCountry.baseCost,
        isFree: dbCountry.baseCost === 0,
        displayCost: dbCountry.baseCost === 0 ? 'Free' : `$${dbCountry.baseCost.toFixed(2)}`,
      }];
    }
    
    return methods;
  }

  // Fallback to .env-based calculation
  const base = await getBaseRate(code);

  return SHIPPING_METHODS.map((method) => {
    const cost = base === 0 ? 0 : Math.round(base * method.multiplier * 100) / 100;
    return {
      id: method.id,
      label: method.label,
      description: method.description,
      cost,
      isFree: cost === 0,
      displayCost: cost === 0 ? 'Free' : `$${cost.toFixed(2)}`,
    };
  });
};

/**
 * Returns a human-readable label for a shipping cost.
 */
export const getShippingLabel = (cost) => {
  return cost === 0 ? 'Free' : `$${cost.toFixed(2)}`;
};