import { z } from 'zod';
import prisma from '../config/prisma.js';
import { sendOrderConfirmation, sendOrderStatusUpdate, sendAdminOrderNotification } from '../services/email.service.js';

const orderSchema = z.object({
  items: z.array(z.object({
    productId: z.string(),
    variantId: z.string(),
    quantity: z.coerce.number().int().min(1),
  })).min(1, 'At least one item is required'),
  addressId: z.string().optional(),
  shippingAddress: z.object({
    fullName: z.string(),
    phone: z.string(),
    line1: z.string(),
    line2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    country: z.string(),
    postalCode: z.string(),
  }).optional(),
  paymentMethod: z.enum(['stripe', 'cod']),
  couponCode: z.string().optional(),
  giftWrap: z.coerce.boolean().default(false),
  giftNote: z.string().optional(),
});

const generateOrderNumber = () => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `GR-${dateStr}-${random}`;
};

export const createOrder = async (req, res) => {
  try {
    const data = orderSchema.parse(req.body);
    const userId = req.user?.id;

    let subtotal = 0;
    const orderItems = [];

    for (const item of data.items) {
      const variant = await prisma.variant.findUnique({
        where: { id: item.variantId },
        include: { product: true },
      });

      if (!variant) {
        return res.status(400).json({ message: `Variant not found: ${item.variantId}` });
      }

      if (variant.stock < item.quantity) {
        return res.status(400).json({ 
          message: `Insufficient stock for ${variant.product.name} (${variant.size}, ${variant.color})` 
        });
      }

      const itemTotal = variant.product.price * item.quantity;
      subtotal += itemTotal;

      orderItems.push({
        productId: variant.product.id,
        name: variant.product.name,
        image: variant.product.images[0] || '',
        size: variant.size,
        color: variant.color,
        quantity: item.quantity,
        price: variant.product.price,
      });
    }

    let discount = 0;
    if (data.couponCode) {
      const coupon = await prisma.coupon.findUnique({
        where: { code: data.couponCode.toUpperCase() },
      });

      if (coupon && coupon.active && coupon.usedCount < coupon.usageLimit && new Date(coupon.expiryDate) > new Date()) {
        if (coupon.type === 'percentage') {
          discount = subtotal * (coupon.value / 100);
        } else {
          discount = coupon.value;
        }

        await prisma.coupon.update({
          where: { id: coupon.id },
          data: { usedCount: { increment: 1 } },
        });
      }
    }

    const total = Math.max(0, subtotal - discount);

    let addressId = data.addressId;
    let shippingSnap;

    if (userId && addressId) {
      const address = await prisma.address.findUnique({
        where: { id: addressId },
      });

      if (!address || address.userId !== userId) {
        return res.status(400).json({ message: 'Invalid address' });
      }

      shippingSnap = {
        fullName: address.fullName,
        phone: address.phone,
        line1: address.line1,
        line2: address.line2,
        city: address.city,
        state: address.state,
        country: address.country,
        postalCode: address.postalCode,
      };
    } else if (data.shippingAddress) {
      shippingSnap = data.shippingAddress;

      if (userId) {
        const newAddress = await prisma.address.create({
          data: {
            userId,
            ...data.shippingAddress,
            isDefault: false,
          },
        });
        addressId = newAddress.id;
      }
    } else {
      return res.status(400).json({ message: 'Shipping address is required' });
    }

    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId,
        guestEmail: userId ? null : data.shippingAddress?.fullName,
        addressId,
        shippingSnap,
        paymentMethod: data.paymentMethod,
        total,
        couponCode: data.couponCode?.toUpperCase(),
        discount,
        giftWrap: data.giftWrap,
        giftNote: data.giftNote,
        items: {
          create: orderItems,
        },
      },
      include: {
        items: true,
        user: {
          select: { name: true, email: true },
        },
      },
    });

    for (const item of data.items) {
      await prisma.variant.update({
        where: { id: item.variantId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    const user = order.user || { name: shippingSnap.fullName, email: null };
    
    sendOrderConfirmation(order, user, order.items).catch(console.error);
    sendAdminOrderNotification(order, user, order.items).catch(console.error);

    res.status(201).json({
      message: 'Order created successfully',
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        total: order.total,
        status: order.status,
        createdAt: order.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error('Create order error:', error);
    res.status(500).json({ message: 'Failed to create order' });
  }
};

export const getMyOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { userId },
        include: {
          items: {
            select: {
              id: true,
              name: true,
              image: true,
              size: true,
              color: true,
              quantity: true,
              price: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.order.count({ where: { userId } }),
    ]);

    res.json({
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get my orders error:', error);
    res.status(500).json({ message: 'Failed to get orders' });
  }
};

export const getOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        user: {
          select: { name: true, email: true, phone: true },
        },
        address: true,
      },
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.userId && order.userId !== userId && req.user?.role !== 'super_admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ order });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ message: 'Failed to get order' });
  }
};

export const getAllOrders = async (req, res) => {
  try {
    const { status, search, startDate, endDate, page = 1, limit = 20 } = req.query;

    const where = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: {
            select: {
              id: true,
              name: true,
              image: true,
              quantity: true,
              price: true,
            },
          },
          user: {
            select: { name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({ message: 'Failed to get orders' });
  }
};

export const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: {
          select: { name: true, email: true },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status },
    });

    if (order.user && order.user.email) {
      sendOrderStatusUpdate(updatedOrder, order.user).catch(console.error);
    }

    res.json({
      message: 'Order status updated',
      order: updatedOrder,
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ message: 'Failed to update status' });
  }
};
