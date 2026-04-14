# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5 + Socket.io (real-time)
- **Database**: PostgreSQL + Drizzle ORM (not used in TableMatch MVP)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/tablematch run dev` — run Expo mobile app

## Artifacts

### TableMatch (Expo Mobile App)
- **Directory**: `artifacts/tablematch/`
- **Preview path**: `/`
- **Description**: Tinder-style restaurant matching app for date nights
  
#### App Features:
- Two users join a shared session (session code sharing)
- Browser geolocation to find nearby restaurants
- Google Places API integration (falls back to mock data)
- Swipe right to like, swipe left to pass
- Real-time match detection via Socket.io
- Match modal with Maps link
- Partner activity indicator ("Partner is swiping...")
- Connection status indicator

#### Key Files:
- `artifacts/tablematch/context/SessionContext.tsx` — socket.io session/swipe/match state
- `artifacts/tablematch/app/index.tsx` — home screen (create/join session)
- `artifacts/tablematch/app/swipe.tsx` — swipe deck screen
- `artifacts/tablematch/components/RestaurantCard.tsx` — swipeable card with gestures
- `artifacts/tablematch/components/MatchModal.tsx` — animated match celebration screen
- `artifacts/tablematch/constants/colors.ts` — design tokens (coral/warm theme)

#### API Server additions:
- `artifacts/api-server/src/tablematch/index.ts` — Socket.io session/swipe/match logic (in-memory)
- `artifacts/api-server/src/tablematch/restaurants.ts` — Google Places API + mock fallback

### API Server
- **Directory**: `artifacts/api-server/`
- **Preview path**: `/api`
- **Description**: Express backend with Socket.io for real-time communication

## Environment Variables

- `GOOGLE_PLACES_API_KEY` — Optional. Enables real nearby restaurant search. Falls back to mock data if not set.
- `SESSION_SECRET` — Used by Express session middleware

## See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
