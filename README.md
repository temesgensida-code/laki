# LakiDrop

Direct peer-to-peer file transfer built with SvelteKit, WebRTC, Tailwind CSS, and Google OAuth 2.0.

## Google OAuth 2.0 Authentication

Authentication is implemented via Google OAuth 2.0 with PKCE (Proof Key for Code Exchange) and stateless signed session cookies (HMAC-SHA256).

### Setting Up Google OAuth

1. Go to the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Create a new project (or select an existing one) and configure the **OAuth consent screen**.
3. Under **APIs & Services > Credentials**, click **Create Credentials > OAuth client ID**.
4. Select **Web application** as the application type.
5. In **Authorized redirect URIs**, add:
   - For local development: `http://localhost:5173/auth/google/callback`
   - For production: `https://<your-domain>/auth/google/callback`
6. Copy the **Client ID** and **Client Secret** into your `.env` file:

```env
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
AUTH_SECRET="a-random-32-plus-character-secret"
```

## Developing

Start the development server:

```sh
pnpm dev
```

Run type-checking and diagnostics:

```sh
pnpm check
```

## Building

To create a production build:

```sh
pnpm build
```

Preview the production build:

```sh
pnpm preview
```
