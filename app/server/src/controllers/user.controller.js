import { z } from 'zod';
import bcrypt from 'bcryptjs';
import prisma from '../config/prisma.js';

const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  email: z.string().email('Invalid email').optional(),
  phone: z.string().optional(),
});

const addressSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  phone: z.string().min(1, 'Phone is required'),
  line1: z.string().min(1, 'Address line 1 is required'),
  line2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  country: z.string().min(1, 'Country is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  isDefault: z.coerce.boolean().default(false),
});

export const getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Failed to get profile' });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const data = updateProfileSchema.parse(req.body);

    if (data.email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email: data.email,
          NOT: { id: req.user.id },
        },
      });

      if (existingUser) {
        return res.status(400).json({ message: 'Email already in use' });
      }
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });

    res.json({
      message: 'Profile updated successfully',
      user,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Failed to update profile' });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'Current password and new password (min 6 chars) required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user.passwordHash) {
      return res.status(400).json({ message: 'Cannot change password for social login accounts' });
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!isValid) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash: newPasswordHash },
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Failed to change password' });
  }
};

export const getAddresses = async (req, res) => {
  try {
    const addresses = await prisma.address.findMany({
      where: { userId: req.user.id },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    res.json({ addresses });
  } catch (error) {
    console.error('Get addresses error:', error);
    res.status(500).json({ message: 'Failed to get addresses' });
  }
};

export const addAddress = async (req, res) => {
  try {
    const data = addressSchema.parse(req.body);

    if (data.isDefault) {
      await prisma.address.updateMany({
        where: { userId: req.user.id },
        data: { isDefault: false },
      });
    }

    const address = await prisma.address.create({
      data: {
        userId: req.user.id,
        ...data,
      },
    });

    res.status(201).json({
      message: 'Address added successfully',
      address,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error('Add address error:', error);
    res.status(500).json({ message: 'Failed to add address' });
  }
};

export const updateAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const data = addressSchema.partial().parse(req.body);

    const existingAddress = await prisma.address.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!existingAddress) {
      return res.status(404).json({ message: 'Address not found' });
    }

    if (data.isDefault) {
      await prisma.address.updateMany({
        where: { userId: req.user.id, NOT: { id } },
        data: { isDefault: false },
      });
    }

    const address = await prisma.address.update({
      where: { id },
      data,
    });

    res.json({
      message: 'Address updated successfully',
      address,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error('Update address error:', error);
    res.status(500).json({ message: 'Failed to update address' });
  }
};

export const deleteAddress = async (req, res) => {
  try {
    const { id } = req.params;

    const existingAddress = await prisma.address.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!existingAddress) {
      return res.status(404).json({ message: 'Address not found' });
    }

    await prisma.address.delete({
      where: { id },
    });

    res.json({ message: 'Address deleted successfully' });
  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({ message: 'Failed to delete address' });
  }
};

export const getWishlist = async (req, res) => {
  try {
    const wishlist = await prisma.wishlist.findMany({
      where: { userId: req.user.id },
      include: {
        product: {
          include: {
            variants: {
              select: {
                size: true,
                color: true,
                colorHex: true,
                stock: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ wishlist });
  } catch (error) {
    console.error('Get wishlist error:', error);
    res.status(500).json({ message: 'Failed to get wishlist' });
  }
};

export const addToWishlist = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const existing = await prisma.wishlist.findUnique({
      where: {
        userId_productId: {
          userId: req.user.id,
          productId,
        },
      },
    });

    if (existing) {
      return res.status(400).json({ message: 'Product already in wishlist' });
    }

    const wishlistItem = await prisma.wishlist.create({
      data: {
        userId: req.user.id,
        productId,
      },
      include: {
        product: {
          include: {
            variants: {
              select: {
                size: true,
                color: true,
                colorHex: true,
                stock: true,
              },
            },
          },
        },
      },
    });

    res.status(201).json({
      message: 'Added to wishlist',
      wishlistItem,
    });
  } catch (error) {
    console.error('Add to wishlist error:', error);
    res.status(500).json({ message: 'Failed to add to wishlist' });
  }
};

export const removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.params;

    const existing = await prisma.wishlist.findUnique({
      where: {
        userId_productId: {
          userId: req.user.id,
          productId,
        },
      },
    });

    if (!existing) {
      return res.status(404).json({ message: 'Product not in wishlist' });
    }

    await prisma.wishlist.delete({
      where: {
        userId_productId: {
          userId: req.user.id,
          productId,
        },
      },
    });

    res.json({ message: 'Removed from wishlist' });
  } catch (error) {
    console.error('Remove from wishlist error:', error);
    res.status(500).json({ message: 'Failed to remove from wishlist' });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const { search, role, page = 1, limit = 20 } = req.query;

    const where = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (role) {
      where.role = role;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          createdAt: true,
          _count: {
            select: {
              orders: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ message: 'Failed to get users' });
  }
};

export const updateUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, role } = req.body;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (id === req.user.id) {
      return res.status(400).json({ message: 'Use your profile page to edit your own account' });
    }

    if (email && email !== user.email) {
      const existing = await prisma.user.findFirst({
        where: { email, NOT: { id } },
      });
      if (existing) {
        return res.status(400).json({ message: 'Email already in use' });
      }
    }

    const validRoles = ['customer', 'inventory_manager', 'super_admin'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(phone !== undefined && { phone }),
        ...(role && { role }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
    });

    res.json({ message: 'User updated successfully', user: updated });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Failed to update user' });
  }
};

export const deleteUserById = async (req, res) => {
  try {
    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await prisma.user.delete({ where: { id } });
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Failed to delete user' });
  }
};

export const adminSetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (id === req.user.id) {
      return res.status(400).json({ message: 'Use your profile page to change your own password' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id },
      data: { passwordHash, refreshToken: null },
    });

    res.json({ message: `Password updated successfully for ${user.name}` });
  } catch (error) {
    console.error('Admin set password error:', error);
    res.status(500).json({ message: 'Failed to set password' });
  }
};
export const adminCreateUser = async (req, res) => {
  try {
    const { name, email, phone, role, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const validRoles = ['customer', 'inventory_manager', 'super_admin'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: 'A user with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone: phone || null,
        role: role || 'customer',
        passwordHash,
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    res.status(201).json({ message: 'User created successfully', user });
  } catch (error) {
    console.error('Admin create user error:', error);
    res.status(500).json({ message: 'Failed to create user' });
  }
};