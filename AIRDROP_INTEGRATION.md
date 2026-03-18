# DEBRIS Airdrop Registration Integration

## Overview

The DEBRIS Airdrop Registration system has been integrated into the Trashmarket.fun repository as a separate subdirectory (`/airdrop`). This is a standalone full-stack application with its own frontend, backend, and database layer.

## Project Structure

```
Trashmarket.fun/
├── airdrop/                          # DEBRIS Airdrop Registration App
│   ├── client/                       # React 19 + Vite frontend
│   │   ├── src/
│   │   │   ├── pages/                # Home, NotFound, ComponentShowcase
│   │   │   ├── components/           # RegistrationForm, SuccessPage, AdminDashboard
│   │   │   ├── contexts/             # ThemeContext
│   │   │   ├── hooks/                # useAuth, useComposition, useMobile, usePersistFn
│   │   │   ├── lib/                  # TRPC client, utilities
│   │   │   ├── App.tsx               # Main app component
│   │   │   └── main.tsx              # Entry point
│   │   └── index.html
│   ├── server/                       # Backend (Express + TRPC)
│   │   ├── _core/                    # Core infrastructure
│   │   │   ├── trpc.ts               # TRPC router setup
│   │   │   ├── context.ts            # Request context
│   │   │   ├── env.ts                # Environment variables
│   │   │   ├── oauth.ts              # OAuth/X.com integration
│   │   │   ├── dataApi.ts            # External data APIs
│   │   │   └── index.ts              # Server entry point
│   │   ├── routers/
│   │   │   └── airdrop.ts            # Airdrop registration procedures
│   │   ├── db.ts                     # Database operations
│   │   ├── storage.ts                # File storage (S3)
│   │   └── routers.ts                # Router exports
│   ├── drizzle/                      # Database schema & migrations
│   │   ├── schema.ts                 # Drizzle ORM schema
│   │   ├── 0000_dear_nova.sql        # Initial schema migration
│   │   └── 0001_easy_speed_demon.sql # Additional migrations
│   ├── shared/                       # Shared types & constants
│   │   ├── types.ts                  # Shared TypeScript types
│   │   ├── constants.ts              # Brand, colors, validation helpers
│   │   └── _core/errors.ts           # Error definitions
│   ├── package.json                  # Dependencies
│   ├── vite.config.ts                # Vite configuration
│   ├── tsconfig.json                 # TypeScript config
│   ├── drizzle.config.ts             # Drizzle ORM config
│   └── README.md                     # Airdrop app documentation
├── src/                              # Main Trashmarket frontend
├── backend/                          # Main Trashmarket backend (Cloudflare Worker)
└── ...
```

## Key Features

### Frontend (Client)
- **Authentication**: OAuth integration with X.com for user verification
- **Registration Form**: Gorbagana wallet address submission with validation
- **Success Page**: Confirmation display after successful registration
- **Admin Dashboard**: Real-time statistics and registration management (admin-only)
- **Responsive Design**: Mobile-friendly interface with Trashmarket brand styling

### Backend (Server)
- **TRPC API**: Type-safe RPC procedures for frontend-backend communication
- **User Authentication**: OAuth context and session management
- **Database**: MySQL/TiDB via Drizzle ORM for registration storage
- **Admin Procedures**: 
  - `getStats`: Total, 24h, and hourly registration counts
  - `getRecentRegistrations`: Paginated recent registrations
  - `getRegistrationStats`: Hourly trend analysis
  - `exportRegistrations`: Full registration export (admin-only)
  - `verifyAdminWallet`: Wallet-based admin access verification

### Database Schema
- **registrations** table: Stores user registrations with:
  - `userId`: Unique user identifier
  - `userName`: User's name
  - `userOpenId`: OAuth OpenID
  - `gorbaganaWallet`: Submitted wallet address
  - `registeredAt`: Registration timestamp

## Integration Points

### 1. Footer Link
The main Trashmarket.fun frontend (`src/components/Footer.tsx`) now includes an "Airdrop" link in the Resources section:

```tsx
<li className="hover:text-magic-green cursor-pointer transition-colors">
  <a href="/airdrop" target="_blank" rel="noopener noreferrer">Airdrop</a>
</li>
```

This link opens the airdrop registration app in a new tab.

### 2. Deployment Strategy

#### Option A: Separate Deployment (Recommended)
Deploy the airdrop app independently:

```bash
cd airdrop
pnpm install
pnpm build
pnpm start  # Production server
```

Then configure your web server to route `/airdrop` requests to the airdrop app server.

#### Option B: Monorepo Deployment
If deploying as part of a monorepo:

1. Install dependencies in the root:
   ```bash
   cd airdrop && pnpm install
   ```

2. Add scripts to root `package.json`:
   ```json
   {
     "scripts": {
       "airdrop:dev": "cd airdrop && pnpm dev",
       "airdrop:build": "cd airdrop && pnpm build",
       "airdrop:start": "cd airdrop && pnpm start"
     }
   }
   ```

3. Configure your web server (Nginx, Apache, etc.) to proxy `/airdrop` requests to the airdrop server.

## Environment Variables

The airdrop app requires the following environment variables:

### Frontend (`.env.local`)
```
VITE_API_URL=http://localhost:3001  # Backend API URL
VITE_OAUTH_CLIENT_ID=<your-x-oauth-client-id>
VITE_OAUTH_REDIRECT_URI=http://localhost:5173/callback
```

### Backend (`.env`)
```
NODE_ENV=production
PORT=3001
DATABASE_URL=mysql://user:password@host:3306/debris_airdrop
JWT_SECRET=<your-jwt-secret>
OAUTH_CLIENT_ID=<your-x-oauth-client-id>
OAUTH_CLIENT_SECRET=<your-x-oauth-client-secret>
ADMIN_WALLET_ADDRESS=<gorbagana-wallet-address>
S3_BUCKET=<your-s3-bucket>
S3_REGION=<your-s3-region>
AWS_ACCESS_KEY_ID=<your-aws-key>
AWS_SECRET_ACCESS_KEY=<your-aws-secret>
```

## Styling & Branding

The airdrop app uses Trashmarket.fun's brand colors and aesthetic:

- **Colors**: Neon green (`#adff02`), black (`#000000`), white (`#FFFFFF`), gray (`#666666`)
- **Typography**: JetBrains Mono monospace font
- **Design**: Brutalist, terminal-inspired aesthetic with high contrast
- **Border Radius**: Zero (sharp corners throughout)

Shared constants are in `shared/constants.ts`:
```typescript
export const COLORS = {
  primary: '#adff02',
  dark: '#000000',
  text: '#FFFFFF',
  muted: '#666666',
};

export const BRAND = {
  NAME: 'DEBRIS AIRDROP',
  SUBTITLE: 'Gorbagana Chain',
};
```

## API Routes

### Public Routes
- `GET /api/health` - Health check

### Protected Routes (Authenticated Users)
- `POST /api/airdrop/register` - Register for airdrop
- `GET /api/airdrop/registration` - Get user's registration
- `POST /api/airdrop/update-wallet` - Update wallet address

### Admin Routes (Admin Users Only)
- `GET /api/airdrop/stats` - Get registration statistics
- `GET /api/airdrop/recent` - Get recent registrations
- `GET /api/airdrop/trends` - Get registration trends
- `GET /api/airdrop/export` - Export all registrations
- `POST /api/airdrop/verify-admin` - Verify admin wallet

## Development

### Local Development
```bash
cd airdrop

# Install dependencies
pnpm install

# Start dev server (frontend + backend)
pnpm dev

# Frontend: http://localhost:5173
# Backend: http://localhost:3001
```

### Building
```bash
# Build frontend and backend
pnpm build

# Output:
# - dist/index.js (backend)
# - dist/client/ (frontend static files)
```

### Database Migrations
```bash
# Generate migrations
drizzle-kit generate

# Apply migrations
drizzle-kit migrate
```

## Testing

```bash
# Run all tests
pnpm test

# Test files:
# - server/airdrop.test.ts
# - server/admin-stats.test.ts
# - server/auth.logout.test.ts
# - server/wallet-access.test.ts
```

## Security Considerations

1. **Wallet Validation**: Gorbagana wallet addresses are validated (32-44 characters, Base58 format)
2. **One Registration Per User**: Duplicate registrations are prevented at the database level
3. **Admin Access Control**: Admin procedures verify user role and wallet address
4. **OAuth Verification**: X.com authentication ensures user identity
5. **HTTPS Required**: All production deployments must use HTTPS
6. **Rate Limiting**: Consider adding rate limiting to prevent abuse (not currently implemented)

## Troubleshooting

### Database Connection Errors
Ensure `DATABASE_URL` is correctly set and the database is accessible.

### OAuth Callback Issues
Verify `VITE_OAUTH_REDIRECT_URI` matches the registered redirect URI in your OAuth provider settings.

### CORS Errors
Check that the backend API URL in `VITE_API_URL` matches the actual backend server address.

### Admin Dashboard Not Loading
Ensure the user's role is set to `'admin'` in the database and the wallet address matches `ADMIN_WALLET_ADDRESS`.

## Future Enhancements

1. **Rate Limiting**: Implement API rate limiting per IP/user
2. **Email Notifications**: Send confirmation emails upon registration
3. **Wallet Verification**: Implement on-chain wallet signature verification
4. **Airdrop Distribution**: Integrate with on-chain token distribution mechanism
5. **Analytics**: Enhanced tracking and reporting capabilities
6. **Internationalization**: Multi-language support

## Support

For issues or questions about the airdrop integration, refer to:
- Airdrop app README: `airdrop/README.md`
- Main Trashmarket docs: `docs/`
- GitHub issues: https://github.com/DOGECOIN87/Trashmarket.fun/issues
