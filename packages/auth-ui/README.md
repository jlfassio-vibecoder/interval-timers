# @interval-timers/auth-ui

Shared auth UI for the interval-timers monorepo. Provides `AuthModal` (login/signup) and `buildAuthRedirectUrl` helper so all apps use one consistent auth flow.

## Installation

Add to your app's `package.json`:

```json
{
  "dependencies": {
    "@interval-timers/auth-ui": "*",
    "@supabase/supabase-js": "^2.0.0",
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0"
  }
}
```

## Tailwind

Include the package in your Tailwind `content` so its classes are generated:

```js
// tailwind.config.js
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "../../packages/auth-ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  // ...
};
```

Adjust the path relative to your app (e.g. from `apps/amrap` use `../../packages/auth-ui/src/**/*.{js,ts,jsx,tsx}`).

## Usage

### Vite apps (e.g. AMRAP)

```tsx
import { AuthModal } from '@interval-timers/auth-ui';
import { supabase } from '@/lib/supabase';

const redirectBaseUrl =
  import.meta.env.VITE_ACCOUNT_REDIRECT_URL ??
  import.meta.env.VITE_HUD_REDIRECT_URL ??
  '/account';

<AuthModal
  isOpen={showAuthModal}
  onClose={() => setShowAuthModal(false)}
  supabase={supabase}
  redirectBaseUrl={redirectBaseUrl}
  defaultSignUp={authModalSignUp}
  fromAppId="amrap"
  returnUrl="/with-friends"
/>
```

### Astro apps (apps/app)

Use the same component in a React island. For trainer/admin redirect, pass `getRedirectUrl`:

```tsx
import { AuthModal } from '@interval-timers/auth-ui';
import { supabase } from '@/lib/supabase/supabase-instance';

<AuthModal
  isOpen={showAuthModal}
  onClose={() => setShowAuthModal(false)}
  supabase={supabase}
  redirectBaseUrl="/account"
  fromAppId="app"
  getRedirectUrl={async (user) => {
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (data?.role === 'trainer' || data?.role === 'admin') {
      return '/trainer';
    }
    return null; // use default redirectBaseUrl + ?from=app
  }}
/>
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | `boolean` | yes | Whether the modal is visible. |
| `onClose` | `() => void` | yes | Called when modal is closed. |
| `supabase` | `SupabaseClient` | yes | Supabase client from your app. |
| `redirectBaseUrl` | `string` | yes | Where to send user after sign-in (e.g. `/account`). |
| `defaultSignUp` | `boolean` | no | When true, show sign-up form first. Default `false`. |
| `fromAppId` | `string` | no | App id for redirect query; redirect becomes `redirectBaseUrl?from=<fromAppId>`. |
| `returnUrl` | `string` | no | Optional return path; appended as `returnUrl` query param. |
| `getRedirectUrl` | `(user) => string \| Promise<string \| null>` | no | Override redirect URL (e.g. for trainer → `/trainer`). Return `null` to use default. |

## Environment variables

- **Timer apps (Vite):** `VITE_ACCOUNT_REDIRECT_URL` or `VITE_HUD_REDIRECT_URL` — full or relative URL to account page (e.g. `http://localhost:3006/account` in dev, `/account` in prod).
- **Hub app:** Can use relative `/account` when same-origin.

See also [docs/AUTH_ENV_AND_REDIRECTS.md](../../docs/AUTH_ENV_AND_REDIRECTS.md) for full deployment and Supabase setup.

## Behavior

- **Sign-in:** On success, redirects to `redirectBaseUrl?from=<fromAppId>` (and `&returnUrl=...` if set), or to the URL returned by `getRedirectUrl` if provided.
- **Sign-up:** No redirect (user unconfirmed). Shows in-modal success: "Check your email for the confirmation link." and a Close button. No `alert()`.
- **Errors:** Friendly inline messages for invalid credentials, unconfirmed email, rate limits.

## buildAuthRedirectUrl

```ts
import { buildAuthRedirectUrl } from '@interval-timers/auth-ui';

const url = buildAuthRedirectUrl('/account', {
  fromAppId: 'amrap',
  returnUrl: '/with-friends',
});
// => '/account?from=amrap&returnUrl=%2Fwith-friends'
```
