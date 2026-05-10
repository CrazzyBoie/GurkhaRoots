import { z } from 'zod';
import prisma from '../config/prisma.js';

const couponSchema = z.object({
  code: z.string().min(3, 'Code must be at least 3 characters'),
  type: z.enum(['percentage', 'fixed']),
  value: z.coerce.number().positive('Value must be positive'),
  usageLimit: z.coerce.number().int().min(1, 'Usage limit must be at least 1'),
  expiryDate: z.string().datetime(),
  active: z.coerce.boolean().default(true),
});

export const validateCoupon = async (req, res) => {
  try {
    const { code, cartTotal } = req.body;

    if (!code) {
      return res.status(400).json({ message: 'Coupon code is required' });
    }

    const coupon = await prisma.coupon.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!coupon) {
      return res.status(400).json({ message: 'Invalid coupon code' });
    }

    if (!coupon.active) {
      return res.status(400).json({ message: 'This coupon is no longer active' });
    }

    if (coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({ message: 'This coupon has reached its usage limit' });
    }

    if (new Date(coupon.expiryDate) < new Date()) {
      return res.status(400).json({ message: 'This coupon has expired' });
    }

    let discount = 0;
    if (coupon.type === 'percentage') {
      discount = (cartTotal || 0) * (coupon.value / 100);
    } else {
      discount = coupon.value;
    }

    res.json({
      valid: true,
      coupon: {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
      },
      discount: Math.round(discount * 100) / 100,
    });
  } catch (error) {
    console.error('Validate coupon error:', error);
    res.status(500).json({ message: 'Failed to validate coupon' });
  }
};

export const getCoupons = async (req, res) => {
  try {
    const { active, page = 1, limit = 20 } = req.query;

    const where = {};

    if (active !== undefined) {
      where.active = active === 'true';
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [coupons, total] = await Promise.all([
      prisma.coupon.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.coupon.count({ where }),
    ]);

    res.json({
      coupons,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get coupons error:', error);
    res.status(500).json({ message: 'Failed to get coupons' });
  }
};

export const createCoupon = async (req, res) => {
  try {
    const data = couponSchema.parse(req.body);

    const existing = await prisma.coupon.findUnique({
      where: { code: data.code.toUpperCase() },
    });

    if (existing) {
      return res.status(400).json({ message: 'Coupon code already exists' });
    }

    const coupon = await prisma.coupon.create({
      data: {
        ...data,
        code: data.code.toUpperCase(),
      },
    });

    res.status(201).json({
      message: 'Coupon created successfully',
      coupon,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error('Create coupon error:', error);
    res.status(500).json({ message: 'Failed to create coupon' });
  }
};

export const updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const data = couponSchema.partial().parse(req.body);

    const existingCoupon = await prisma.coupon.findUnique({
      where: { id },
    });

    if (!existingCoupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    if (data.code && data.code.toUpperCase() !== existingCoupon.code) {
      const existing = await prisma.coupon.findUnique({
        where: { code: data.code.toUpperCase() },
      });

      if (existing) {
        return res.status(400).json({ message: 'Coupon code already exists' });
      }
    }

    const coupon = await prisma.coupon.update({
      where: { id },
      data: {
        ...data,
        ...(data.code && { code: data.code.toUpperCase() }),
      },
    });

    res.json({
      message: 'Coupon updated successfully',
      coupon,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error('Update coupon error:', error);
    res.status(500).json({ message: 'Failed to update coupon' });
  }
};

export const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    const existingCoupon = await prisma.coupon.findUnique({
      where: { id },
    });

    if (!existingCoupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    await prisma.coupon.delete({
      where: { id },
    });

    res.json({ message: 'Coupon deleted successfully' });
  } catch (error) {
    console.error('Delete coupon error:', error);
    res.status(500).json({ message: 'Failed to delete coupon' });
  }
};
