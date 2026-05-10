# Gurkha Roots - Backend API

## Overview
This is the backend API server for Gurkha Roots e-commerce platform built with Node.js, Express, and PostgreSQL.

## Tech Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT + Google OAuth (Passport.js)
- **Payments**: Stripe
- **Image Storage**: Cloudinary
- **Email**: Nodemailer

## Project Structure
```
server/
├── src/
│   ├── config/         # Database and Passport config
│   ├── controllers/    # Route controllers
│   ├── middleware/     # Auth, upload middleware
│   ├── routes/         # API routes
│   ├── services/       # Email service
│   ├── utils/          # JWT utilities
│   └── index.js        # Entry point
├── prisma/
│   └── schema.prisma   # Database schema
└── .env                # Environment variables
```

## Setup Instructions

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   Copy `.env` and fill in your values:
   ```bash
   DATABASE_URL="postgresql://user:password@localhost:5432/gurkha_roots"
   JWT_ACCESS_SECRET="your-secret-key"
   JWT_REFRESH_SECRET="your-refresh-secret"
   GOOGLE_CLIENT_ID="your-google-client-id"
   GOOGLE_CLIENT_SECRET="your-google-secret"
   CLOUDINARY_CLOUD_NAME="your-cloud-name"
   CLOUDINARY_API_KEY="your-api-key"
   CLOUDINARY_API_SECRET="your-api-secret"
   STRIPE_SECRET_KEY="sk_test_your_key"
   SMTP_HOST="smtp.gmail.com"
   SMTP_USER="your-email@gmail.com"
   SMTP_PASS="your-app-password"
   ```

3. **Run database migrations**:
   ```bash
   npx prisma migrate dev
   ```

4. **Start the server**:
   ```bash
   npm run dev
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/google` - Google OAuth login
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password

### Products
- `GET /api/products` - Get all products (with filters)
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Create product (admin)
- `PUT /api/products/:id` - Update product (admin)
- `DELETE /api/products/:id` - Delete product (admin)

### Orders
- `POST /api/orders` - Create order
- `GET /api/orders/my` - Get user's orders
- `GET /api/orders/:id` - Get order details
- `GET /api/orders` - Get all orders (admin)
- `PATCH /api/orders/:id/status` - Update order status (admin)

### Users
- `GET /api/users/me` - Get current user
- `PUT /api/users/me` - Update profile
- `GET /api/users/me/addresses` - Get addresses
- `POST /api/users/me/addresses` - Add address
- `GET /api/users/me/wishlist` - Get wishlist

### Payments
- `POST /api/payments/create-intent` - Create Stripe payment intent
- `POST /api/payments/webhook` - Stripe webhook handler

## Database Schema

The database includes models for:
- **User**: Customer accounts with roles
- **Product**: Products with variants
- **Variant**: Size/color combinations with stock
- **Order**: Orders with items and shipping
- **Address**: User shipping addresses
- **Coupon**: Discount codes
- **Review**: Product reviews
- **Wishlist**: User wishlist items

## License
MIT
