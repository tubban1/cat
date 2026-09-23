# DON’T WAKE MISO

**Production target:** https://cat.fde.fan

A mobile-first social reaction game: steal the fish while Miso sleeps, then freeze the instant his eyes open.

## Product loop

```
cute → touch → greed → warning → FREEZE → survive / caught → retry → challenge
```

The first production build intentionally stays small:
- original inline SVG character art
- CSS lighting, depth and motion
- synthesized WebAudio cues
- no 3D runtime
- no login
- no ad SDK
- no third-party game assets

## Viral mechanics

- one-sentence rule
- readable fake cues vs real eye-open cue
- near-miss timing shown after failure
- progressively tighter timing
- instant retry
- `?beat=N` friend challenges
- portrait PNG share card generated in the browser
- stable A/B experiment assignment
- Vercel custom events for the full viral funnel

See [docs/EXPERIMENTS.md](docs/EXPERIMENTS.md).

## Art

The shipped Miso art is original vector work. External titles are used only as principle references.

See [docs/ART_DIRECTION.md](docs/ART_DIRECTION.md).

## Analytics

Vercel Web Analytics and Speed Insights are included in the Astro layout and enabled during the production deploy workflow.

Tracked custom events:
- Game Start
- Fake Cue
- Eyes Open
- Look Survived
- Fish Stolen
- Run End
- Retry
- Share
- Share Error
- Challenge Copy
- Challenge Open
- Challenge Beat
- Feedback Open
- Feedback Submitted

## User feedback

Players can rate a run as:
- 😴 Too easy
- 😼 Fair
- 😾 Unfair

They can optionally add up to 800 characters of feedback.

Feedback is written server-side to Supabase through `SUPABASE_DB_URL`. The app does **not** store the visitor IP address. It stores only tuning-relevant fields such as score, experiment variant, device class, locale, coarse country header, and OS family.

Schema: [supabase/001_cat_feedback.sql](supabase/001_cat_feedback.sql)

## Required GitHub repository secrets

The deploy workflow expects exactly the secrets already configured on this repository:

- `VERCEL_API_TOKEN`
- `SUPABASE_DB_URL`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

No secret values belong in source control.

## Deployment discipline

Production deploys are intentionally gated to protect the Vercel daily deployment quota.

A push to `main` deploys **only when the head commit message contains `[deploy]`**. The workflow may also be run manually.

The production workflow:
1. installs dependencies
2. builds and type-checks locally
3. validates/creates the Supabase feedback schema
4. creates or links the Vercel `cat` project
5. enables Web Analytics + Speed Insights
6. performs one Vercel production deploy
7. attaches `cat.fde.fan`
8. creates/updates Cloudflare DNS
9. checks the production deployment health endpoint

This keeps normal GitHub commits from consuming Vercel deploys.

## Local development

```bash
npm install
npm run dev
```

For local feedback testing, set:

```bash
SUPABASE_DB_URL=postgresql://...
```

## Stack

- Astro 5
- Vercel Serverless adapter
- Vercel Web Analytics
- Vercel Speed Insights
- PostgreSQL / Supabase
- Cloudflare DNS
