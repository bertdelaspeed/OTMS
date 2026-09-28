# Vercel Deployment Guide

This guide explains how to deploy Rollcall to Vercel with environment variables for database connections and integrations.

## Prerequisites

1. A [Vercel account](https://vercel.com/signup)
2. Your Rollcall project pushed to a Git repository (GitHub, GitLab, or Bitbucket)
3. Credentials for your chosen backend (Supabase, Firebase, or local bridge)

## Quick Deploy

### 1. Push to Git

Make sure your project is committed and pushed to your Git repository:

```bash
git add .
git commit -m "Ready for Vercel deployment"
git push
```

### 2. Import to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Select your Git repository
3. Vercel will auto-detect it as a Vite project
4. Click **Deploy**

### 3. Configure Environment Variables

In the Vercel dashboard, go to your project settings → **Environment Variables** and add:

#### For Supabase Backend

```
VITE_DB_KIND=supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_AUTO_SYNC=true
```

#### For Firebase Backend

```
VITE_DB_KIND=firebase
VITE_FIREBASE_URL=https://your-project-default-rtdb.firebaseio.com
VITE_AUTO_SYNC=true
```

#### For Google Calendar Integration

```
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

### 4. Redeploy

After adding environment variables, redeploy your project:

1. Go to **Deployments** tab
2. Click the three dots (⋯) on the latest deployment
3. Select **Redeploy**

## Environment Variables Reference

### Database Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_DB_KIND` | Backend type: `local`, `bridge`, `supabase`, or `firebase` | `supabase` |
| `VITE_AUTO_SYNC` | Enable automatic sync (default: `true`) | `true` |

### Supabase

| Variable | Description | Where to find it |
|----------|-------------|------------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Public anon key | Settings → API → Project API keys |

### Firebase

| Variable | Description | Where to find it |
|----------|-------------|------------------|
| `VITE_FIREBASE_URL` | Realtime Database URL | Firebase Console → Realtime Database |

### Google Calendar

| Variable | Description | Where to find it |
|----------|-------------|------------------|
| `VITE_GOOGLE_CLIENT_ID` | OAuth 2.0 Client ID | Google Cloud Console → Credentials |

## Google Calendar Setup for Vercel

When deploying to Vercel, you need to update your Google Cloud Console OAuth settings:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project → **APIs & Services** → **Credentials**
3. Edit your OAuth 2.0 Client ID
4. Under **Authorized JavaScript origins**, add your Vercel domain:
   - `https://your-project.vercel.app`
   - Or your custom domain if you have one
5. Save changes

## Supabase Setup

### Create Required Table

Run this SQL in your Supabase SQL Editor:

```sql
create table if not exists rollcall_state (
  id int primary key,
  data jsonb not null,
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table rollcall_state enable row level security;

create policy "rollcall anon read" on rollcall_state for select using (true);
create policy "rollcall anon write" on rollcall_state for insert with check (true);
create policy "rollcall anon update" on rollcall_state for update using (true);
```

### Get Credentials

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API**
3. Copy **Project URL** → `VITE_SUPABASE_URL`
4. Copy **anon public** key → `VITE_SUPABASE_ANON_KEY`

## Firebase Setup

### Create Realtime Database

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project → **Build** → **Realtime Database**
3. Click **Create Database**
4. Choose your location and start in **test mode**
5. Copy the **Database URL** → `VITE_FIREBASE_URL`

### Security Rules (Production)

For production, update your security rules:

```json
{
  "rules": {
    "rollcall": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

## Local Development

For local development, create a `.env.local` file (already gitignored):

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials. Vite will automatically load these variables.

## Troubleshooting

### Environment Variables Not Loading

1. Make sure variables are prefixed with `VITE_`
2. Redeploy after adding new variables
3. Check that variables are set for the correct environment (Production/Preview/Development)

### Google Calendar Not Working

1. Verify your Vercel domain is in Google's authorized origins
2. Check that the Google Calendar API is enabled
3. Ensure the client ID is correct

### Database Connection Issues

1. Verify credentials are correct
2. Check that the database/table exists
3. For Supabase, ensure RLS policies are configured
4. Check browser console for specific error messages

## Custom Domain

To use a custom domain:

1. Go to your Vercel project → **Settings** → **Domains**
2. Add your domain
3. Update DNS records as instructed
4. Update Google Calendar authorized origins with your custom domain

## Environment-Specific Variables

Vercel supports different variables for different environments:

- **Production**: Main deployment (e.g., `your-app.vercel.app`)
- **Preview**: Pull request deployments
- **Development**: Local development with `vercel dev`

You can set variables for specific environments in the Vercel dashboard.

## Security Notes

- Never commit `.env.local` or `.env` files to Git
- Use the `anon` key for Supabase (not the `service_role` key)
- For Firebase, use appropriate security rules in production
- Regularly rotate your API keys and credentials

## Support

- [Vercel Documentation](https://vercel.com/docs)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Supabase Documentation](https://supabase.com/docs)
- [Firebase Documentation](https://firebase.google.com/docs)
