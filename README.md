# Manjushree Biotech — website with in-place admin editing

A plain multipage static site with the same admin CMS pattern as the Nirvana
Biotech template: log in on the live site, edit text/lists/images directly
on the page, hit Save, and it's committed straight to your GitHub repo.

## Structure

```
index.html               Home
trading.html              Trading & Distribution
iso-consultation.html     ISO Consultation Services (Packages 01–03)
research.html             Research & Product Development (roadmap framing)
about.html                About (values + team, with photo upload)
contact.html               Contact
styles.css                 Shared design system + admin/edit-mode styling
site.js                    Shared behavior: data loading, nav, admin login/edit/save
data.json                  All editable content — this is what Save actually writes to
worker.js                  Cloudflare Worker — handles admin /login, /verify, /save
wrangler.toml               Worker config — fill in your GitHub repo & domain
WRANGLER_GUIDE.md           Step-by-step: deploying the Worker with Wrangler
```

Every page is plain HTML/CSS/JS — no build step. Works as-is on GitHub Pages.
The Worker is the only piece that needs separate deployment (it's what makes
Save actually persist changes — see below).

## Editing content — two ways

**1. In place, as an admin (once the Worker is deployed — see Setup below).**
Click **Admin** top-right, log in with your password. Every editable field
gets a small pencil button next to it — click it, change the text, Apply.
Lists (trading categories, ISO package items, team members, etc.) have
**+ Add** buttons and a **Remove** pencil on each item. A save bar appears
at the bottom — **Save changes** commits everything to GitHub at once;
**Discard** throws away unsaved edits and reloads the live version.

**2. Directly in `data.json`.** Every editable field on the site lives in
this one file. Open it, change values, commit — no admin login needed.
This is the simpler path if you're comfortable editing JSON directly, and
it's how you'd change deeper structural things the admin UI doesn't expose
(e.g. adding a fourth ISO package).

## What's real vs. placeholder

The **ISO Consultation** page content — the three packages, the process,
the "how we work" checklist — is drawn from your proposal document. Real
and ready to publish.

Everything else is placeholder, editable in place or in `data.json`:

- **Trading categories** — a reasonable starting list, not your actual catalogue.
- **Contact email/address** and the **contact form** — the form doesn't send
  anywhere yet; wire it to a backend or a service like Formspree.
- **Team section** on About — three empty slots with placeholder names/roles.
- **Logo** — no image yet. The nav shows a generated "MB" seal mark until you
  upload a real logo (Admin → the small "Logo" button under the brand mark).
- **Research & Development roadmap** — framed as direction, not a funded
  program with commitments.

## Setup — making Save actually work

Right now, logging in and editing works, but **Save will fail** until you
deploy the Worker and point the site at it. Two steps:

1. Follow `WRANGLER_GUIDE.md` to deploy `worker.js` to Cloudflare (free tier
   is enough). It needs a GitHub personal access token so it can commit
   `data.json` (and any uploaded images) back to your repo.
2. Open `site.js`, find `ADMIN_API_BASE` near the top, and set it to your
   deployed Worker's URL.

Until then, the Admin login button will show a "could not reach admin
server" error — that's expected, and it means the frontend is working
correctly and just doesn't have a backend to talk to yet.

## Design

- **Palette**: slate-charcoal background, ledger-paper cream for relief
  sections, brass accent, oxblood used sparingly (like a certification stamp).
- **Type**: Newsreader (serif headlines), IBM Plex Sans (body/UI), IBM Plex
  Mono (reference codes/labels — a nod to how ISO documentation is numbered).
- **Signature motif**: a "process rail" tracing the real four-stage ISO
  engagement pipeline (Gap Assessment → Documentation → Implementation →
  Audit Readiness) on Home and the ISO page, plus an animated line under
  each hero headline (decorative, not tied to content).

## Deploying

Push these files to the root of a GitHub Pages repo (or any static host).
The site itself needs no server. Only the admin Save feature needs the
Worker from `WRANGLER_GUIDE.md`.
