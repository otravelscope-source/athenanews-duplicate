# ATHENA independent duplicate

This repository is a full mirror of the original ATHENA repository. The independent Cloudflare implementation is in `duplicate/`. The original Railway service, repository, publishing schedule and DNS are not changed by this project. There is no cutover step.

The public pages reuse ATHENA's original templates, stylesheet, article paths, publication dates, read-aloud controls, sharing controls, sections and photo credits. Sanity supplies new editorial content; Supabase supplies independent reader accounts; Substack supplies newsletter sign-ups. Changing hosting and authentication requires integration testing even when the public design is preserved.

## Build the independent website

Install the pinned dependencies from the website directory.

```bash
cd duplicate/web
npm ci
```

Copy the example environment file and fill in the target service settings. Never commit this file or any write token. `CONTENT_SOURCE=snapshot` builds the verified 45 published articles; `CONTENT_SOURCE=sanity` enables the new newsroom. Sanity mode refuses to silently fall back to stale snapshot content or publish an empty dataset.

```bash
cp .env.example .env
```

Build the copy, check editorial rendering, and compare snapshot mode against the original templates.

```bash
npm run build
npm run test:editorial
node --env-file=.env scripts/verify-copy.mjs
```

The last comparison applies to snapshot mode. New editorial content is expected to change the site after Sanity is connected. Existing Railway-hosted images are copied locally. Original external images and their credits are preserved; approved cached copies are available for Sanity import. The archived article and private reader records remain in the protected backup, outside the public content file.

## Cloudflare Pages configuration

Use the duplicate repository and `duplicate/cloudflare` production branch. Root directory: `duplicate/web`; build command: `npm run build`; output: `dist`; `NODE_VERSION`: `24.19.0`. Other required variables are listed in `web/.env.example`. Preview indexing is disabled by default. The original domain remains with Railway; the duplicate gets a new Pages subdomain.

Keep reader sign-in switches disabled until a configured provider and actual signup, login, recovery and logout have passed. Supabase's default email service is not a production sender. Never disable email verification to work around an unconfigured mail service. Only the public Supabase publishable key belongs in browser code.

## Sanity newsroom

Studio schemas include Articles, Categories, Authors, original publication dates, a Breaking News toggle and image credits. Article-body link annotations are disabled; frontend rendering removes citations and reference lists. Image licences remain on the separate photo-credits page.

Install and build Studio after configuring the existing duplicate project and dataset.

```bash
cd duplicate/studio
npm ci
npm run build
```

The import tool defaults to a dry run. It validates records and media mappings before any remote write, preserves article IDs and dates, and never publishes archived records. Keep the import write credential out of GitHub and browser assets.

```bash
node duplicate/scripts/import-sanity.mjs PRIVATE_EXPORT/articles.json PRIVATE_MEDIA_ROOT PRIVATE_MEDIA_MAP.json
```

After authenticated import and Studio deployment, set `CONTENT_SOURCE=sanity` and `PUBLIC_SANITY_STUDIO_URL` in Pages. Create a Pages deploy hook for `duplicate/cloudflare`, then configure a Sanity webhook for published article, author, category and image changes. Store the hook URL only in Sanity. Builds take time; publishing is not instantaneous.

All services must stay within their current free quotas. No architecture can guarantee unlimited capacity or permanently unchanged free-plan terms.
