# ATHENA independent news website

Start with [START-HERE.md](START-HERE.md). Deployment and maintenance instructions are in [DEPLOYMENT.md](DEPLOYMENT.md).

Node.js 24.19+ (24.x). No npm dependencies. Local setup: `cp .env.example .env`, `npm run setup -- YOUR_EMAIL`, then `npm start`.

Run `npm test` for HTTP integration tests. The application uses its own password login, local SQLite database and disk image uploads. It has no runtime dependency on ChatGPT, Sites or Canva.

## Article presentation

ATHENA publishes clean news prose: attribute sources within sentences and keep URLs,
linked citations, footnotes and reference lists outside publishable copy. Preserve
material qualifications and the exact closing, The Athena Perspective.

The shared article renderer removes legacy reference apparatus from all public
articles and editorial previews, including records that exist only in SQLite.
Original editorial bodies remain available in the authenticated studio and export
for verification; this presentation change does not modify dates or revisions.

Keep image assets and plain captions with photographer credits and original dates.
Retain required image source/licence URLs in the cover credit or inline image's
caption metadata. The public /photo-credits page exposes those details separately
from article prose. Do not place reporting references in image credit fields.
