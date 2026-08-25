# TCG Frontend - Development Guide

## 🎯 Project Status

**Phase 1:** ✅ COMPLETE (Error Handling & CI/CD)  
**Phase 2:** 🟡 95% READY FOR PR (State Management & Types)  
**Phase 3:** ⏳ TODO (Styling & E2E - ~40 hours)  
**Phase 4:** ⏳ TODO (Polish & Docs - ~40 hours)

---

## 📋 Quick Reference

### Stack
**React 18.2** | **TypeScript** | **Vite** | **React Router** | **TanStack Query** | **Socket.io**

### Key Directories
```
src/
├── stores/          # Zustand state management (NEW Phase 2)
├── types/           # Centralized types (NEW Phase 2)
├── features/        # Feature modules (fight, marketplace, cards, deck, shop, etc.)
├── services/        # API layer (16 services)
├── components/      # Reusable UI components
├── hooks/           # Custom React hooks
├── contexts/        # Global context (Sound, DailyReward - migrating to Zustand)
├── pages/           # Page components (7 pages)
├── api/             # Axios configuration + validation
├── utils/           # Utilities & helpers
└── i18n/            # Translations (EN, FR, KO)
```

---

## 🚀 Phase 2 - READY FOR PR

### What's Done
✅ **6 Zustand Stores** (gameStore, uiStore, audioStore, userStore + 2 manager stores)  
✅ **5 Type Files** (centralized: common, fight, api, schemas, index)  
✅ **Zod Validation Framework** (runtime type safety)  
✅ **48 Store Tests** (100% coverage)  
✅ **Refactoring Hooks** (useGameSession for FightPage)  
✅ **Context → Zustand Migration** (SoundContext & DailyRewardContext)  
✅ **Build Clean** | **All Tests Pass**

### Files Created
- `src/stores/gameStore.ts`, `uiStore.ts`, `audioStore.ts`, `userStore.ts`, `cardManagerStore.ts`, `bundleManagerStore.ts`
- `src/types/common.ts`, `fight.ts`, `api.ts`, `schemas.ts`
- `src/features/fight/hooks/useGameSession.ts`
- `src/__tests__/unit/stores/*.test.ts` (4 test files)

### Files Modified
- `src/api/api.ts` - Added validation functions
- `package.json` - Added zustand + zod

### How to Use

**Import Stores:**
```typescript
import { useGameStore, useUIStore, useAudioStore, useUserStore } from '@/stores';
```

**Import Types:**
```typescript
import { Card, GameState, User, Match } from '@/types';
```

**Validate API:**
```typescript
import { validateResponse, cardSchema } from '@/types/schemas';
const validated = validateResponse(data, cardSchema);
```

### Next Steps
1. Code review Phase 2
2. Merge PR to main
3. Deploy to staging
4. Start Phase 3

### Optional Refactoring (5h - for Phase 3)
- CardManager.tsx (666 → 200 LOC) - store ready
- BundleManager.tsx (591 → 200 LOC) - store ready
- FightPage.tsx (350 → 80 LOC) - hook ready

---

## 📅 Phase 3 - Styling & Components (~40 hours)

### Tasks
1. **Migrate Tailwind CSS** (8h) - Remove 68 CSS files, modify 100+ components
2. **Add Storybook** (6h) - Document all reusable components
3. **Setup Playwright E2E** (12h) - Test user flows (auth, fight, marketplace, deck, profile)
4. **Increase to 70% coverage** (8h) - Add 60+ component/service tests

### Files to Create/Modify
- `tailwind.config.js`, `postcss.config.js`
- `.storybook/` config
- `e2e/` test suites
- Modify 100+ component files (add Tailwind classes)
- `package.json` - Add tailwindcss, storybook, playwright

---

## 🔵 Phase 4 - Polish & Finalization (~40 hours)

### Tasks
1. **Reach 80% coverage** (15h) - Add 100+ tests
2. **Integrate Sentry** (3h) - Error tracking
3. **Advanced Socket.io** (5h) - Reconnection, offline queue
4. **Documentation** (6h) - README, CONTRIBUTING, guides
5. **Performance** (8h) - Code splitting, memoization, images
6. **Security** (4h) - Audit, fix vulnerabilities

### Files to Create
- `README.md`, `CONTRIBUTING.md`, `ARCHITECTURE.md`, `docs/`
- `src/utils/sentry.ts`
- `src/services/socket.service.ts`
- 100+ test files

---

## 📊 Current Metrics

| Metric | Value |
|--------|-------|
| Total Tests | 63 |
| Store Coverage | 100% ✅ |
| Error Handler Coverage | 91% |
| Overall Coverage | 4% (will reach 70%+ in Phase 3) |
| Build Time | ~11s |
| Build Status | ✓ Clean |
| TypeScript Errors | 0 |

---

## 🛠️ Development Commands

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Run tests
npm run test              # Watch mode
npm run test:ui          # Visual dashboard
npm run test:coverage    # Coverage report

# Lint code
npm run lint

# Preview production build
npm run preview
```

---

## 🏗️ Architecture Decisions

### State Management
- **TanStack Query** - Server state (queries, mutations)
- **Zustand** - Client state (UI, preferences, game session) - NEW Phase 2
- **Context API** - Minimal (being migrated to Zustand)

### Type Safety
- **TypeScript** - Full strict mode
- **Zod** - Runtime validation (NEW Phase 2)
- Centralized types in `src/types/` (NEW Phase 2)

### Error Handling
- **ErrorBoundary** - Catches React component errors
- **AppError** class - Structured error handling
- **Axios Interceptor** - 401 redirect, 5xx retry (3x exponential backoff)

### Testing
- **Vitest** - Fast unit testing
- **React Testing Library** - Component testing
- **Playwright** - E2E tests (planned Phase 3)

### Real-time
- **Socket.io** - WebSocket communication
- Basic reconnection (enhanced in Phase 4)

---

## 🔄 Common Tasks

### Add a New Feature
1. Create folder: `src/features/myfeature/`
2. Structure: `components/`, `hooks/`, `services/` (if needed)
3. Create types: `src/types/myfeature.ts`
4. Use Zustand stores for state (if client-side)
5. Use TanStack Query for server state

### Use Zustand Store
```typescript
import { useGameStore } from '@/stores';

function MyComponent() {
  const { gameState, setGameState } = useGameStore();
  // Use store...
}
```

### Add Tests
```typescript
import { describe, it, expect } from 'vitest';

describe('MyComponent', () => {
  it('should do something', () => {
    expect(true).toBe(true);
  });
});
```

### Validate API Response
```typescript
import { validateResponse, cardSchema } from '@/types/schemas';

const response = await api.get('/cards');
const validated = validateResponse(response.data, cardSchema);
```

---

## 📚 Important Files

### Core Config
- `vite.config.ts` - Vite configuration
- `vitest.config.ts` - Test configuration
- `tsconfig.json` - TypeScript configuration
- `.eslintrc.js` - Linting rules

### State & Types
- `src/stores/index.ts` - Zustand store exports
- `src/types/index.ts` - Centralized type exports
- `src/api/api.ts` - Axios + validation

### Error Handling
- `src/utils/errors.ts` - Error utilities
- `src/components/ErrorBoundary.tsx` - Error boundary component

### Tests
- `src/__tests__/setup.ts` - Global test setup
- `src/__tests__/unit/stores/` - Store tests
- `src/__tests__/components/` - Component tests

---

## 🚀 Deployment

### Build
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

### Environment Variables
```
VITE_API_URL=https://your-backend-url
VITE_SENTRY_DSN=your-sentry-dsn (Phase 4)
```

---

## 📖 Best Practices

### Code Style
- Follow existing patterns
- Use TypeScript strict mode
- Test critical functionality
- Document complex logic with JSDoc

### State Management
- Use Zustand for client-side state
- Use TanStack Query for server state
- Keep stores focused (one concern per store)

### Error Handling
- Use AppError class from utils/errors.ts
- Log errors with logError() function
- Provide user-friendly error messages

### Testing
- Aim for 70%+ coverage (Phase 3 goal)
- Test behavior, not implementation
- Use describe/it pattern

---

## 🔗 Quick Links

- **Backend API:** https://tcg-backend-3lez.onrender.com
- **GitHub:** Your repo URL
- **Issues:** Check GitHub Issues for TODOs

---

## 📝 Timeline

**Phase 1 (Done):** 8h → Error Handling + CI/CD  
**Phase 2 (Now):** 16h → State Management + Types  
**Phase 3 (Next):** ~40h → Styling + Storybook + E2E  
**Phase 4 (Final):** ~40h → Polish + Sentry + Docs  

**Total:** ~100 hours over 3-4 weeks

---

**Last Updated:** 2026-08-25 | **Status:** Phase 2 Ready for PR ✅
