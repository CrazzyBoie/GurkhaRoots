import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import prisma from '../config/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const productSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().min(1, 'Description is required'),
  category: z.string().min(1, 'Category is required'),
  price: z.coerce.number().positive('Price must be positive'),
  material: z.string().min(1, 'Material is required'),
  featured: z.coerce.boolean().default(false),
  newArrival: z.coerce.boolean().default(false),
  variants: z.array(z.object({
    size: z.string(),
    color: z.string(),
    colorHex: z.string(),
    stock: z.coerce.number().int().min(0),
  })).min(1, 'At least one variant is required'),
});

export const getProducts = async (req, res) => {
  try {
    const {
      category, size, color, minPrice, maxPrice,
      search, sort, featured, newArrival,
      page = 1, limit = 12,
    } = req.query;

    const where = {};
    if (category) where.category = { equals: category, mode: 'insensitive' };
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice);
      if (maxPrice) where.price.lte = parseFloat(maxPrice);
    }
    if (featured === 'true') where.featured = true;
    if (newArrival === 'true') where.newArrival = true;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    let variantFilter = {};
    if (size) variantFilter.size = size;
    if (color) variantFilter.color = { equals: color, mode: 'insensitive' };

    let orderBy = {};
    switch (sort) {
      case 'price_asc': orderBy = { price: 'asc' }; break;
      case 'price_desc': orderBy = { price: 'desc' }; break;
      default: orderBy = { createdAt: 'desc' };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          variants: {
            where: Object.keys(variantFilter).length > 0 ? variantFilter : undefined,
          },
          reviews: { select: { rating: true } },
        },
        orderBy,
        skip,
        take: parseInt(limit),
      }),
      prisma.product.count({ where }),
    ]);

    const productsWithRating = products.map(product => {
      const avgRating = product.reviews.length > 0
        ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length
        : 0;
      const { reviews, ...productData } = product;
      return { ...productData, rating: Math.round(avgRating * 10) / 10, reviewCount: product.reviews.length };
    });

    const filteredProducts = Object.keys(variantFilter).length > 0
      ? productsWithRating.filter(p => p.variants.length > 0)
      : productsWithRating;

    res.json({
      products: filteredProducts,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ message: 'Failed to get products' });
  }
};

export const getProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        variants: true,
        reviews: {
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const avgRating = product.reviews.length > 0
      ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length
      : 0;

    res.json({ ...product, rating: Math.round(avgRating * 10) / 10, reviewCount: product.reviews.length });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ message: 'Failed to get product' });
  }
};

export const createProduct = async (req, res) => {
  try {
    let body = { ...req.body };

    // 🔥 FIX: handle variants string
    if (typeof body.variants === 'string') {
      try {
        body.variants = JSON.parse(body.variants);
      } catch (e) {
        return res.status(400).json({ message: 'Invalid variants format' });
      }
    }

    const data = productSchema.parse(body);
    // Use local image URLs instead of Cloudinary
    const images = req.localImageUrls || [];

    const product = await prisma.product.create({
      data: {
        name: data.name,
        description: data.description,
        category: data.category,
        price: data.price,
        material: data.material,
        featured: data.featured,
        newArrival: data.newArrival,
        images,
        variants: { create: data.variants },
      },
      include: { variants: true },
    });

    res.status(201).json({ message: 'Product created successfully', product });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error('Create product error:', error);
    res.status(500).json({ message: 'Failed to create product' });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    let body = { ...req.body };

    // 🔥 FIX: handle variants string
    if (typeof body.variants === 'string') {
      try {
        body.variants = JSON.parse(body.variants);
      } catch (e) {
        return res.status(400).json({ message: 'Invalid variants format' });
      }
    }

    const data = productSchema.partial().parse(body);

    const existingProduct = await prisma.product.findUnique({ where: { id } });
    if (!existingProduct) return res.status(404).json({ message: 'Product not found' });

    // If new images uploaded locally, use them; otherwise keep existing
    const newImages = req.localImageUrls;
    const images = newImages && newImages.length > 0 ? newImages : undefined;

    // If replacing images, delete old local files
    if (images && existingProduct.images?.length > 0) {
      existingProduct.images.forEach(imgUrl => {
        try {
          const filename = path.basename(imgUrl);
          const filePath = path.join(__dirname, '..', '..', 'uploads', 'products', filename);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (e) {
          console.warn('Could not delete old image file:', e.message);
        }
      });
    }

    const updateData = {
      ...(data.name && { name: data.name }),
      ...(data.description && { description: data.description }),
      ...(data.category && { category: data.category }),
      ...(data.price && { price: data.price }),
      ...(data.material && { material: data.material }),
      ...(data.featured !== undefined && { featured: data.featured }),
      ...(data.newArrival !== undefined && { newArrival: data.newArrival }),
      ...(images && { images }),
    };

    if (data.variants) {
      await prisma.variant.deleteMany({ where: { productId: id } });
      await prisma.variant.createMany({
        data: data.variants.map(v => ({ ...v, productId: id })),
      });
    }

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
      include: { variants: true },
    });

    res.json({ message: 'Product updated successfully', product });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error('Update product error:', error);
    res.status(500).json({ message: 'Failed to update product' });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const existingProduct = await prisma.product.findUnique({ where: { id } });
    if (!existingProduct) return res.status(404).json({ message: 'Product not found' });

    // Delete local image files
    if (existingProduct.images?.length > 0) {
      existingProduct.images.forEach(imgUrl => {
        try {
          const filename = path.basename(imgUrl);
          const filePath = path.join(__dirname, '..', '..', 'uploads', 'products', filename);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (e) {
          console.warn('Could not delete image file:', e.message);
        }
      });
    }

    await prisma.product.delete({ where: { id } });
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ message: 'Failed to delete product' });
  }
};

export const bulkImport = async (req, res) => {
  try {
    const products = req.body.products;
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: 'Invalid products data' });
    }

    const results = { success: 0, failed: 0, errors: [] };

    for (const productData of products) {
      try {
        const validated = productSchema.parse(productData);
        await prisma.product.create({
          data: {
            name: validated.name,
            description: validated.description,
            category: validated.category,
            price: validated.price,
            material: validated.material,
            featured: validated.featured,
            newArrival: validated.newArrival,
            images: productData.images || [],
            variants: { create: validated.variants },
          },
        });
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({ product: productData.name || 'Unknown', error: error.message });
      }
    }

    res.json({ message: 'Bulk import completed', results });
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({ message: 'Failed to import products' });
  }
};

export const getCategories = async (req, res) => {
  try {
    const categories = await prisma.product.groupBy({
      by: ['category'],
      _count: { category: true },
    });
    res.json({ categories: categories.map(c => ({ name: c.category, count: c._count.category })) });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: 'Failed to get categories' });
  }
};
