# Phase 1 Implementation Guide

## 📋 Overview

Phase 1 implements three critical systems:
1. **Error Handling & Logging** - Centralized error management
2. **Testing Framework** - Unit and component tests
3. **CI/CD Pipeline** - Automated testing and building

---

## 1️⃣ Error Handling System

### Architecture

```
┌─────────────────────────────────────────┐
│ Component/Service Error                 │
└────────────┬────────────────────────────┘
             │
             ▼
    ┌─────────────────┐
    │ API Interceptor │
    └────────┬────────┘
             │
             ▼
    ┌─────────────────────────────┐
    │ parseApiError()             │
    │ - Parse status code         │
    │ - Extract error message     │
    │ - Map to user-friendly msg  │
    └────────┬────────────────────┘
             │
             ▼
    ┌─────────────────────────────┐
    │ AppError class              │
    │ - Structured error data     │
    │ - Category (API/Auth/etc)   │
    │ - Technical + user messages │
    └────────┬────────────────────┘
             │
             ▼
    ┌─────────────────────────────┐
    │ logError()                  │
    │ - Console (dev)             │
    │ - Monitoring (prod)         │
    └─────────────────────────────┘
```

### Files Created

**`src/utils/errors.ts`**
- `AppError` class: Custom error with structured context
- `parseApiError()`: Convert axios errors to AppError
- `logError()`: Safe error logging
- HTTP status → user message mapping

**`src/api/api.ts`** (Enhanced)
- Request interceptor: Logging in dev mode
- Response interceptor: 
  - Handle 401 redirects
  - Automatic retry (3x) for 5xx errors
  - Error parsing and logging
- Request deduplication (prevent duplicate calls)

**`src/components/ErrorBoundary.tsx`**
- React error boundary component
- Catches component errors with fallback UI
- Shows technical details in dev mode
- Provides retry and home navigation buttons

### Usage Examples

```typescript
// In services/components
import { api } from '@/api/api';
import { parseApiError, logError, AppError } from '@/utils/errors';

// API errors are automatically parsed
const response = await api.get('/matches');  // ✅ Automatic error handling

// Manual error handling
try {
  const data = await api.post('/marketplace/buy', { cardId: 123 });
} catch (error) {
  const appError = error instanceof AppError 
    ? error 
    : parseApiError(error);
  
  // Show user-friendly message
  toast.error(appError.getUserMessage());
  
  // Log technical details
  logError(appError);
}

// In components - ErrorBoundary wraps App
<ErrorBoundary>
  <App />
</ErrorBoundary>

// Show custom fallback
<ErrorBoundary fallback={<CustomErrorUI />}>
  <FeatureComponent />
</ErrorBoundary>
```

### Error Categories

| Category | When | User Message Example |
|----------|------|----------------------|
| **API** | API request fails (4xx, 5xx) | "Ressource non trouvée" |
| **Auth** | 401 Unauthorized | "Authentification requise" |
| **Network** | No internet/timeout | "Erreur de connexion" |
| **Validation** | Invalid input | "Requête invalide" |
| **Unknown** | Unexpected errors | "Une erreur inattendue" |

---

## 2️⃣ Testing Framework

### Setup

**Install dependencies:**
```bash
npm install
```

**Run tests:**
```bash
npm run test           # Watch mode
npm run test:ui        # UI mode (dashboard)
npm run test:coverage  # Coverage report
```

### Configuration Files

**`vitest.config.ts`**
- Environment: jsdom (browser simulation)
- Setup file: `src/__tests__/setup.ts`
- Coverage provider: v8
- CSS modules and imports auto-handled

**`src/__tests__/setup.ts`**
- Auto cleanup after each test
- Mock `window.matchMedia`
- Mock `import.meta.env`
- Mock `localStorage`

### File Structure

```
src/__tests__/
├── setup.ts              # Global test setup
├── unit/
│   ├── errors.test.ts    # Error utility tests
│   └── ...               # More utils tests
├── components/
│   ├── ErrorBoundary.test.tsx
│   └── ...               # Component tests
├── integration/          # Feature integration tests
└── e2e/                  # End-to-end tests (Playwright later)
```

### Test Examples

**`src/__tests__/unit/errors.test.ts`** - Testing utilities
```typescript
import { describe, it, expect } from 'vitest';
import { AppError, parseApiError } from '../../utils/errors';

describe('AppError', () => {
  it('should create error with context', () => {
    const error = new AppError('Test', {
      category: 'API',
      statusCode: 404,
      userFriendlyMessage: 'Not found'
    });
    
    expect(error.context.category).toBe('API');
    expect(error.getUserMessage()).toBe('Not found');
  });
});
```

**`src/__tests__/components/ErrorBoundary.test.tsx`** - Testing components
```typescript
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../../components/ErrorBoundary';

describe('ErrorBoundary', () => {
  it('should catch and display errors', () => {
    const ThrowError = () => { throw new Error('Test'); };
    
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    
    expect(screen.getByText(/Oups!/i)).toBeInTheDocument();
  });
});
```

### Best Practices

✅ **DO:**
- Test user behavior, not implementation
- Use `screen` queries (user-centric)
- Test error scenarios
- Mock external services
- Use `@testing-library/user-event` for interactions

❌ **DON'T:**
- Test implementation details
- Use shallow rendering
- Mock everything
- Test third-party libraries
- Write tests that are slower than features

### Coverage Goals

| Category | Target |
|----------|--------|
| Utilities | 90%+ |
| Services | 70%+ |
| Components | 60%+ |
| Overall | 70%+ |

---

## 3️⃣ CI/CD Pipeline

### GitHub Actions Workflow

**File:** `.github/workflows/ci.yml`

**Triggered on:**
- Push to `main` or `develop`
- Pull requests to `main` or `develop`

### Jobs

#### 1. **Lint & Test** (Parallel matrix)
Runs on Node 18.x and 20.x

**Steps:**
```
✓ Checkout code
✓ Setup Node.js (with npm cache)
✓ Install dependencies (npm ci)
✓ Run ESLint
✓ Type check (tsc --noEmit)
✓ Run tests (vitest)
✓ Upload coverage to Codecov
```

**On PR:** Automatically comments with coverage report

#### 2. **Build** (After lint passes)
**Steps:**
```
✓ Checkout and setup Node.js
✓ Install dependencies
✓ Build production (npm run build)
✓ Check bundle size (<500KB)
✓ Upload artifacts (5-day retention)
```

#### 3. **Code Quality** (Parallel with build)
**Steps:**
```
✓ Generate coverage report
✓ Comment on PR with metrics
```

### Workflow Diagram

```
┌─────────────┐
│ Push/PR     │
└──────┬──────┘
       │
       ▼
┌──────────────────────────────────────┐
│ Lint & Test (Node 18.x, 20.x)        │
│ - ESLint                             │
│ - TypeScript type check              │
│ - Vitest                             │
│ - Coverage upload                    │
└──────┬───────────────┬───────────────┘
       │               │
       ▼               ▼
    ✓ Pass        ✗ Fail → Block PR
       │
       ├─────────────────────┬──────────────────────┐
       ▼                     ▼                      ▼
    Build              Code Quality         (Parallel)
    (Production)       (Coverage Report)
    - Compile          - PR Comment
    - Size check       - Metrics
    - Upload artifacts
```

### Configuration Details

**Node Versions:** 18.x, 20.x (LTS)

**Caching:**
- npm dependencies cached for speed (~2-3x faster)
- Cache invalidated when `package-lock.json` changes

**Bundle Size Limit:** 500KB (configurable)

**Coverage Upload:** Codecov integration for tracking coverage over time

**Artifact Retention:** 5 days (configurable)

### Protected Branch Rules

Recommended GitHub branch protection settings:

```yaml
# Settings → Branches → Branch protection rules
- Require status checks to pass:
  ✓ ci/cd-pipeline / lint-and-test (18.x)
  ✓ ci/cd-pipeline / lint-and-test (20.x)
  ✓ ci/cd-pipeline / build
  
- Require code reviews before merging: 1 review
- Require branches to be up to date
- Require conversation resolution
```

### Local Development

**Before pushing:**
```bash
npm run lint        # Fix linting issues
npm run test        # Run all tests
npm run build       # Build locally to catch issues
```

**Troubleshooting:**

| Issue | Solution |
|-------|----------|
| Tests fail locally but pass in CI | Run `npm ci` instead of `npm install` |
| Build size exceeds limit | Analyze with `npm run build -- --stats` |
| Coverage dropped | Check git diff for untested code |
| Node version mismatch | Use `nvm use` or check `.nvmrc` |

---

## 📊 Metrics & Monitoring

### What to Track

**Test Coverage:**
```bash
npm run test:coverage
# Generates: coverage/index.html
# Open in browser to see detailed report
```

**Build Size:**
```bash
du -sh dist/      # Total size
du -sh dist/assets/  # Assets size
```

**CI/CD Performance:**
- Check GitHub Actions tab for execution time
- Trends tracked in Codecov dashboard

### Dashboard Links

- **GitHub Actions:** `https://github.com/YOUR_ORG/tcg-frontend/actions`
- **Codecov:** `https://codecov.io/gh/YOUR_ORG/tcg-frontend`
- **Test Coverage:** `./coverage/index.html` (after local test run)

---

## 🚀 Next Steps

### Immediate (This Sprint)

1. **Run tests locally:**
   ```bash
   npm install
   npm run test
   ```

2. **Review error handling:**
   - Check how errors are caught in services
   - Update services to use new `parseApiError()`

3. **Test CI/CD:**
   - Create test PR to verify workflow

### Phase 2 (Next Sprint)

- [ ] Introduce Zustand for state management
- [ ] Add Zod for API validation
- [ ] Centralize types in `src/types/`
- [ ] Refactor FightPage (split components)
- [ ] Add more tests (aim for 70%+ coverage)

### Phase 3 (Long-term)

- [ ] Migrate to Tailwind CSS
- [ ] Add Storybook
- [ ] E2E tests with Playwright
- [ ] Performance monitoring

---

## 🔗 Useful Links

- [Vitest Docs](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Codecov Docs](https://docs.codecov.io/)

---

## ✅ Checklist for Developers

Before committing:
- [ ] Tests pass locally: `npm run test`
- [ ] No lint errors: `npm run lint`
- [ ] Types check: `npx tsc --noEmit`
- [ ] Build succeeds: `npm run build`
- [ ] New code has tests (if applicable)

---

*Last Updated: 2026-08-24*
*Implemented by: Claude AI*
