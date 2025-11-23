# Backend service slicing

This repository now organizes the Express API into domain-focused service apps to mirror a microservice-friendly architecture. Each service app is self-contained: it wires its own routers, middlewares, and can be split into an independent service if required.

## Service apps
- **Identity service (`src/apps/identity.app.js`)** — authentication, profiles, availability, and master data needed during onboarding and account management.
- **Content service (`src/apps/content.app.js`)** — catalog browsing, CMS data, and review flows.
- **Commerce service (`src/apps/commerce.app.js`)** — wallet, bookings, session lifecycle, and related notifications.
- **Communication service (`src/apps/communication.app.js`)** — chat, voice, media handling, presence, and user notifications.
- **Operations service (`src/apps/operations.app.js`)** — administrative tools and inbound webhooks.

## Composition
`src/app.js` registers each service app in one place using `registerServiceApps`. This keeps global middleware (security, observability, rate limiting) shared while isolating domain concerns. To further decouple, each service app can be extracted into its own server entry point and run behind an API gateway without changing route contracts.
