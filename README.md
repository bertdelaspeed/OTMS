# OTMS
Office Team Management System

## Environment Configuration

The application uses environment variables for database connections and integrations. All client-side variables are prefixed with `VITE_` (exposed by Vite at build time).

### Quick Start

1. Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` with your credentials (this file is gitignored)

3. For Vercel deployment, set these variables in the Vercel dashboard instead

### Environment Variables

#### Database Backend Selection

```bash
VITE_DB_KIND=local          # Options: local | bridge | supabase | firebase
VITE_AUTO_SYNC=true         # Enable automatic sync to remote backend
```

#### Supabase Configuration

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Get these from: Supabase Dashboard → Settings → API

#### Firebase Configuration

```bash
VITE_FIREBASE_URL=https://your-project-default-rtdb.firebaseio.com
```

Get this from: Firebase Console → Realtime Database → Database URL

#### Google Calendar Integration

```bash
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

Get this from: Google Cloud Console → APIs & Services → Credentials

#### Local Bridge (PostgreSQL/MySQL)

These are server-side only (not prefixed with VITE_):

```bash
ROLLCALL_DB_ENGINE=postgres    # postgres | mysql
ROLLCALL_DB_HOST=127.0.0.1
ROLLCALL_DB_PORT=5432
ROLLCALL_DB_NAME=rollcall
ROLLCALL_DB_USER=postgres
ROLLCALL_DB_PASSWORD=your-password
```

### Deployment

See [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) for detailed deployment instructions.

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Features

- 📊 **Dashboard** - Real-time overview of team status and activities
- 👥 **People Management** - Track employees with matricule, roles, and contact info
- 🏢 **Teams** - Organize people into teams with color-coded tags
- 📋 **Tasks** - Assign tasks with work periods, track status, mark as missions
- 📅 **Calendar** - Week/Month/Year views with task visualization
- 📈 **Activity Journal** - Filter and review all activities by period
- 🔍 **Audit Log** - Complete history of all changes
- 📤 **Excel Import/Export** - Bulk operations with templates
- 📄 **PDF Records** - Generate detailed employee records
- 🌐 **Google Calendar Sync** - Mirror tasks to Google Calendar
- 💾 **Multiple Backends** - Local storage, Supabase, Firebase, or PostgreSQL/MySQL
- 🌍 **Bilingual** - Full French and English support
