# GapTuber

GapTuber is a YouTube market-intelligence and content-planning application. It combines current YouTube API observations, deterministic scoring, creator-owned Analytics data, and AI-assisted synthesis. AI output is treated as interpretation rather than a source of facts.

## Local development

1. Copy `.env.example` to `.env.local` and populate the required values.
2. Install dependencies with `npm ci`.
3. Apply database migrations with `npm run db:migrate`.
4. Start the application with `npm run dev`.

Never commit `.env.local`. `TOKEN_ENCRYPTION_KEY` must remain stable after OAuth tokens are stored; replacing it makes existing encrypted tokens unreadable.

## Quality checks

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

Run `npm run production:check` with the deployment environment loaded before releasing. It checks required configuration, HTTPS, payment configuration, and the outcome-learning database schema without printing secret values.

## Database migrations

Generate and review schema changes:

```bash
npm run db:generate
npm run db:check
```

Apply committed migrations:

```bash
npm run db:migrate
```

Migration `0001_outcome_learning` is deliberately non-destructive and preserves legacy `channels.video_ideas` and `channels.saved_ideas` data if those columns exist.

## Current-data and outcome-learning model

- Public market observations come from the YouTube Data API and are timestamped/cached for at most one hour.
- Private creator results come from the authenticated YouTube Analytics API.
- Linked videos are measured at day 1, day 7, and day 30 against a frozen channel baseline.
- Recommendations begin adapting only after at least three comparable signal outcomes or five channel-wide outcomes exist.
- Day-30 results are preferred, extreme ratios are capped, and learned ranking adjustments are limited to ±15% to reduce overfitting.
- The scheduled collector is configured in `vercel.json` and requires `CRON_SECRET`.

This is conservative online calibration, not autonomous foundation-model training. It can improve ranking for an individual creator while avoiding unsupported claims of causation.

## Production deployment checklist

- Set every required variable from `.env.example` in the hosting environment.
- Set `NEXT_PUBLIC_APP_URL=https://www.gaptuber.app` in the hosting environment.
- Register `https://www.gaptuber.app/api/auth/callback/google` as an authorized Google OAuth redirect URI.
- Add the production callback URL to Google OAuth and publish/verify the consent screen as required.
- Apply `npm run db:migrate` before shifting traffic.
- Configure the scheduled `/api/cron/snapshots` request with `CRON_SECRET`.
- Configure and test one complete payment provider and its signed webhook.
- Configure Sentry or another production error monitor.
- Run `npm run production:check`, tests, typecheck, lint, and build.
- Smoke-test sign-in, onboarding, scan generation, Vault linking, payments, and the cron endpoint in staging.

## Accuracy limitations

YouTube public APIs do not expose competitor CTR, retention, or exact keyword search volume. Market scores therefore describe the collected sample, not the whole market. The UI and API provenance should be used to distinguish observed data, deterministic calculations, and AI-generated interpretation.
