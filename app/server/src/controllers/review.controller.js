import { z } from 'zod';
import prisma from '../config/prisma.js';

const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().min(1, 'Comment is required'),
});

export const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reviews, total, stats] = await Promise.all([
      prisma.review.findMany({
        where: { productId },
        include: {
          user: {
            select: { name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.review.count({ where: { productId } }),
      prisma.review.groupBy({
        by: ['rating'],
        where: { productId },
        _count: {
          rating: true,
        },
      }),
    ]);

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalRating = 0;

    stats.forEach(stat => {
      distribution[stat.rating] = stat._count.rating;
      totalRating += stat.rating * stat._count.rating;
    });

    const averageRating = total > 0 ? totalRating / total : 0;

    res.json({
      reviews,
      stats: {
        average: Math.round(averageRating * 10) / 10,
        total,
        distribution,
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get product reviews error:', error);
    res.status(500).json({ message: 'Failed to get reviews' });
  }
};

export const createReview = async (req, res) => {
  try {
    const { productId } = req.params;
    const data = reviewSchema.parse(req.body);
    const userId = req.user.id;

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const existingReview = await prisma.review.findUnique({
      where: {
        productId_userId: {
          productId,
          userId,
        },
      },
    });

    if (existingReview) {
      return res.status(400).json({ message: 'You have already reviewed this product' });
    }

    const hasPurchased = await prisma.order.findFirst({
      where: {
        userId,
        items: {
          some: {
            productId,
          },
        },
        status: {
          in: ['DELIVERED'],
        },
      },
    });

    const review = await prisma.review.create({
      data: {
        productId,
        userId,
        rating: data.rating,
        comment: data.comment,
      },
      include: {
        user: {
          select: { name: true },
        },
      },
    });

    res.status(201).json({
      message: 'Review submitted successfully',
      review,
      verifiedPurchase: !!hasPurchased,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error('Create review error:', error);
    res.status(500).json({ message: 'Failed to create review' });
  }
};

export const updateReview = async (req, res) => {
  try {
    const { id } = req.params;
    const data = reviewSchema.partial().parse(req.body);
    const userId = req.user.id;

    const review = await prisma.review.findUnique({
      where: { id },
    });

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (review.userId !== userId) {
      return res.status(403).json({ message: 'You can only edit your own reviews' });
    }

    const updatedReview = await prisma.review.update({
      where: { id },
      data,
      include: {
        user: {
          select: { name: true },
        },
      },
    });

    res.json({
      message: 'Review updated successfully',
      review: updatedReview,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error('Update review error:', error);
    res.status(500).json({ message: 'Failed to update review' });
  }
};

export const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const review = await prisma.review.findUnique({
      where: { id },
    });

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (review.userId !== userId && userRole !== 'super_admin') {
      return res.status(403).json({ message: 'You can only delete your own reviews' });
    }

    await prisma.review.delete({
      where: { id },
    });

    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ message: 'Failed to delete review' });
  }
};
