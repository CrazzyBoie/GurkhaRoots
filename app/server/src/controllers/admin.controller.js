import prisma from '../config/prisma.js';

export const getStats = async (req, res) => {
  try {
    const [
      totalRevenue,
      totalOrders,
      totalProducts,
      totalUsers,
      pendingOrders,
      lowStockCount,
    ] = await Promise.all([
      prisma.order.aggregate({
        where: {
          status: {
            notIn: ['CANCELLED'],
          },
        },
        _sum: {
          total: true,
        },
      }),
      prisma.order.count(),
      prisma.product.count(),
      prisma.user.count(),
      prisma.order.count({
        where: { status: 'PENDING' },
      }),
      prisma.variant.count({
        where: { stock: { lt: 5 } },
      }),
    ]);

    res.json({
      stats: {
        totalRevenue: totalRevenue._sum.total || 0,
        totalOrders,
        totalProducts,
        totalUsers,
        pendingOrders,
        lowStockCount,
      },
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Failed to get stats' });
  }
};

export const getSalesChart = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: startDate,
        },
        status: {
          notIn: ['CANCELLED'],
        },
      },
      select: {
        createdAt: true,
        total: true,
      },
    });

    const salesByDate = {};
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      salesByDate[dateStr] = 0;
    }

    orders.forEach(order => {
      const dateStr = order.createdAt.toISOString().split('T')[0];
      if (salesByDate[dateStr] !== undefined) {
        salesByDate[dateStr] += order.total;
      }
    });

    const chartData = Object.entries(salesByDate)
      .map(([date, sales]) => ({
        date,
        sales: Math.round(sales * 100) / 100,
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({ chartData });
  } catch (error) {
    console.error('Get sales chart error:', error);
    res.status(500).json({ message: 'Failed to get sales chart' });
  }
};

export const getLowStock = async (req, res) => {
  try {
    const variants = await prisma.variant.findMany({
      where: {
        stock: {
          lt: 5,
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            images: true,
          },
        },
      },
      orderBy: {
        stock: 'asc',
      },
    });

    res.json({ variants });
  } catch (error) {
    console.error('Get low stock error:', error);
    res.status(500).json({ message: 'Failed to get low stock items' });
  }
};

export const getRecentOrders = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const orders = await prisma.order.findMany({
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        items: {
          select: {
            name: true,
            quantity: true,
          },
        },
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    res.json({ orders });
  } catch (error) {
    console.error('Get recent orders error:', error);
    res.status(500).json({ message: 'Failed to get recent orders' });
  }
};

export const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const validRoles = ['customer', 'inventory_manager', 'super_admin'];
    
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (id === req.user.id) {
      return res.status(400).json({ message: 'Cannot change your own role' });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    res.json({
      message: 'User role updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ message: 'Failed to update user role' });
  }
};
