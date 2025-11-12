# Database Setup

## Instructions

1. Create a new Supabase project at https://supabase.com

2. Go to the SQL Editor in your Supabase dashboard

3. Run the migrations in order:
   - First, run `migrations/001_initial_schema.sql`
   - Then, run `migrations/002_seed_data.sql`

4. Copy your Supabase URL and keys to `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your anon/public key
   - `SUPABASE_SERVICE_ROLE_KEY`: Your service role key (for admin operations)

5. Configure Stripe webhooks:
   - Set up a webhook endpoint at `/api/webhooks/stripe`
   - Add the webhook secret to `.env.local`

## Database Schema

### Tables

- **profiles**: User profiles linked to auth.users
- **countries**: Latin American countries (Cuba, Puerto Rico, etc.)
- **musical_styles**: Musical styles per country (Salsa, Bachata, etc.)
- **courses**: Courses for each musical style
- **lessons**: Individual lessons within courses
- **exercises**: Quizzes and exercises for lessons
- **subscriptions**: Stripe subscription data
- **user_progress**: Track user progress through lessons
- **exercise_attempts**: Track user answers to exercises

### Security

All tables have Row Level Security (RLS) enabled with appropriate policies:
- Public can view countries, musical styles, and published courses
- Authenticated users with active subscriptions can access lesson content
- Admins can manage all content
- Users can only view/modify their own data
