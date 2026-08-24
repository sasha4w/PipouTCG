# TCG Frontend - Context & Improvement Plan

## Project Overview

**Stack:** React 19 + TypeScript + Vite + React Router + TanStack Query + Socket.io

**Purpose:** Trading Card Game frontend application with real-time multiplayer combat, marketplace, deck building, and seasonal progression systems.

**Key Features:**
- Real-time PvP fights (WebSocket with Socket.io)
- Card collection & inventory management
- Deck builder with draft/sealed modes
- Marketplace (buy/sell listings)
- Shop with banners & boosters
- Profile with stats & seasonal progression
- Quests & daily rewards
- Admin panel for content management
- Multi-language support (EN, FR, KO)

---

## Current Architecture

### Directory Structure
```
src/
├── pages/           # Main page components (7 pages)
├── features/        # Domain-specific features
│   ├── fight/       # Combat system & UI (most complex)
│   ├── marketplace/ # Trading system
│   ├── cards/       # Card display & management
│   ├── deck/        # Deck builder
│   ├── shop/        # Shop interface
│   ├── profile/     # User profile panels
│   ├── quests/      # Quest system
│   └── ...
├── components/      # Reusable UI components
├── services/        # API layer (each domain has a service)
├── hooks/           # Custom React hooks
├── contexts/        # Global state (Sound, DailyReward)
├── i18n/            # Translations (i18next)
├── api/             # Axios configuration
└── utils/           # Utilities & query keys
```

### Key Technologies
- **State Management:** TanStack Query + Context API (minimal)
- **Routing:** React Router v7
- **HTTP Client:** Axios (with 401 interceptor)
- **Real-time:** Socket.io
- **Animations:** Framer Motion + GSAP
- **Audio:** Howler.js
- **Styling:** CSS Modules (68 .css files)
- **i18n:** i18next + browser language detection
- **PWA:** vite-plugin-pwa

---

## 🎯 Axes of Improvement

### 1. **State Management Architecture** ⚠️ HIGH PRIORITY
**Current Issue:** Fragmented state management
- TanStack Query handles server state (good!)
- Context API used sparsely (SoundContext, DailyRewardContext)
- No unified client-side state solution
- Fight logic scattered across useState calls

**Recommendations:**
- [ ] Introduce **Zustand** or **Redux Toolkit** for client state
  - Audio settings, UI state, user preferences
  - Game session state (fight board, hand, zones)
  - Modals/navigation state
- [ ] Consolidate fight logic into a dedicated store
- [ ] Create typed action creators for predictability
- [ ] Use TanStack Query for backend sync only

**Why:** Easier debugging, predictable state flow, better performance via selectors.

---

### 2. **Type Safety & Validation** ⚠️ MEDIUM-HIGH
**Current Issue:** Weak runtime validation
- TypeScript types exist but no schema validation
- API responses unvalidated at runtime
- Service types inconsistent across modules

**Recommendations:**
- [ ] Add **Zod** or **io-ts** for runtime schema validation
  - Validate all API responses
  - Create reusable schemas for common types (Card, Match, User)
- [ ] Centralize all shared types in `src/types/`
  - Domain models (Card, Match, User, Deck, etc.)
  - API request/response types
  - Service DTOs
- [ ] Use `const assertions` for literal types (tabs, statuses)

**Files to create:**
```
src/types/
├── common.ts       # Shared domain models
├── api.ts          # API request/response types
├── fight.ts        # Fight system types
├── marketplace.ts  # Marketplace types
└── schemas.ts      # Zod/io-ts validators
```

---

### 3. **Code Organization & Modularity** 🟡 MEDIUM
**Current Issue:** Feature folders lack internal structure
- No clear separation of concerns within features
- Business logic mixed with UI components
- Hooks contain complex logic (FightPage.tsx has 300+ lines)

**Recommendations:**
- [ ] Adopt feature folder convention:
  ```
  features/fight/
  ├── components/    # UI components only
  ├── hooks/        # Feature-specific hooks
  ├── services/     # Business logic & API calls
  ├── store/        # Zustand/Redux store
  ├── types.ts      # Feature types
  └── index.ts      # Public API
  ```
- [ ] Extract large components (FightPage, Profile, Marketplace)
  - Split into smaller, focused components
  - Move business logic to custom hooks
- [ ] Create utility modules for complex algorithms
  - Card sorting/filtering logic
  - Match simulation
  - Deck validation

---

### 4. **Error Handling & Logging** 🔴 CRITICAL
**Current Issue:** Minimal error handling
- Basic 401 interceptor only
- No global error boundary
- No error tracking/monitoring
- Console errors not captured

**Recommendations:**
- [ ] Create global error boundary component
  - Catch React errors with fallback UI
  - Log to monitoring service
- [ ] Add error handling interceptor in `api.ts`
  - Parse error messages consistently
  - Add retry logic for 5xx errors
  - Distinguish user-facing errors from technical errors
- [ ] Implement **Sentry** or similar for error tracking
  - Capture unhandled errors
  - Track user sessions
  - Performance monitoring
- [ ] Create error utility:
  ```ts
  src/utils/errors.ts
  - AppError class (extends Error)
  - Error type categorization (API, Auth, Validation, Network)
  - User-friendly message mapping
  ```

---

### 5. **Testing & Quality Assurance** 🔴 CRITICAL
**Current Issue:** Zero visible test coverage
- No unit, integration, or E2E tests
- Manual testing only
- No CI/CD pipeline visible

**Recommendations:**
- [ ] Add **Vitest** for unit tests
  - Test utilities, hooks, service logic
  - Target: 70%+ coverage for utils/services
- [ ] Add **React Testing Library** for component tests
  - Test critical components (modals, forms, lists)
  - Focus on user behavior, not implementation
- [ ] Add **Playwright** or **Cypress** for E2E tests
  - Fight flow, marketplace transactions, auth
- [ ] Setup GitHub Actions for CI/CD
  - Lint on PR
  - Run tests on PR
  - Build validation
  - Deploy on merge to main
- [ ] Config files:
  ```
  vitest.config.ts
  playwright.config.ts
  .github/workflows/ci.yml
  ```

**Example test structure:**
```
src/__tests__/
├── unit/          # Utilities, helpers
├── components/    # Component tests
├── integration/   # API & feature tests
└── e2e/          # End-to-end tests
```

---

### 6. **Styling System & Design Tokens** 🟡 MEDIUM
**Current Issue:** CSS files scattered everywhere
- 68+ CSS files (not maintainable)
- No shared design tokens (colors, spacing, fonts)
- No CSS-in-JS or utility framework
- Hard to theme/brand consistency

**Recommendations:**
- [ ] Migrate to **Tailwind CSS** or **CSS-in-JS (Styled Components/Emotion)**
  - Reduce CSS file count significantly
  - Consistent spacing/colors
  - Better maintainability
  - Responsive design built-in
- [ ] Create design token system
  ```
  src/theme/
  ├── tokens.ts      # Colors, spacing, typography, shadows
  ├── breakpoints.ts # Responsive breakpoints
  └── components.css # Base component styles (if using CSS)
  ```
- [ ] Implement dark mode support
  - Use CSS custom properties
  - Toggle with localStorage persistence
- [ ] Consider **Storybook** for component documentation
  - Gallery of all UI components
  - Easier for developers & designers

---

### 7. **API Layer & Data Fetching** 🟡 MEDIUM
**Current Issue:** API handling is basic
- No centralized error handling beyond 401
- No request/response logging
- No retry strategy for failed requests
- Services don't follow consistent patterns

**Recommendations:**
- [ ] Enhance `api.ts` interceptors:
  ```ts
  // Request interceptor: add auth, logging
  // Response interceptor: transform, retry, error handling
  // Add request timeout configuration
  ```
- [ ] Create typed API client:
  ```
  src/api/
  ├── client.ts      # Axios instance + interceptors
  ├── endpoints.ts   # Typed API routes
  └── types.ts       # API DTOs
  ```
- [ ] Implement request deduplication
  - Prevent double requests (network race conditions)
  - Use TanStack Query's built-in deduping
- [ ] Add request logging for development
  - Log API calls with params/response (dev only)
  - Track performance metrics

---

### 8. **Performance Optimization** 🟡 MEDIUM
**Current Issue:** No visible performance optimization
- No code splitting beyond routes
- Images not optimized
- No caching strategy
- Large components not memoized

**Recommendations:**
- [ ] Implement route-level code splitting
  ```ts
  const FightPage = lazy(() => import('...'));
  const Marketplace = lazy(() => import('...'));
  // Wrap with Suspense & Loading component
  ```
- [ ] Optimize images
  - Use WebP format with fallbacks
  - Implement lazy loading
  - Responsive images (srcset)
- [ ] Memoize expensive components
  - Use `React.memo()` for list items
  - Use `useMemo()` for computed values (fight board rendering)
  - Use `useCallback()` for event handlers
- [ ] Monitor performance
  - Use React DevTools Profiler
  - Track Core Web Vitals
  - Set up performance budget in CI

---

### 9. **Documentation & Developer Experience** 🟡 MEDIUM
**Current Issue:** Minimal documentation
- No README for developers
- No API documentation
- No component guidelines
- No setup instructions

**Recommendations:**
- [ ] Create comprehensive README.md
  - Project setup & dev environment
  - Architecture overview
  - Folder structure guide
  - Common tasks (adding feature, bug fix, deployment)
- [ ] Add JSDoc comments to public APIs
  - Services, hooks, context providers
  - Complex business logic
- [ ] Create CONTRIBUTING.md
  - Coding standards
  - PR process
  - Commit message conventions
- [ ] Setup Storybook (optional but recommended)
  - Document UI components
  - Visual regression testing

---

### 10. **Development Workflow & Standards** 🟡 MEDIUM
**Current Issue:** Inconsistent code style
- ESLint configured but limited rules
- No Prettier for formatting
- No pre-commit hooks
- No commit message conventions

**Recommendations:**
- [ ] Install **Prettier**
  - Auto-format on save
  - Consistent code style
- [ ] Enhance ESLint config
  - Add stricter TS rules
  - Add React best practices rules
  - Add import ordering rules
- [ ] Setup **Husky** + **lint-staged**
  ```
  Pre-commit: lint + format staged files
  Pre-push: run tests
  ```
- [ ] Create commit message conventions
  - Follow Conventional Commits (feat:, fix:, docs:, etc.)
  - Helps with automatic changelog generation

---

### 11. **Real-time Communication (Socket.io)** 🟡 MEDIUM
**Current Issue:** Basic Socket.io implementation
- No visible reconnection strategy
- No fallback for WebSocket failures
- No message queue/buffering

**Recommendations:**
- [ ] Create Socket.io service wrapper
  ```
  src/services/socket.service.ts
  - Reconnection logic (exponential backoff)
  - Event subscription management
  - Auto-reconnect on network change
  - Message queuing for offline mode
  ```
- [ ] Add loading/error states for socket connection
  - Show connection status in UI
  - Handle reconnection gracefully
- [ ] Implement message validation
  - Schema validation for socket events
  - Type-safe event handlers

---

### 12. **Security** 🟡 MEDIUM
**Current Issue:** Basic security measures
- JWT stored (probably in memory or localStorage)
- No CSRF protection visible
- No input sanitization visible

**Recommendations:**
- [ ] Review auth strategy
  - Token storage: prefer httpOnly cookies if backend supports
  - Token rotation strategy
  - Logout cleanup
- [ ] Add CSRF protection if needed
  - Check backend configuration
- [ ] Input validation/sanitization
  - Use Zod schema validation
  - Sanitize user input before display
- [ ] Add security headers (CSP, X-Frame-Options, etc.)
  - Configure in backend or vite plugin

---

## 📋 Quick Start for Contributors

### Setup
```bash
npm install
npm run dev        # Start dev server
npm run build      # Production build
npm run lint       # Run ESLint
npm run preview    # Preview production build
```

### Key Files
- `src/App.tsx` - Main routing & layout
- `src/api/api.ts` - Axios configuration
- `src/services/` - All API services
- `src/features/fight/` - Most complex feature (start here)

### Adding a New Feature
1. Create folder: `src/features/myfeature/`
2. Follow structure: `components/`, `services/`, `types.ts`, `index.ts`
3. Create service: `src/services/myfeature.service.ts`
4. Add types: `src/types/myfeature.ts`
5. Use TanStack Query in components for data fetching

### Debugging
- React DevTools: Component tree, props, hooks state
- Redux DevTools: (after adding Redux) time-travel debugging
- Network tab: Check API calls, WebSocket messages
- Console: Check for errors (add global error handler)

---

## 🚀 Priority Roadmap

**Phase 1 (Critical - Do First):**
- [ ] Add error boundary + error handling
- [ ] Add tests (utilities, critical services)
- [ ] Setup CI/CD pipeline

**Phase 2 (High - Do Next):**
- [ ] Introduce Zustand for client state
- [ ] Add Zod validation
- [ ] Centralize types
- [ ] Refactor FightPage (split into smaller components)

**Phase 3 (Medium - Nice to Have):**
- [ ] Migrate to Tailwind/CSS-in-JS
- [ ] Add Storybook
- [ ] Add E2E tests
- [ ] Performance optimization (code splitting, memoization)

**Phase 4 (Polish):**
- [ ] Full test coverage
- [ ] Sentry integration
- [ ] Advanced Socket.io features
- [ ] Comprehensive documentation

---

## 📊 Code Health Metrics

| Metric | Status | Target |
|--------|--------|--------|
| Test Coverage | 0% | 70%+ |
| ESLint Errors | ? | 0 |
| Bundle Size | ? | <500KB |
| Type Safety | Medium | Strict |
| Docs | Minimal | Comprehensive |
| Error Handling | Basic | Robust |

---

## 🔗 Related Files & Services

**Core Services:**
- `fight.service.ts` - Match logic & leaderboard
- `card.service.ts` - Card operations
- `deck.service.ts` - Deck management
- `marketplace.service.ts` - Trading logic

**Complex Features:**
- `features/fight/` - Real-time combat system
- `features/marketplace/` - Transaction management
- `features/deck/` - Draft/sealed logic

**Global State:**
- `contexts/SoundContext.tsx` - Audio management
- `contexts/DailyRewardContext.tsx` - Daily rewards
- `hooks/useSseNotifications.ts` - Server-sent events

**Key Hooks:**
- `useGameData.ts` - Shared game data fetching
- `useToast.tsx` - Toast notifications
- `useSseNotifications.ts` - Real-time updates

---

## 💡 Notes for Developers

- **Fight System:** Most complex feature, uses Socket.io + state machines
- **Marketplace:** Transaction-heavy, needs optimistic updates
- **i18n:** Already integrated, translations in `src/i18n/locales/`
- **Animations:** Framer Motion + GSAP, be careful with performance
- **PWA:** Already configured, works offline (check service-worker)
- **Environment:** Backend at `https://tcg-backend-3lez.onrender.com`

---

*Last Updated: 2026-08-24*
