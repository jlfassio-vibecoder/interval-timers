# Supabase OAuth Setup (Google & Apple)

Steps to enable Google and Apple sign-in for the account hub.

---

## Prerequisites

- Supabase project with Authentication enabled
- Google Cloud Console project (for Google OAuth)
- Apple Developer account (for Apple Sign-In)

---

## 1. Supabase Dashboard Configuration

### Authentication → Providers

1. **Enable Google:** Turn on the Google provider
2. **Enable Apple:** Turn on the Apple provider

### Site URL

Set **Site URL** to your production origin, e.g.:

- `https://hiitworkouttimer.com`

### Redirect URLs

Add these redirect URLs to **Redirect URLs**:

**Production:**

- `https://hiitworkouttimer.com/account`
- `https://hiitworkouttimer.com/**` (wildcard, if supported)

**Development:**

- `http://localhost:3006/account`
- `http://localhost:3006/**` (wildcard, if supported)

---

## 2. Google OAuth

**OAuth consent screen:** Google requires a homepage with links to both privacy policy and terms of service. Configure in **APIs & Services → OAuth consent screen**:

- **Application homepage:** `https://hiitworkouttimer.com`
- **Privacy policy link:** `https://hiitworkouttimer.com/privacy`
- **Terms of service link:** `https://hiitworkouttimer.com/terms`

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. **APIs & Services → Credentials** → Create credentials → **OAuth client ID**
4. Application type: **Web application**
5. Add **Authorized JavaScript origins:**
   - `https://hiitworkouttimer.com`
   - `http://localhost:3006`
6. Add **Authorized redirect URIs:**
   - Supabase provides a callback URL like `https://<project-ref>.supabase.co/auth/v1/callback` — copy from Supabase Dashboard → Authentication → Providers → Google
7. Copy the **Client ID** and **Client secret** into Supabase → Authentication → Providers → Google

---

## 3. Apple Sign-In

1. Go to [Apple Developer](https://developer.apple.com/) → Certificates, Identifiers & Profiles
2. **Identifiers** → Create a **Services ID** (for web)
3. Configure the Services ID with:
   - Domain: `hiitworkouttimer.com` (and your Supabase auth domain if required)
   - Return URL: `https://<project-ref>.supabase.co/auth/v1/callback`
4. Create a **Sign in with Apple** key (private key) and download the `.p8` file
5. In Supabase → Authentication → Providers → Apple:
   - Services ID
   - Key ID
   - Team ID
   - Private key (contents of `.p8`)
   - Client ID (Bundle ID or Services ID as required)

Refer to [Supabase Apple docs](https://supabase.com/docs/guides/auth/social-login/auth-apple) for exact field mapping.

---

## 4. Optional: Gate Apple at Launch

If Apple is not ready at launch, you can hide the Apple button via the AuthModal prop:

```tsx
<AuthModal
  enableAppleSignIn={false}
  // ... other props
/>
```

Or gate it with an env var in your app:

```tsx
enableAppleSignIn={import.meta.env.VITE_ENABLE_APPLE_SIGNIN === 'true'}
```

---

## References

- [Supabase Auth with OAuth](https://supabase.com/docs/guides/auth/social-login)
- [Google OAuth setup](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Apple Sign-In setup](https://supabase.com/docs/guides/auth/social-login/auth-apple)
