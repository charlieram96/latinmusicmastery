# Latin Music Mastery

A comprehensive online learning platform for mastering Latin music styles including Salsa, Bachata, Reggaeton, and more.

## Features

- **User Authentication**: Secure signup/login with Supabase Auth
- **Course Management**: Organized by country and musical style
- **Interactive Lessons**: Soundslice integration for enhanced learning
- **Exercises & Quizzes**: Test your knowledge with interactive exercises
- **Subscription Management**: Stripe-powered subscription system
- **Admin Panel**: Content management for admins
- **Progress Tracking**: Monitor your learning journey

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Database & Auth**: Supabase
- **Payments**: Stripe
- **UI Components**: shadcn/ui + Tailwind CSS
- **Hosting**: Vercel
- **Language**: TypeScript

## Getting Started

### Prerequisites

- Node.js 18+ installed
- A Supabase account
- A Stripe account

### Installation

1. **Clone the repository and install dependencies:**

```bash
npm install
```

2. **Set up Supabase:**

   - Create a new project at [supabase.com](https://supabase.com)
   - Go to the SQL Editor and run the migrations in order:
     - `supabase/migrations/001_initial_schema.sql`
     - `supabase/migrations/002_seed_data.sql`
   - Copy your project URL and keys

3. **Configure environment variables:**

   Create a `.env.local` file with your credentials:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. **Set up Stripe:**

   - Create a product and price in your Stripe dashboard
   - Set up a webhook endpoint pointing to `/api/webhooks/stripe`
   - Copy the webhook signing secret

5. **Run the development server:**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Project Structure

```
├── app/                      # Next.js app directory
│   ├── actions/             # Server actions
│   ├── api/                 # API routes
│   ├── auth/                # Auth callback
│   ├── login/               # Login page
│   ├── signup/              # Signup page
│   ├── dashboard/           # User dashboard
│   ├── admin/               # Admin panel
│   └── courses/             # Course pages
├── components/              # React components
│   └── ui/                  # shadcn/ui components
├── lib/                     # Utilities
│   ├── supabase/           # Supabase clients
│   └── utils.ts            # Helper functions
├── types/                   # TypeScript types
│   └── database.ts         # Database types
└── supabase/               # Database migrations
    └── migrations/         # SQL migration files
```

## Database Schema

See `supabase/README.md` for detailed database documentation.

### Main Tables

- `profiles` - User profiles
- `countries` - Latin American countries
- `musical_styles` - Musical styles per country
- `courses` - Courses for each style
- `lessons` - Individual lessons
- `exercises` - Quizzes and exercises
- `subscriptions` - Stripe subscriptions
- `user_progress` - Learning progress
- `exercise_attempts` - Exercise submissions

## Development

### Create an Admin User

After signing up, manually set `is_admin = true` in the `profiles` table for your user in Supabase.

### Testing Stripe

Use Stripe test cards for development:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import the project in Vercel
3. Add all environment variables
4. Deploy

### Post-Deployment

- Update your Supabase redirect URLs to include your production domain
- Update Stripe webhook endpoint to your production URL
- Update `NEXT_PUBLIC_APP_URL` to your production domain

## Contributing

This is a private educational platform. For questions or issues, contact the development team.

## License

Proprietary - All rights reserved
