# Site editor setup

The site now lives under the **TAMUHOSA** GitHub account (github.com/TAMUHOSA/TAMUHOSA),
with RyLaptop added as a collaborator. The site is editable at `/admin/` by anyone
signed in to a GitHub account with push access to this repo.

## 1. Make sure GitHub Pages is on
Repo → Settings → Pages → Source: deploy from branch `main`, folder `/ (root)`.
Note the URL it gives you (usually `https://tamuhosa.github.io/TAMUHOSA/`) — you need it below.

## 2. Create a GitHub OAuth App
GitHub → Settings (your profile menu, not the repo) → Developer settings → OAuth Apps → New OAuth App.
- **Application name**: TAMU HOSA Site Editor
- **Homepage URL**: your Pages URL from step 1
- **Authorization callback URL**: `https://tamuhosa-oauth.<your-subdomain>.workers.dev/callback` — you won't know the exact subdomain until step 3, so save this OAuth App as a draft with a placeholder and come back to fix the callback URL after step 3.
- Click **Register application**, then **Generate a new client secret**. Copy the **Client ID** and **Client Secret** somewhere safe — you need both in step 3.

## 3. Deploy the OAuth relay to Cloudflare
This is the small worker in `oauth-worker/worker.js` — it's the only piece that touches your GitHub secret, and it never sees your site content.
1. Sign in at dash.cloudflare.com (free account is fine).
2. Workers & Pages → Create → Create Worker → **Start with Hello World!** (a blank script — do not pick an "import a repository" option, it deploys the repo as a static site and ignores the code below).
3. Click **Edit code**, delete the placeholder, paste in everything from `oauth-worker/worker.js`, click **Deploy**.
4. Worker → Settings → Variables and Secrets → Add:
   - `GITHUB_CLIENT_ID` = the Client ID from step 2 (plain variable is fine)
   - `GITHUB_CLIENT_SECRET` = the Client Secret from step 2 (mark it **Encrypt**)
5. Copy the worker's URL (looks like `https://tamuhosa-oauth.<something>.workers.dev`).
6. Go back to the OAuth App from step 2 and fix the **Authorization callback URL** to `<that worker URL>/callback`, then Save.

## 4. Point the site's editor at the worker
Open `admin/config.yml` in this repo, find the line:
```
base_url: https://REPLACE-WITH-YOUR-WORKER.workers.dev
```
Replace it with your real worker URL from step 3, then commit and push to `main`.

## 5. Log in
Visit `<your Pages URL>/admin/`, click **Login with GitHub**, approve access. You're editing the live site — every save creates a commit and GitHub Pages republishes automatically within a minute or two.

---

### Current live setup (as of this migration)
- Repo: `TAMUHOSA/TAMUHOSA`
- Pages URL: `https://tamuhosa.github.io/TAMUHOSA/` (confirm exact casing/URL once Pages finishes its first build)
- OAuth relay: `https://tamuhosa-oauth.rylanlat.workers.dev` (unchanged, repo-agnostic — same worker works for any repo)
- OAuth App "TAMU HOSA Site Editor" is registered under RyLaptop's personal GitHub account; only its Homepage URL needed updating after the move, the callback stays the same.

### Handing this off to a future officer
Steps 1–4 are one-time. A new officer needs a GitHub account added as a collaborator on `TAMUHOSA/TAMUHOSA` (Settings → Collaborators), or use the shared TAMUHOSA account's own login, then go straight to `/admin/`.

### If something breaks
- **"This browser doesn't have edit access"**: the GitHub account logging in isn't a collaborator on this repo. Add them under Settings → Collaborators. A pending invite must be accepted by the invitee (check github.com/notifications or the email GitHub sends) before it grants access.
- **Login button does nothing / popup blocked**: allow popups for the Pages URL.
- **Worker changed URLs**: update both the OAuth App's callback URL (step 2) and `admin/config.yml`'s `base_url` (step 4) to match.
