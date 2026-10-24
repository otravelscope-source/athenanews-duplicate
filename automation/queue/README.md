# ATHENA publishing queue

Only reviewed, publication-ready article JSON belongs here. This is a PUBLIC repository: never commit private editorial notes, personal data or secrets. The publisher never overwrites a published story. Research sources remain in separate Library editorial records.

Add one UTF-8 JSON file named after its actual Library file ID. Use this structure (replace every placeholder; do not submit this example):

```json
{
  "version": 1,
  "approved": true,
  "sourceLibraryId": "libfile_ACTUAL_ID",
  "topicKey": "stable-topic-and-event-date",
  "slug": "unique-article-slug",
  "title": "Complete article headline",
  "subtitle": "Optional subtitle",
  "author": "ATHENA",
  "category": "Justice",
  "publishedAt": "2026-10-24T06:00:00Z",
  "review": {"factsChecked": true, "duplicatesChecked": true, "imageRightsChecked": true},
  "paragraphs": [{"style":"normal", "text":"Complete clean article paragraph"}, {"style":"h2", "text":"Section heading"}, {"style":"normal", "text":"The Athena Perspective."}],
  "image": {"url":"https://upload.wikimedia.org/REVIEWED-ORIGINAL.jpg", "alt":"Descriptive alt text", "caption":"Accurate caption with archive/context date where relevant", "credit":"Photographer / Wikimedia Commons", "license":"Public domain", "sourceUrl":"https://commons.wikimedia.org/wiki/File:ACTUAL_FILE.jpg"}
}
```

Read automation/publish.mjs for the exact validation contract. Categories: World, Health, Justice, Culture, Children, Perspectives. Keep original reporting dates. Verify facts and image reuse rights; flags attest to completed human/agent editorial review, they do not perform fact checking. No links, citations or reference lists in article prose. Use at least three verified images; use a lead image plus at least two distinct inline images. Never invent quotes or reporting. End with The Athena Perspective.

Queue commits trigger publishing when the workflow is installed on main. Scheduled runs are 06:00,12:00,18:00 UTC (09:00,15:00,21:00 Kampala). GitHub may delay runs. Today gets priority, followed by up to three eligible archives. Existing CMS slug/title/Library ID/topic key are checked; editors must also check topic overlap against live articles. Failed deployment verification is reported as failure, not publication success. Check Actions job summaries and the live site after each handoff. A failed run can be retried; createIfNotExists protects existing articles.

Credentials: SANITY_WRITE_TOKEN is a GitHub Actions repository secret, expires 22 January 2027. Renew before expiry. Original Railway deployment is not involved. Cloudflare production remains on duplicate/cloudflare; the Sanity webhook triggers its rebuild.


## Multiple photographs

Supply `inlineImages` as an array of at least two image objects with the same metadata as `image`, plus integer `afterParagraph` (zero-based position in `paragraphs`). Put images between relevant paragraphs, before the closing line. Use 3–6 distinct photographs total. Do not duplicate an image or invent a licence to meet the count. Hold the article if three relevant authorised images cannot be found. Archive/contextual photographs must carry accurate dates and explicit labels. Source and licence links are emitted on the photo-credits page, not in reader-facing prose.
