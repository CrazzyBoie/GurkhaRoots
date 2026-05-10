# Gurkha Roots - E-Commerce Platform

A full-stack e-commerce web application for Gurkha Roots — a Nepali-Newzealand streetwear and casual fashion brand.

![Gurkha Roots](https://images.unsplash.com/photo-1556906781-9a412961c28c?w=1200)

## Features

### Customer Features
- Browse products with filters (category, size, color, price)
- Product detail pages with image gallery, size/color selection
- Shopping cart with persistent storage
- Secure checkout with Stripe integration
- Cash on Delivery option
- User authentication (email/password + Google OAuth)
- Order history and tracking
- Wishlist functionality
- Product reviews

### Admin Features
- Dashboard with sales analytics
- Product management (CRUD + bulk import)
- Order management with status updates
- Coupon management
- User management with role assignments
- Low stock alerts

## Tech Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **State Management**: Zustand
- **Routing**: React Router v6
- **HTTP Client**: Axios
- **Payments**: Stripe Elements

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT + Google OAuth (Passport.js)
- **Payments**: Stripe
- **Image Storage**: Cloudinary
- **Email**: Nodemailer

## Project Structure

```
gurkha-roots/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Page components
│   │   ├── stores/         # Zustand stores
│   │   ├── services/       # API services
│   │   └── types/          # TypeScript types
│   └── package.json
├── server/                 # Node.js backend
│   ├── src/
│   │   ├── controllers/    # Route controllers
│   │   ├── routes/         # API routes
│   │   ├── middleware/     # Auth, upload middleware
│   │   ├── services/       # Email service
│   │   └── config/         # Database config
│   ├── prisma/
│   │   └── schema.prisma   # Database schema
│   └── package.json
└── README.md
```

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Stripe account
- Cloudinary account
- Google OAuth credentials

### Frontend Setup

1. Navigate to client directory:
   ```bash
   cd client
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env.local`:
   ```
   VITE_API_URL=http://localhost:5000/api
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
   VITE_GOOGLE_CLIENT_ID=...
   ```

4. Start development server:
   ```bash
   npm run dev
   ```

### Backend Setup

1. Navigate to server directory:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env`:
   ```
   DATABASE_URL="postgresql://user:password@localhost:5432/gurkha_roots"
   JWT_ACCESS_SECRET="..."
   JWT_REFRESH_SECRET="..."
   GOOGLE_CLIENT_ID="..."
   GOOGLE_CLIENT_SECRET="..."
   CLOUDINARY_CLOUD_NAME="..."
   CLOUDINARY_API_KEY="..."
   CLOUDINARY_API_SECRET="..."
   STRIPE_SECRET_KEY="sk_test_..."
   STRIPE_WEBHOOK_SECRET="whsec_..."
   SMTP_HOST="smtp.gmail.com"
   SMTP_USER="..."
   SMTP_PASS="..."
   ADMIN_EMAIL="admin@gurkharoots.com"
   CLIENT_URL="http://localhost:5173"
   PORT=5000
   ```

4. Run database migrations:
   ```bash
   npx prisma migrate dev
   ```

5. Start the server:
   ```bash
   npm run dev
   ```

## Brand Identity

- **Brand Name**: Gurkha Roots
- **Tagline**: "Roots Run Deep"
- **Color Palette**:
  - Deep Charcoal: `#1a1a1a`
  - Off-White: `#f5f5f0`
  - Warm Grey: `#888`
  - Accent Gold: `#c8a96e`
- **Typography**:
  - Headings: Bebas Neue
  - Body: Inter

## API Documentation

See [server/README.md](server/README.md) for detailed API documentation.

## Deployment

### Frontend (Vercel)
1. Connect GitHub repo to Vercel
2. Set environment variables
3. Deploy

### Backend (Railway/Render)
1. Connect GitHub repo
2. Add PostgreSQL database
3. Set environment variables
4. Deploy

## License

MIT License - see LICENSE file for details.

---

Built with ❤️ for Gurkha Roots
