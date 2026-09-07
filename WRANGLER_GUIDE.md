# Deploying the admin Worker with Wrangler — step by step

This CMS is the same pattern as the Nirvana Biotech template: a small
Cloudflare Worker handles `/login`, `/verify`, and `/save`, and `/save`
commits the updated `data.json` (and any newly uploaded images) straight
to your GitHub Pages repo. The site itself stays a plain static site —
no server needed to serve pages, only to save edits.

## 0. What you need first

- Node.js installed (check with `node -v` — anything reasonably recent works)
- The `worker.js` and `wrangler.toml` files from this package, in their own folder
  (e.g. `manjushree-admin-worker/`)
- A GitHub repository this site will live in (e.g. `manjushreebiotech.github.io`
  for GitHub Pages), with these files pushed to it
- A GitHub **personal access token** with write access to that repo
  (`Settings → Developer settings → Personal access tokens → Fine-grained tokens`,
  grant it `Contents: Read and write` on the repo)
- A free Cloudflare account

## 1. Put the two files in their own folder

```
manjushree-admin-worker/
  worker.js
  wrangler.toml
```

Open a terminal, `cd` into that folder.

## 2. Fill in the non-secret config

Open `wrangler.toml` and replace the placeholders:

```toml
GITHUB_OWNER = "your-actual-github-username"
GITHUB_REPO = "manjushreebiotech.github.io"   # your real repo name
GITHUB_BRANCH = "main"
ALLOWED_ORIGIN = "https://your-real-domain.com"  # or your GitHub Pages URL
```

`ALLOWED_ORIGIN` must exactly match the origin the site is actually served
from (scheme + host, no trailing slash) — `https://manjushreebiotech.org`
and `https://www.manjushreebiotech.org` count as different origins.

## 3. Log in to Cloudflare via Wrangler

```bash
npx wrangler login
```

This opens a browser tab asking you to authorize Wrangler. Click **Allow**.

Verify it worked:

```bash
npx wrangler whoami
```

## 4. Set your secrets (passwords/tokens — never go in wrangler.toml)

Each prompts you to type/paste the value — it's never echoed or stored in a file:

```bash
npx wrangler secret put ADMIN_PASSWORD
```
→ the password you'll use to log into the site's admin mode.

```bash
npx wrangler secret put GITHUB_TOKEN
```
→ the GitHub personal access token from step 0.

```bash
npx wrangler secret put SESSION_SECRET
```
→ any random string (30+ characters) — signs login session tokens, you'll
never need to type it again.

## 5. Deploy

```bash
npx wrangler deploy
```

You should see output ending in something like:

```
Uploaded manjushree-biotech-admin (x.xx sec)
Deployed manjushree-biotech-admin triggers (x.xx sec)
  https://manjushree-biotech-admin.YOUR-SUBDOMAIN.workers.dev
```

## 6. Point the site at your Worker

Open `site.js` and find this line near the top:

```js
const ADMIN_API_BASE = "https://manjushree-biotech-admin.YOUR-SUBDOMAIN.workers.dev";
```

Replace it with the **exact URL** Wrangler printed in step 5, then redeploy
the website files (push to your GitHub Pages repo).

## 7. Confirm it works

```bash
npx wrangler secret list
```
should list `ADMIN_PASSWORD`, `GITHUB_TOKEN`, `SESSION_SECRET` (names only).

Then from a terminal (replace the password and origin):

```bash
curl -i -X POST https://manjushree-biotech-admin.YOUR-SUBDOMAIN.workers.dev/login \
  -H "Content-Type: application/json" \
  -H "Origin: https://your-real-domain.com" \
  -d '{"password":"your-admin-password"}'
```

Look for `access-control-allow-origin: https://your-real-domain.com` in the
response headers, and a JSON body containing a `token`.

## 8. Test from the actual site

Go to your live site, click **Admin** in the top-right, and enter the
password from step 4. Edit pencils should appear next to every editable
field, list, and image.

## If something doesn't work

Open DevTools (F12) → **Console** → click Login again → read the error:

- `CORS policy: No 'Access-Control-Allow-Origin'...` → `ALLOWED_ORIGIN` in
  `wrangler.toml` doesn't match the origin you're testing from, or the
  Worker hasn't redeployed since you changed it
- `Failed to fetch` / network error → `ADMIN_API_BASE` in `site.js` doesn't
  match your real Worker URL, or the Worker isn't deployed yet
- `401` / "Invalid password" → wrong password, or `ADMIN_PASSWORD` wasn't
  actually set before deploying
