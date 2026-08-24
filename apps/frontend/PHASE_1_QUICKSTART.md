# Phase 1 - Quick Start Guide

## 🚀 Installation (5 minutes)

```bash
# 1. Install new dependencies
npm install

# 2. Verify everything works
npm run lint
npm run test
npm run build
```

## ✅ What's New?

### 1️⃣ Error Handling (Automatic)
- ✅ All API errors are caught and parsed
- ✅ Retry logic for server errors (5xx)
- ✅ French user-friendly messages
- ✅ React crashes → fallback UI instead of white screen

**Usage:**
```typescript
// Automatic error handling - no code changes needed
const data = await api.get('/match');

// Custom error handling
try {
  await api.post('/buy', { cardId: 123 });
} catch (error) {
  const appError = error instanceof AppError 
    ? error 
    : parseApiError(error);
  toast.error(appError.getUserMessage()); // French message
}
```

### 2️⃣ Testing Framework (npm run test)
- ✅ Vitest: Fast test runner
- ✅ React Testing Library: User-centric testing
- ✅ Coverage tracking: `npm run test:coverage`

**Commands:**
```bash
npm run test              # Watch mode (rerun on file change)
npm run test:ui          # Visual dashboard
npm run test:coverage    # HTML coverage report
```

**Example Test:**
```typescript
// src/__tests__/unit/errors.test.ts
it('should parse 404 error', () => {
  const error = parseApiError({ 
    response: { status: 404 } 
  });
  
  expect(error.getUserMessage()).toBe('Ressource non trouvée.');
});
```

### 3️⃣ CI/CD Pipeline (Automatic)
- ✅ Runs on every push/PR
- ✅ Tests + Lint + Type check in parallel
- ✅ Coverage report on PR
- ✅ Bundle size check (<500KB)

**View Results:**
```
GitHub → Actions tab → See workflow runs
         ↓
         Comments on PR with coverage metrics
```

---

## 📋 Files Summary

| File | Purpose | Status |
|------|---------|--------|
| `src/utils/errors.ts` | Error handling utility | ✅ NEW |
| `src/api/api.ts` | Enhanced API layer | ✅ ENHANCED |
| `src/components/ErrorBoundary.tsx` | React error catching | ✅ NEW |
| `src/App.tsx` | Added ErrorBoundary wrapper | ✅ UPDATED |
| `vitest.config.ts` | Test configuration | ✅ NEW |
| `src/__tests__/setup.ts` | Test setup & mocks | ✅ NEW |
| `src/__tests__/unit/errors.test.ts` | Error utility tests | ✅ NEW |
| `src/__tests__/components/ErrorBoundary.test.tsx` | Component tests | ✅ NEW |
| `.github/workflows/ci.yml` | GitHub Actions pipeline | ✅ NEW |
| `package.json` | Added test scripts & deps | ✅ UPDATED |

---

## 🧪 Test Your Changes

### Before Committing:
```bash
# 1. Run linter
npm run lint

# 2. Run tests
npm run test

# 3. Build and check size
npm run build
du -sh dist/

# 4. Commit if all pass
git add .
git commit -m "feat: implement Phase 1 error handling"
```

### CI/CD will then:
1. ✅ Run tests on Node 18 & 20
2. ✅ Check types
3. ✅ Lint code
4. ✅ Build production bundle
5. ✅ Verify bundle size < 500KB
6. ✅ Report coverage on PR

---

## 🐛 Troubleshooting

### Tests fail locally
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run test
```

### "import.meta.env is undefined"
```bash
# Run tests with proper setup
npm run test  # Should work - setup.ts mocks it
```

### "localStorage is not defined"
```bash
# Already mocked in setup.ts, should work automatically
npm run test
```

### Build exceeds 500KB
```bash
# Check what's taking space
npm run build
du -sh dist/assets/

# Consider code splitting in Phase 2
```

---

## 📚 Documentation

- **PHASE_1_EXPLANATION.md** ← Read this for detailed "why"
- **PHASE_1_IMPLEMENTATION.md** ← Read this for "how to use"
- **This file** ← Quick start

---

## 🔄 Next Steps

### Immediate (This PR)
1. Merge Phase 1 implementation ✅
2. Verify CI/CD runs successfully ✅
3. Keep everyone in the loop

### Next Sprint (Phase 2)
- [ ] Add Zod for API validation
- [ ] Zustand for state management
- [ ] Refactor FightPage (tests + split)
- [ ] Increase coverage to 70%+

### Later (Phase 3)
- [ ] Playwright E2E tests
- [ ] Tailwind CSS migration
- [ ] Storybook documentation
- [ ] Sentry error monitoring

---

## 🔗 Links

| Resource | Link |
|----------|------|
| Vitest Docs | https://vitest.dev |
| React Testing Library | https://testing-library.com |
| GitHub Actions | https://docs.github.com/en/actions |
| Codecov | https://codecov.io |

---

## ✨ Success Criteria

You've successfully implemented Phase 1 when:

- [ ] `npm run test` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` succeeds (< 500KB)
- [ ] GitHub Actions CI/CD runs on PR
- [ ] ErrorBoundary catches component errors
- [ ] API errors are structured AppError instances
- [ ] You can write tests confidently

---

*Ready to build a more robust app!* 🚀

See PHASE_1_EXPLANATION.md for deep dive into each component.
