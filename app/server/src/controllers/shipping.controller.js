import prisma from '../config/prisma.js';

// ── Public helpers ─────────────────────────────────────────────────────────────

/**
 * Resolve a country name or ISO code to a ShippingCountry row.
 * Falls back to env-based rates if no DB row found (backward compat).
 */
const resolveCountry = async (countryInput = '') => {
  const normalized = countryInput.trim();
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

// ── Public endpoints ───────────────────────────────────────────────────────────

/** GET /api/shipping/cost?country=New Zealand&method=express */
export const getShippingCost = async (req, res) => {
  try {
    const { country, method = 'standard' } = req.query;
    if (!country) return res.status(400).json({ message: 'Country is required' });

    const row = await resolveCountry(country);

    let cost = 0;
    if (row) {
      const methodRow = row.methods.find((m) => m.methodId === method);
      cost = methodRow ? methodRow.cost : row.baseCost;
    } else {
      // Env fallback
      const code = country.trim().toUpperCase();
      const envRate = process.env[`SHIPPING_RATE_${code}`] ?? process.env.SHIPPING_RATE_DEFAULT ?? '0';
      cost = parseFloat(envRate);
    }

    res.json({
      country,
      method,
      cost,
      label: cost === 0 ? 'Free' : `$${cost.toFixed(2)}`,
    });
  } catch (err) {
    console.error('getShippingCost error:', err);
    res.status(500).json({ message: 'Failed to get shipping cost' });
  }
};

/** GET /api/shipping/methods?country=New Zealand */
export const getShippingMethods = async (req, res) => {
  try {
    const { country } = req.query;
    if (!country) return res.status(400).json({ message: 'Country is required' });

    const row = await resolveCountry(country);

    if (!row) {
      // Env fallback — return a single standard option
      const code = country.trim().toUpperCase();
      const envRate = process.env[`SHIPPING_RATE_${code}`] ?? process.env.SHIPPING_RATE_DEFAULT ?? '0';
      const cost = parseFloat(envRate);
      return res.json({
        country,
        methods: [{
          id: 'standard',
          label: 'Standard Shipping',
          description: '5–10 business days',
          cost,
          isFree: cost === 0,
          displayCost: cost === 0 ? 'Free' : `$${cost.toFixed(2)}`,
        }],
      });
    }

    const methods = row.methods.map((m) => ({
      id: m.methodId,
      label: m.label,
      description: m.description,
      cost: m.cost,
      isFree: m.cost === 0,
      displayCost: m.cost === 0 ? 'Free' : `$${m.cost.toFixed(2)}`,
    }));

    res.json({ country, methods });
  } catch (err) {
    console.error('getShippingMethods error:', err);
    res.status(500).json({ message: 'Failed to get shipping methods' });
  }
};

// ── Admin: Countries ───────────────────────────────────────────────────────────

/** GET /api/admin/shipping/countries */
export const getCountries = async (req, res) => {
  try {
    const countries = await prisma.shippingCountry.findMany({
      orderBy: { name: 'asc' },
      include: { methods: { orderBy: { methodId: 'asc' } } },
    });
    res.json({ countries });
  } catch (err) {
    console.error('getCountries error:', err);
    res.status(500).json({ message: 'Failed to get shipping countries' });
  }
};

/** POST /api/admin/shipping/countries */
export const createCountry = async (req, res) => {
  try {
    const { name, code, baseCost = 0, freeThreshold, currency = 'NZD', active = true } = req.body;

    if (!name?.trim() || !code?.trim()) {
      return res.status(400).json({ message: 'Name and code are required' });
    }

    const existing = await prisma.shippingCountry.findUnique({
      where: { code: code.trim().toUpperCase() },
    });
    if (existing) {
      return res.status(400).json({ message: `Country code ${code.toUpperCase()} already exists` });
    }

    const country = await prisma.shippingCountry.create({
      data: {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        baseCost: parseFloat(baseCost) || 0,
        freeThreshold: freeThreshold != null ? parseFloat(freeThreshold) : null,
        currency: currency.trim().toUpperCase(),
        active,
        // Auto-seed the three standard method tiers based on baseCost
        methods: {
          create: [
            { methodId: 'standard', label: 'Standard Shipping', description: '5–10 business days', cost: parseFloat(baseCost) || 0 },
            { methodId: 'express',  label: 'Express Shipping',  description: '2–4 business days',  cost: Math.round((parseFloat(baseCost) || 0) * 1.8 * 100) / 100 },
            { methodId: 'overnight',label: 'Overnight Shipping',description: 'Next business day',  cost: Math.round((parseFloat(baseCost) || 0) * 3.0 * 100) / 100 },
          ],
        },
      },
      include: { methods: true },
    });

    res.status(201).json({ message: 'Country added', country });
  } catch (err) {
    console.error('createCountry error:', err);
    res.status(500).json({ message: 'Failed to add country' });
  }
};

/** PATCH /api/admin/shipping/countries/:id */
export const updateCountry = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, baseCost, freeThreshold, currency, active } = req.body;

    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (baseCost !== undefined) data.baseCost = parseFloat(baseCost);
    if (freeThreshold !== undefined) data.freeThreshold = freeThreshold === '' || freeThreshold === null ? null : parseFloat(freeThreshold);
    if (currency !== undefined) data.currency = currency.trim().toUpperCase();
    if (active !== undefined) data.active = active;

    const country = await prisma.shippingCountry.update({
      where: { id },
      data,
      include: { methods: true },
    });
    res.json({ message: 'Country updated', country });
  } catch (err) {
    console.error('updateCountry error:', err);
    res.status(500).json({ message: 'Failed to update country' });
  }
};

/** DELETE /api/admin/shipping/countries/:id */
export const deleteCountry = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.shippingCountry.delete({ where: { id } });
    res.json({ message: 'Country deleted' });
  } catch (err) {
    console.error('deleteCountry error:', err);
    res.status(500).json({ message: 'Failed to delete country' });
  }
};

// ── Admin: Methods ─────────────────────────────────────────────────────────────

/** GET /api/admin/shipping/methods */
export const getAdminMethods = async (req, res) => {
  try {
    const methods = await prisma.shippingMethod.findMany({
      orderBy: [{ country: { name: 'asc' } }, { methodId: 'asc' }],
      include: { country: { select: { name: true, code: true } } },
    });
    res.json({ methods });
  } catch (err) {
    console.error('getAdminMethods error:', err);
    res.status(500).json({ message: 'Failed to get shipping methods' });
  }
};

/** PATCH /api/admin/shipping/methods/:id */
export const updateMethod = async (req, res) => {
  try {
    const { id } = req.params;
    const { label, description, cost, active } = req.body;

    const data = {};
    if (label !== undefined) data.label = label.trim();
    if (description !== undefined) data.description = description.trim();
    if (cost !== undefined) data.cost = parseFloat(cost);
    if (active !== undefined) data.active = active;

    const method = await prisma.shippingMethod.update({
      where: { id },
      data,
      include: { country: { select: { name: true, code: true } } },
    });
    res.json({ message: 'Method updated', method });
  } catch (err) {
    console.error('updateMethod error:', err);
    res.status(500).json({ message: 'Failed to update method' });
  }
};