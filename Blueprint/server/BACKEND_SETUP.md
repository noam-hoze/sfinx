# Backend Setup Guide

This guide will help you set up the backend for Sfinx using Neon, Prisma, and NextAuth.js.

## 🚀 Prerequisites

-   Node.js 18+
-   pnpm (package manager)
-   A Neon account (https://neon.tech)

## 📋 Setup Steps

### 1. Create Neon Database

1. Go to [neon.tech](https://neon.tech) and create an account
2. Create a new project
3. Copy the connection string from your dashboard (it should look like):
    ```
    postgresql://username:password@hostname/database?sslmode=require
    ```

### 2. Environment Variables

Create a `.env` file in the root of your project:

```env
# Database - Get this from your Neon dashboard
DATABASE_URL="postgresql://username:password@hostname/database?sslmode=require"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"

# Google OAuth (optional)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
```

### 3. Database Migration

Run the Prisma migration to create your database tables:

```bash
# Generate Prisma client
npx prisma generate

# Push the schema to your database
npx prisma db push

# (Optional) Seed the database with initial data
npx prisma db seed
```

### 4. Start the Development Server

```bash
pnpm dev
```

## 🔧 Available Features

### Authentication

-   ✅ User registration (`/signup`)
-   ✅ User login (`/login`)
-   ✅ Password hashing with bcrypt
-   ✅ Session management with NextAuth.js

### Database Schema

-   ✅ Users table with authentication fields
-   ✅ NextAuth.js tables (accounts, sessions, verification tokens)
-   ✅ Role-based access control support

### API Routes

-   `POST /api/auth/signup` - User registration
-   `POST /api/auth/[...nextauth]` - NextAuth.js routes

## 🧪 Testing the Backend

1. Visit `http://localhost:3000/signup` to create an account
2. Visit `http://localhost:3000/login` to sign in
3. Check your Neon dashboard to see the created records

## 📁 Project Structure

```
├── prisma/
│   └── schema.prisma          # Database schema
├── lib/
│   ├── auth.ts               # NextAuth configuration
│   └── prisma.ts             # Prisma client
├── app/
│   ├── api/auth/
│   │   ├── [...nextauth]/
│   │   │   └── route.ts      # NextAuth API routes
│   │   └── signup/
│   │       └── route.ts      # User registration
│   ├── login/
│   │   └── page.tsx          # Login page
│   └── signup/
│       └── page.tsx          # Signup page
└── .env                      # Environment variables
```

## 🔒 Security Features

-   Password hashing with bcrypt
-   JWT-based authentication
-   Secure session management
-   TypeScript for type safety

## 🚀 Deployment

When deploying to Vercel:

1. Add your environment variables in Vercel dashboard
2. Update `NEXTAUTH_URL` to your production domain
3. The database migrations will run automatically

## 🐛 Troubleshooting

### Common Issues

1. **"Can't reach database server"**

    - Check your DATABASE_URL in `.env`
    - Make sure your Neon database is running
    - Verify SSL mode is set to `require`

2. **"Prisma client not found"**

    - Run `npx prisma generate`
    - Restart your development server

3. **NextAuth session not working**
    - Check NEXTAUTH_SECRET is set
    - Verify NEXTAUTH_URL matches your domain

### Useful Commands

```bash
# View database in Prisma Studio
npx prisma studio

# Reset database (development only)
npx prisma migrate reset

# Check database connection
npx prisma db push --preview-feature
```

## 📚 Additional Resources

-   [Neon Documentation](https://neon.tech/docs)
-   [Prisma Documentation](https://www.prisma.io/docs)
-   [NextAuth.js Documentation](https://next-auth.js.org)

---

🎉 Your backend is now ready! The authentication system is fully functional with secure password hashing, session management, and a beautiful UI.
