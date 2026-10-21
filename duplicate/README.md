# ATHENA independent duplicate

This repository is a full mirror of the original ATHENA repository. The independent Cloudflare implementation is in `duplicate/`. The original Railway service, repository, publishing schedule and DNS are not changed by this project. There is no cutover step.

The public pages reuse ATHENA's original templates, stylesheet, article paths, publication dates, read-aloud controls, sharing controls, sections and photo credits. Sanity supplies new editorial content; Supabase supplies independent reader accounts; Substack supplies newsletter sign-ups. Changing hosting and authentication requires integration testing even when the public design is preserved.

## Build the independent website

Install the pinned dependencies from the website directory.

```bash
cd duplicate/web
npm ci
```

Copy the example environment file and fill in the target service settings. Never commit this file or any write token. `CONTENT_SOURCE=snapshot` builds the verified 46 published articles; `CONTENT_SOURCE=sanity` enables the new newsroom. Sanity mode refuses to silently fall back to stale snapshot content or publish an empty dataset.

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

Pages uses `CONTENT_SOURCE=sanity` and `PUBLIC_SANITY_STUDIO_URL=https://athena-newsroom.pages.dev`. The enabled Sanity webhook `Cloudflare Pages — ATHENA` calls the Pages deploy hook `Sanity published content` for the `duplicate/cloudflare` branch. Store the private hook URL only in Sanity; never add it to this repository, frontend environment variables or logs. Builds take time; publishing is not instantaneous.

The webhook applies only to the `production` dataset, uses POST, and triggers on create, update and delete of published articles, authors and categories. Draft and version events are disabled. Uploading an image alone does not rebuild the website; publishing the article containing it does. The exact GROQ filter is:

```groq
_type in ["article", "author", "category"] && !(_id in path("drafts.**")) && !(_id in path("versions.**"))
```

The request contains only the document ID and type. Its projection is:

```groq
{_id, _type}
```

To investigate a missing update, inspect Sanity's webhook attempt log and the matching Cloudflare deployment. A successful delivery includes the Cloudflare deployment ID. Check the build result as well: an accepted webhook alone does not prove that the website was rebuilt. GitHub pushes continue to deploy independently.

All services must stay within their current free quotas. No architecture can guarantee unlimited capacity or permanently unchanged free-plan terms.

## Deployed copy — 19 October 2026

Public duplicate: https://athenawomensnews.pages.dev/

The original Railway site also received the separately requested 19 October news article. No original hosting configuration or DNS was changed. The duplicate now contains 46 published articles, with the original routes, dates and public templates verified. Git pushes to `duplicate/cloudflare` rebuild the Pages website automatically.

The independent Sanity Studio is https://athena-newsroom.pages.dev/ on Cloudflare Pages. It builds from `duplicate/studio` with `npm run build && cp static/_headers dist/_headers`, output `dist`. Its public shell contains no write credentials. The Studio is registered with Sanity project `lq6cok1w`, and its exact HTTPS origin has managed CORS access with credentials. Editors sign in with their Sanity accounts.

Supabase received the saved legacy reader and daily traffic records in private, RLS-protected tables. Passwords and sessions were not copied. Reader signup stays disabled until a real email delivery provider or approved OAuth provider is configured and tested. The connected Resend account currently has no verified sender domain.

Sanity import is complete: 46 published articles and 101 reviewed image references. Fourteen original Railway images have independent local copies and Sanity assets; 87 existing external image addresses and their credits are preserved. Article text, dates, authors, categories and photo credits were compared with the source copy. Article bodies contain no link annotations. The temporary import credential expires on 20 October 2026 and is not stored in this repository or in Cloudflare.

Pages now uses `CONTENT_SOURCE=sanity` and `PUBLIC_SANITY_STUDIO_URL=https://athena-newsroom.pages.dev`. The build supports both original calendar-only dates and full timestamps, with all 46 original article routes verified. Sanity images are copied into the static website during each build. No reader request needs the original Railway service.

## Automatic publishing — 20 October 2026

The deploy hook was created through the authenticated Cloudflare API, without dashboard sign-in or an additional API token. Sanity's enabled webhook targets that hook. An unchanged-content republication preserved the article's original date and received HTTP 200 from Cloudflare at 05:16 UTC; Cloudflare created deployment `144609d5-87da-4f13-8902-f882d4173663` with trigger type `deploy_hook`. That deployment completed successfully at 05:16:40 UTC. Draft edits did not start deployments.

Reader login remains disabled pending a verified email sender or approved OAuth provider. The duplicate was excluded from search indexing during initial setup; the current search status is recorded below. The original Railway publishing and hosting configuration are unchanged.

## Publishing and search visibility — 21 October 2026

The 20 October story, “Trump orders a new women’s-health division. Funding will determine what it can deliver.”, is live at `/article/trump-womens-health-division-funding/`. Its original publication timestamp is preserved. The article has no body links and uses a credited, contextual NIH archive photograph. Publishing it in Sanity automatically produced successful Pages deployment `dde47c29-d0f1-4e17-b1f4-59387ea45aac`. The live build contains 47 articles.

Production `SITE_NOINDEX=false` now permits crawling. Public pages have index/follow metadata; account pages retain noindex. The live sitemap index, full sitemap, recent-news sitemap and robots.txt were checked. The new story appears in the article and news sitemaps. Navigation advertises `/rss.xml`, which redirects to the existing `/feed.xml` for compatibility; the feed contains all 47 articles.

Google's HTML verification tag is deployed through `GOOGLE_SITE_VERIFICATION`. The new URL-prefix property was added, but ownership verification and sitemap submission are still pending: Search Console sign-in returned a 400 error in the cloud browser. The original Railway property was not changed.

Bing ownership verification succeeded on 21 October using `web/public/BingSiteAuth.xml`; retain that file. The verified dashboard is accessible. Submitting `https://athenawomensnews.pages.dev/sitemap-index.xml` returned “An unexpected error occurred on the server side” twice, including one retry after checking that no sitemap was stored. Sitemap submission is therefore not complete. The same sitemap is advertised in robots.txt for crawler discovery. Verification and sitemap availability do not guarantee indexing.

The newsletter panels now embed the native form for the confirmed publication `https://athenawomennews.substack.com`, with a direct signup link. Both the embedded and direct signup pages displayed “Site Unavailable” in this cloud browser, so subscription storage and email delivery have not passed an end-to-end test. No test email was submitted or newsletter sent. A Substack embed alone does not send a newsletter when an article is published in Sanity; newsletter publication remains a separate workflow.

Reader authentication remains disabled pending its provider setup and end-to-end checks. No Railway content or configuration was changed during these 20–21 October publishing and SEO updates.
