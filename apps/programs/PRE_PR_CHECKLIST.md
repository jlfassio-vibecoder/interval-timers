# Pre-PR Verification Checklist

Use this checklist before creating a pull request to ensure code quality and prevent production issues.

## 🔄 Automatic Pre-Commit Checks

These run via Git hooks (configured in `.husky/`):

- [ ] ESLint passes (`npm run lint`) - via lint-staged
- [ ] TypeScript compiles (`npm run type-check`)
- [ ] Prettier formatting applied (`npm run format`) - via lint-staged

> **Note:** Astro build (`npm run build`) runs automatically in CI/CD with proper environment variables, not in pre-commit hooks. The pre-commit hook only runs lint-staged (ESLint + Prettier) and type-check for faster feedback. You can manually run `npm run verify:quick` to test the build locally before pushing.

## 🔒 Firebase Security Checks (CRITICAL)

**Run these manually before every PR:**

- [ ] **Firestore Security Rules**: No permissive `allow read, write: if true;` rules
- [ ] **Environment Variables**: No hardcoded Firebase API keys in code (only in `.env.local`)
- [ ] **Firebase Config**: `firebase.json` doesn't expose sensitive data
- [ ] **Authentication**: No client-side admin operations
- [ ] **App Check**: Properly configured with reCAPTCHA Enterprise
- [ ] **Debug Tokens**: No hardcoded debug tokens in production code

**Security Scan Command:**

```bash
npm run security:scan
```

## 🏝️ Astro Islands Architecture Checks

### Islands Isolation

- [ ] No React Context used across separate islands
- [ ] Custom Events used for cross-island communication (not Context)
- [ ] Client directives appropriate (`client:load`, `client:visible`, `client:idle`)
- [ ] No server-side code in client components
- [ ] Islands properly isolated (each `client:*` creates separate React instance)

### Component Patterns

- [ ] Astro components used for static content (no interactivity)
- [ ] React components only for interactive UI (state, events, hooks)
- [ ] Proper use of `client:*` directives
- [ ] No `window`/`document` access in Astro components (use React with `client:only` if needed)
- [ ] Components in correct directories (`src/components/astro/` vs `src/components/react/`)

### Context Usage

- [ ] React Context only used within single island (AppWrapper)
- [ ] Separate islands (WorkoutCards, ProgramsButton) use Custom Events
- [ ] No `useAppContext()` calls in separate islands
- [ ] Cross-island state sharing uses Custom Events (not Context)

## 🧪 Testing Requirements

### Unit Tests

- [ ] All existing tests pass (`npm run test`) — auth unit/contract/security and API tests; also runs as part of `npm run verify:quick`
- [ ] New features have corresponding tests
- [ ] Test coverage ≥80% for new code

### Integration Tests (Future)

- [ ] Firebase Emulator Suite tests pass - when configured
- [ ] Auth flows tested (signup, login, logout)
- [ ] Firestore CRUD operations validated

### Critical Path Tests

- [ ] User can view workouts
- [ ] User can open workout details
- [ ] User can select exercises and view details
- [ ] User can log workouts
- [ ] Authentication flow completes end-to-end
- [ ] Programs can be activated

## 🎯 Astro-Specific Checks

- [ ] No client components importing server-only code
- [ ] `client:*` directives only where necessary (interactive components)
- [ ] Astro components for static/SEO content
- [ ] No `useEffect` fetching in React islands (use proper data fetching)
- [ ] Images optimized (use appropriate formats)
- [ ] No `any` types in TypeScript
- [ ] Path aliases used (`@/` instead of relative paths)

## 🔥 Firebase Best Practices

### Firestore

- [ ] Queries use indexes (check Firebase Console)
- [ ] No N+1 query patterns (batch reads where possible)
- [ ] Security rules tested with `firebase emulators:start`
- [ ] Pagination implemented for lists (limit queries)
- [ ] Timestamps use `serverTimestamp()` not client time

### Authentication

- [ ] Auth state changes handled properly (loading states)
- [ ] Protected routes check `currentUser` appropriately
- [ ] Token refresh handled (Firebase SDK auto-refreshes)
- [ ] Logout clears all user data from state

### Firebase Hosting

- [ ] Redirects/rewrites configured correctly in `firebase.json`
- [ ] Custom domain SSL configured (if applicable)
- [ ] Headers set for security (CSP, X-Frame-Options)

### App Check

- [ ] App Check initialized correctly in `firebaseService.ts`
- [ ] Debug tokens only in development
- [ ] reCAPTCHA Enterprise site key from environment variables
- [ ] No hardcoded site keys or debug tokens

## 🚀 Build & Performance

- [ ] Production build succeeds (`npm run build`)
- [ ] No build errors or warnings
- [ ] No hydration mismatches
- [ ] Bundle sizes reasonable (<500KB main chunk)
- [ ] No unused dependencies
- [ ] Images optimized (use WebP/AVIF where possible)
- [ ] Lazy load off-screen components (`client:visible` for below-fold)
- [ ] Client directive usage optimized (not over-hydrating)

**Lighthouse Scores (minimum):**

- [ ] Performance: ≥90
- [ ] Accessibility: ≥95
- [ ] Best Practices: ≥95
- [ ] SEO: ≥90

## 📝 Code Quality

- [ ] No `console.log` in production code (use proper logging)
- [ ] No commented-out code blocks
- [ ] TODOs reference issue numbers (`// TODO: #123`)
- [ ] Descriptive variable/function names (no `data`, `temp`, `x`)
- [ ] Error boundaries wrap page components (if applicable)
- [ ] Loading states for async operations
- [ ] TypeScript strict mode compliance
- [ ] No `any` types (use `unknown` or proper types)

## 🔐 Environment & Secrets

- [ ] `.env.local` not committed (in `.gitignore`)
- [ ] All Firebase config values in environment variables
- [ ] `.env.example` updated with new variables (if applicable)
- [ ] GitHub Secrets configured for CI/CD
- [ ] No hardcoded API keys, tokens, or secrets

**Required Environment Variables:**

```bash
PUBLIC_FIREBASE_API_KEY=
PUBLIC_FIREBASE_AUTH_DOMAIN=
PUBLIC_FIREBASE_PROJECT_ID=
PUBLIC_FIREBASE_STORAGE_BUCKET=
PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
PUBLIC_FIREBASE_APP_ID=
PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY=
PUBLIC_APP_CHECK_DEBUG_TOKEN=  # Development only
```

**Optional (for specific features):**

- `GEMINI_API_KEY` — Deep dive generation; Veo video generation ("Generate with Gemini")
- `RUNWAYML_API_SECRET` — Admin exercise video generation (Runway ML, "Generate with Runway")

**Environment Validation:**

```bash
npm run check-env
```

## 📚 Documentation

- [ ] README updated if setup changes
- [ ] JSDoc comments for public functions
- [ ] Component props documented (TypeScript interfaces)
- [ ] Breaking changes noted in PR description
- [ ] Firebase schema changes documented
- [ ] New components documented in `docs/` directory
- [ ] Architecture patterns followed (see `docs/architecture/`)

## 🎨 UI/UX Checks

- [ ] Tailwind classes follow project conventions
- [ ] Mobile responsive (test on Chrome DevTools)
- [ ] Keyboard navigation works (tab through forms)
- [ ] ARIA labels on interactive elements
- [ ] Focus states visible
- [ ] Animations smooth (Framer Motion used appropriately)
- [ ] Loading states for async operations
- [ ] Error states handled gracefully

## 🐛 Common Pitfalls to Avoid

- ❌ **Firestore**: Reading entire collections without `.limit()`
- ❌ **Auth**: Not handling auth state changes properly
- ❌ **Astro**: Using React components for static content
- ❌ **Islands**: Trying to use React Context across separate islands
- ❌ **TypeScript**: Using `any` type (use `unknown` or proper types)
- ❌ **Performance**: Large images not optimized
- ❌ **Security**: Sensitive logic in client components
- ❌ **Client Directives**: Over-hydrating with `client:load` when `client:visible` would work
- ❌ **Environment**: Hardcoded API keys or secrets

## 🚦 Quick Verification Commands

```bash
# Run all checks at once
npm run verify:all

# Quick check (lint + type-check + test; no build)
npm run verify:quick

# Run tests only
npm run test

# Pre-deployment check
npm run verify:deploy

# Security scan
npm run security:scan

# Environment validation
npm run check-env
```

## ✅ PR Creation Checklist

Before clicking "Create Pull Request":

1. [ ] Branch is up-to-date with `main`
2. [ ] All automatic checks passed (pre-commit hooks)
3. [ ] Tests pass (`npm run test` or `npm run verify:quick`)
4. [ ] Manual checklist items verified
5. [ ] Screenshots added for UI changes
6. [ ] PR description follows template
7. [ ] Reviewers assigned
8. [ ] Security scan passed (`npm run security:scan`)
9. [ ] Build succeeds locally (`npm run build`)

## 🆘 Getting Help

If verification fails:

1. **Check error message**: Most errors are self-explanatory
2. **Firebase Emulator Logs**: `firebase emulators:start` shows detailed errors
3. **Astro Docs**: Search for error codes in [Astro Documentation](https://docs.astro.build)
4. **TypeScript Errors**: Run `npm run type-check` for detailed type errors
5. **ESLint Errors**: Run `npm run lint:fix` to auto-fix many issues

---

**Status Indicators:**

- 🔴 **Critical**: Must fix before PR
- 🟡 **Important**: Should fix before merge
- 🟢 **Nice-to-have**: Can address in follow-up PR
