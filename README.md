# Portfol.io — AI Portfolio & Cover Letter Suite

Portfol.io is an all-in-one AI companion that turns your resume into a beautiful, deployable portfolio website and tailored cover letters in seconds.

Upload a resume, pick a look, and get a single self-contained HTML file you can publish to GitHub Pages in one click — with no database and nothing of yours stored on a server.

**Contents:** [Features](#features) · [Tech Stack](#tech-stack) · [Setup](#setup) · [Configuration](#configuration) · [Command-Line Usage](#command-line-usage) · [Deploying to Production](#deploying-to-production) · [API Reference](#api-reference) · [Security and Privacy](#security-and-privacy) · [Project Structure](#project-structure) · [Syncing Across Devices](#syncing-across-devices) · [Limits and Usage Notes](#limits-and-usage-notes)

---

## Features

### Generate a portfolio

- 💻 **AI Portfolio Generator**: Upload a PDF/DOCX resume — or paste resume text directly (handy if you're copying from LinkedIn or a Google Doc) — pick a theme, and generate a fully designed portfolio. The AI rewrites your experience with strong, ATS-friendly phrasing while being instructed never to inflate roles or invent credentials.
- 🧱 **Structured, validated AI output**: Content and theme come back through Groq's strict JSON Schema mode, so the page is always built from well-formed data rather than free text that has to be guessed at.
- 🏅 **Certifications**: Certifications, licenses and awards named in your resume are pulled into their own section.
- 🔗 **Icon-Linked Contact Section**: Email, phone, GitHub, LinkedIn, and personal website are each rendered with their own icon when present in the resume — plus up to 6 **extra links** of your own (X/Twitter, YouTube, Instagram, Dribbble and blog links on Medium, dev.to, Hashnode or Substack get matching icons automatically).
- 🚀 **Zero-Backend Output**: The generated portfolio is a single self-contained static HTML file — no server or database required to host it.

### Design and personalize

- 🎨 **Eight Distinct Visual Styles**, each a full design layer with its own typography, not just recolored corners: **Minimalism** (light/bold type contrast, numbered sections, monochrome), **Glassmorphism** (frosted panels and a floating pill nav over a blurred, palette-colored backdrop), **Brutalism** (uppercase Space Grotesk, Space Mono labels, hard offset shadows), **Playful** (rounded Fredoka type, candy-colored tilted cards, wavy underlines), **Editorial** (Playfair headlines, drop caps, two-column ruled text), **Terminal** (shell prompts, a blinking cursor, CRT scanlines in dark mode), **Bento** (the whole page as a grid of rounded tiles), and **Neon** (glowing Orbitron type over a synthwave horizon grid). All work in light and dark mode, with Lenis smooth scrolling and GSAP animations.
- 🌈 **AI-picked or custom colors**: Leave colors on "AI-picked" and the AI chooses a light and dark palette that matches your professional profile — or flip on the custom-color toggle to set your own primary/accent/background colors.
- 🪄 **Describe your own look**: Write a short design brief ("bohemian, warm brown and terracotta, soft rounded edges") and the AI restyles the page — palette, type feel, shapes and decorative touches — on top of the theme you picked. The result is CSS only, and it's sanitized before it's embedded.
- 🧩 **Personalization**:
  - **Sections**: show, hide, rename ("Projects" → "Selected Work"), and reorder them. The nav follows along, and sections with nothing to show are skipped automatically.
  - **Profile photo**: upload one and it's cropped and resized in your browser, then embedded in the hero and styled to match each theme.
  - **Font pairings**: Modern, Editorial, Geometric, Friendly, Technical, and Elegant all override the AI's pick.
  - **Main button text**: set your own instead of "Get in touch".
  - **Page title and favicon**: the favicon can be an emoji, an image URL, or an **uploaded image**. Uploads are resized in your browser to a 64×64 PNG and embedded right in the page, so the portfolio stays a single file with nothing extra to host.
- ⚡ **Apply design changes without regenerating**: after the first generation, change the theme, fonts, sections, links, or photo and re-apply instantly. Your resume data and AI theme are cached, so there's no new AI call (unless you change the design brief).
- ♿ **Contrast-Checked Themes**: Body text and the hero call-to-action button's text color are computed against the actual resolved background/primary color (AI-picked or custom) using the real WCAG contrast formula, so an unusual palette can't accidentally produce unreadable text.

### Review, edit and export

- 👀 **Live preview**: See the finished portfolio before it goes anywhere, in a sandboxed frame isolated from the rest of the app.
- ✏️ **Edit Before You Deploy**: Click **Edit content** in the preview to fix a wrong AI guess — name, tagline, about, CTA, skills, experience, and project entries are all editable, and "Apply changes to preview" re-renders instantly without another AI call.
- ⬇️ **Download the HTML**: Take the file and drag it into Vercel, Netlify, or any static host.
- 🖨️ **Save as PDF**: Every generated portfolio ships with a print button and a dedicated print stylesheet (light colors, no nav/backdrop blur, no wasted ink) so "Save as PDF" from the browser's print dialog produces a clean one-pager.
- 🌗 **Dark/light toggle and responsive layout** built into every generated portfolio.

### Publish

- 🌍 **One-Click Deploy to GitHub Pages**: Click **Deploy to GitHub Pages**, authorize once, and the site is published to your own GitHub account.
- 🖼️ **Multiple Portfolios, One GitHub Account**: Deploying targets `username.github.io` by default (GitHub's one-per-account "user site"). Give a deploy a project name instead (e.g. `side-project`) to publish it as a separate site at `username.github.io/side-project`, so you can keep more than one portfolio live at once.
- 🛡️ **Overwrite Protection**: If the target repo already has content Portfol.io didn't create, deploying pauses and asks you to confirm before overwriting it, instead of silently clobbering an existing site.
- 🔑 **Signed in once**: A successful deploy continues straight into the profile-sync sign-in, so you aren't asked to log in to GitHub a second time on the Profile page.

### Cover letters and resume review

- 📝 **Tailored Cover Letter Generator**: Paste a target job description to generate a professional cover letter highlighting matching accomplishments from your resume — grounded strictly in what the resume says.
- 🧭 **Resume Review**: A separate tab scores your resume's ATS-friendliness (0-100) and lists specific, grounded strengths, weaknesses, and suggestions — no job description needed, just an honest read on the resume itself.

### Profile and sync

- 👤 **Candidate Profile Dashboard**: View your latest resume details (tagline, skills) and manage your cover letter history.
- 📚 **My Portfolios List**: The Profile tab tracks every site you've deployed — not just the last one — so multiple project-page deploys show up as a proper list with an Open link for each.
- 🔒 **Privacy-First State**: Your resume summary, deployment list, and cover letter archive are stored in your browser's `localStorage`. No personal data is persisted in a server database — there isn't one.
- 🔁 **Optional Cross-Device Sync**: Sign in with GitHub to back that same local state up to a secret Gist in *your own* GitHub account and restore it on another device. Signing in merges with what the browser already has rather than replacing it. See [Syncing Across Devices](#syncing-across-devices) for exactly what that means and doesn't mean.

### Built-in safeguards

- 🧯 **Clear errors, not stack traces**: unreadable files, scanned (image-only) PDFs, oversized uploads, rate limits and AI timeouts each get a plain explanation; raw upstream error text never reaches the browser.
- 🚦 **Rate limiting** per IP on every endpoint, with a tighter budget on anything that calls the AI.
- 🩺 **Deployment self-check** at `/healthz`, reporting which configuration is present.
- 🖥️ **Command-line mode** for generating a portfolio without running the web app — see [Command-Line Usage](#command-line-usage).

More detail on the security side is in [Security and Privacy](#security-and-privacy).

---

## Tech Stack

- **Backend** — Node.js (20+) + Express 5
- **AI Engine** — Groq (`openai/gpt-oss-120b` via `groq-sdk`), using Structured Outputs (strict JSON Schema) for guaranteed-valid resume/portfolio/review data
- **Resume Parsing** — `pdf-parse`, `mammoth`
- **GitHub API Deployment** — GitHub OAuth + `@octokit/rest`
- **Frontend** — Vanilla HTML, CSS, JavaScript in a single file (tabs, `localStorage` state)
- **Scroller & Animation** — Lenis + GSAP in the generated portfolios
- **Security** — `express-rate-limit`, `jsonwebtoken`, Node's built-in `crypto` (AES-256-GCM); see [Security and Privacy](#security-and-privacy)
- **Testing** — Node's built-in test runner (`node --test`, no extra dependency): 131 tests across the generator, deploy logic, profile sync, HTTP routes and the frontend. GitHub Actions runs them on Node 20, 22 and 24 for every push/PR, alongside a dependency audit job

---

## Setup

### 1. Clone the repo
```bash
git clone https://github.com/SwethaRanganathan0184/portfolio.ai.git
cd portfolio.ai
```

### 2. Install dependencies
```bash
npm install
```

### 3. Get your API keys

**Groq API key (free, no card required):**
1. Go to [console.groq.com/keys](https://console.groq.com/keys)
2. Sign up/sign in (Google or GitHub sign-in both work)
3. Click "Create API Key", copy it

**GitHub OAuth credentials (free):**
1. Go to [github.com/settings/developers](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in:
   - Application name: `Portfol.io`
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3000/auth/callback`
4. Copy the Client ID and generate a Client Secret

Register exactly one callback URL per OAuth app — the app relies on GitHub using the registered one. Use a separate OAuth app for local development and for production.

### 4. Create your .env file

Copy `.env.example` to `.env` and fill in your keys:
```bash
cp .env.example .env
```
```
GROQ_API_KEY=your_groq_api_key_here
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here
JWT_SECRET=a_long_random_string
```

See [Configuration](#configuration) for every variable.

### 5. Run the app
```bash
npm run server
```

Open your browser and go to `http://localhost:3000`

If a key is missing or still set to its placeholder, the server says so at startup and the features that need it report themselves as unavailable rather than failing obscurely.

### 6. Run the tests (optional)
```bash
npm test
```
Uses Node's built-in test runner — no extra dependency to install. The tests pin their own configuration and never call the real AI service, so they behave the same with or without a `.env`.

---

## Configuration

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `GROQ_API_KEY` | Yes | — | Groq API key used for every AI call. |
| `GITHUB_CLIENT_ID` | Yes | — | GitHub OAuth app client ID (deploy and sign-in). |
| `GITHUB_CLIENT_SECRET` | Yes | — | GitHub OAuth app client secret. |
| `JWT_SECRET` | In production | Random per process | Signs OAuth state and handoff tokens, and derives the key that encrypts GitHub tokens in transit. Must be set explicitly on serverless hosts. |
| `CORS_ORIGIN` | No | See below | Comma-separated origins allowed to call the API from another site. |
| `GROQ_MODEL` | No | `openai/gpt-oss-120b` | Overrides the model used for generation. |
| `RATE_LIMIT_GENERATE_MAX` | No | `10` | AI generations allowed per IP per 15 minutes. |
| `RATE_LIMIT_API_MAX` | No | `30` | Other API requests allowed per IP per 15 minutes. |
| `PORT` | No | `3000` | Port for `npm run server`. |

**`CORS_ORIGIN` when omitted:** local development allows all origins, while production (Vercel, or `NODE_ENV=production`) sends no CORS headers at all — same-origin only, which is everything the bundled frontend needs.

To generate a `JWT_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## Command-Line Usage

You can generate a portfolio without the web app. It needs only `GROQ_API_KEY` in your `.env`.

```bash
node index.js path/to/resume.pdf
node index.js resume.docx --style neon --title "Jane Doe" --favicon "🚀"
node index.js resume.pdf --colors "#7c6aff,#00e5cc,#080810"
```

| Option | Description |
| --- | --- |
| `-s, --style <style>` | One of `minimalism`, `glassmorphism`, `brutalism`, `playful`, `editorial`, `terminal`, `bento`, `neon`. Default `minimalism`. |
| `-t, --title <title>` | Custom page title. |
| `-f, --favicon <favicon>` | Emoji or image URL. |
| `-c, --colors <colors>` | Comma-separated `primary,accent,background`. |

The result is written to `./dist/index.html`. The CLI covers generation and theming; personalization, editing, the design brief and one-click deploy are in the web app.

---

## Deploying to Production

Whichever host you use, update your GitHub OAuth App settings first:

- Homepage URL → your live domain e.g. `https://portfol.io`
- Authorization callback URL → `https://portfol.io/auth/callback`

Then add your environment variables in the hosting platform's dashboard instead of a `.env` file. In particular, set `JWT_SECRET` (so OAuth deploy/sign-in links keep working across restarts and multiple instances).

Once it's deployed, open `/healthz` on your domain. It reports whether each piece of configuration is present — never the values — so you can confirm the deploy is wired up before trying a real generation:

```json
{ "ok": true, "ai": true, "githubOAuth": true, "jwtSecret": true, "corsOrigin": "same-origin" }
```

Any `false` there means that environment variable is missing or still set to its `.env.example` placeholder.

### Deploying to Vercel

This repo is already set up for it — `api/index.js` re-exports the Express app from `src/app.js` (which never calls `.listen()`, so it's already shaped as a request handler), and `vercel.json` rewrites every path to that one function and sets the baseline security headers.

1. Push the repo to GitHub, then [import it on Vercel](https://vercel.com/new) — it needs no framework preset, the included `vercel.json`/`api/index.js` are enough.
2. In the Vercel project's **Settings → Environment Variables**, add: `GROQ_API_KEY`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and **`JWT_SECRET`** (see the callout below — this one isn't optional here). The rest are optional as elsewhere.
3. Once you have your `*.vercel.app` URL (or a custom domain), update the GitHub OAuth App's Homepage URL and Authorization callback URL to point at it (`https://your-app.vercel.app/auth/callback`), per the section above.
4. Redeploy so the new callback URL and env vars take effect.
5. Open `https://your-app.vercel.app/healthz` and check every value is `true`, then run one real generate → deploy to confirm the whole path.

**Why `JWT_SECRET` is required, not just recommended, here:** Vercel serverless functions are stateless and short-lived — a request can land on a different function instance than the one before it, with no memory shared between them. If `JWT_SECRET` is left unset, this app falls back to a random secret generated fresh per instance; a state token signed by one instance would then fail to verify on another, causing OAuth deploys and sign-ins to fail intermittently and confusingly. Set it explicitly and every instance agrees on the same secret.

Because of that same statelessness, two flows in this app that used to hold data in a plain in-memory `Map` — the deploy overwrite-confirmation step and the "Sign in with GitHub" handoff — were rewritten as short-lived signed JWTs instead, specifically so they don't depend on hitting the same server instance twice. (Those JWTs travel in a URL, and a JWT is signed but not encrypted, so the GitHub token inside is separately encrypted with a key derived from `JWT_SECRET`, and each one is redeemable only by the browser it was issued to — both still fully stateless.)

Two things remain per-instance on serverless hosts:

- **Rate limiting.** `express-rate-limit` counts per function instance, so the limits are looser than the configured numbers suggest unless you give it a shared store.
- **The generated-portfolio store.** `portfolioStore` holds the full generated HTML between "Generate" and "Deploy"/"Apply changes" (too large to fit in a token). In practice this works fine for typical single-user usage — Vercel tends to keep a function instance warm for the short window between those actions — but it isn't *guaranteed*, and a cold start or concurrent traffic can occasionally produce a "Portfolio session expired. Please generate again." error even on a fresh session. If that turns out to matter for your traffic, the fix is to move that store to an external cache (e.g. Vercel KV) — a small, well-contained change if you ever want it, but not something this project takes on by default given the "no database" design goal.

---

## API Reference

The bundled frontend is the intended client; these are listed for contributors. All responses are JSON unless noted, and errors have the shape `{ "error": "message" }`.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/healthz` | Reports which configuration is present. |
| `POST` | `/generate` | Multipart: a `resume` file or `resumeText`, plus design options. Returns the portfolio HTML, extracted data and a `sessionId`. |
| `POST` | `/regenerate-html` | Re-renders a session with content edits or new design options. No AI call unless the design brief changed. |
| `POST` | `/generate-cover-letter` | `resumeText` + `jobDescription` → cover letter. |
| `POST` | `/generate-resume-review` | `resumeText` → ATS score, strengths, weaknesses, suggestions. |
| `GET` | `/auth/github` | Starts the deploy authorization (scope `public_repo`). Redirects to GitHub. |
| `GET` | `/auth/profile/github` | Starts the profile-sync sign-in (scope `gist`). Redirects to GitHub. |
| `GET` | `/auth/callback` | GitHub's redirect target for both flows. |
| `GET` | `/deploy/confirm` | Confirms or cancels overwriting a repo with existing content. |
| `GET` | `/auth/profile/session-token` | Exchanges the one-time sign-in handoff for the GitHub token. |
| `GET` / `PUT` | `/profile/sync` | Reads / writes the signed-in user's profile Gist. Bearer token required. |
| `POST` | `/auth/profile/signout` | Revokes the OAuth grant. Bearer token required. |

---

## Security and Privacy

- **No stored user data.** Uploaded resumes are deleted as soon as they've been read. Generated portfolios live in server memory for at most an hour and are never written to disk or a database.
- **Least-privilege GitHub access.** Deploying and syncing are two separate authorizations on purpose. The deploy token (`public_repo`) is used once on the server and never stored; the token kept in the browser for sync has only the `gist` scope.
- **OAuth flows are bound to your browser.** An HttpOnly, `SameSite=Lax` cookie identifies the browser that started a flow, and its hash is embedded in the signed `state`. A flow can only be finished — and a portfolio only deployed or restyled — from the browser that started it, which closes off both deploy CSRF and login CSRF.
- **Tokens are encrypted in transit through URLs.** Where a GitHub token has to cross a redirect, it's AES-256-GCM encrypted inside a short-lived signed JWT (60 seconds for sign-in, 5 minutes for overwrite confirmation).
- **Unguessable sessions.** Session IDs are cryptographically random, and a session answers only to the browser that created it.
- **Sandboxed preview.** The preview iframe runs without same-origin access, so nothing in a generated page can read the app's stored data.
- **Everything injected into a portfolio is escaped and validated**: consistent HTML-escaping, `http(s)://`-only URL validation, signature checks on uploaded images, and a sanitizer over AI-written CSS.
- **Bounded AI input.** Resume text, job descriptions and the design brief are all length-capped before they reach the model.
- **Safe error messages.** Upstream error text goes to the server log only.
- **Response headers.** `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` and a referrer policy on every response; `X-Powered-By` is removed.
- **Same-origin by default in production** (see `CORS_ORIGIN` in [Configuration](#configuration)).

Deploying and signing in need cookies enabled, because of the browser binding above.

---

## Project Structure
```
portfolio-gen/
├── src/
│   ├── extract.js      # Resume text extraction (PDF + DOCX)
│   ├── ai.js           # Groq AI: content, theme, custom CSS, cover letter, resume review
│   ├── generator.js    # HTML portfolio generation (+ WCAG contrast checks, CSS sanitizer)
│   ├── styles.js       # The eight visual style layers
│   ├── deploy.js       # GitHub Pages deployment (user-site + multi-portfolio project-site)
│   ├── profileSync.js  # Cross-device profile sync via a secret Gist (no database)
│   └── app.js          # Express app: routes, rate limiting, CORS, OAuth, error handling
├── public/
│   ├── index.html      # Frontend web app
│   └── favicon.svg, favicon.ico, apple-touch-icon.png
├── api/
│   └── index.js         # Vercel serverless entry point (re-exports src/app.js)
├── test/                # node:test suite (generator, deploy, profileSync, app, frontend)
├── .github/workflows/   # CI: tests on Node 20/22/24 + dependency audit
├── vercel.json           # Vercel routing, function config and security headers
├── server.js            # Thin entry point — starts src/app.js listening
├── index.js             # CLI entry point
├── .env.example          # Template for your local .env
└── .env                 # Your secret keys (never upload this)
```

---

## Syncing Across Devices

Portfol.io has no user database, no accounts table, no server-side sessions — that's a deliberate choice, not a missing feature. "Sign in with GitHub" in the Profile tab is a *stateless* sync mechanism built entirely on infrastructure the app already uses:

- On sign-in, a separate, narrowly-scoped OAuth request (scope `gist` — nothing else, no repo access at all) hands your browser a GitHub token.
- Your resume summary (name/tagline/email/skills — never the full resume text), the full list of every portfolio you've deployed (main profile plus any named projects), and your cover-letter history are written as one JSON file inside a **secret Gist in your own GitHub account**. That Gist *is* the database. There's nothing to back up, migrate, or lose on our end because there's nothing stored on our end. (Resume Review results are intentionally left out — they're cheap to regenerate and not worth syncing.)
- Signing in fetches that Gist and **merges** it with the browser's `localStorage` — portfolios by URL, cover letters by ID, and whichever resume summary is newer — then writes the merged result back. Nothing already in the browser is lost.
- A successful deploy continues straight into this sign-in, so you don't have to log in to GitHub twice. GitHub asks once for the extra gist permission. If you cancel it, or sign out later, that's remembered: later deploys won't ask again, and the Sign in button still works.
- "Sign out" doesn't just forget the token locally — it calls GitHub's API to actually revoke the OAuth grant. If GitHub ever rejects the stored token (revoked or expired), the app signs you out locally instead of failing silently.

Two tradeoffs worth knowing before you rely on this:

1. **The GitHub token lives in `localStorage`.** With no server session to hold it instead, the token itself *is* the session — every sync request sends it. If this page were ever compromised by an XSS bug or a malicious browser extension, that token could be read. It only grants `gist` access (no repos, no account changes), and revoking it any time via GitHub's [Settings → Applications](https://github.com/settings/applications) immediately kills it.
2. **A "secret" Gist is unlisted, not private.** GitHub doesn't index or search it, but anyone who obtains the exact URL can view it. This is a materially different privacy bar than "nothing leaves your browser" — acceptable for a resume summary and cover letter drafts, but go in with that expectation.

If neither tradeoff sits well with you, just don't sign in — everything works exactly as before, entirely local to your browser.

---

## Limits and Usage Notes

| Limit | Value |
| --- | --- |
| Resume upload | PDF or DOCX, up to 4MB |
| Resume text sent to the AI | 20,000 characters |
| Job description | 8,000 characters |
| Design brief | 1,500 characters |
| Extra contact links | 6 |
| AI generations | 10 per IP per 15 minutes |
| Other API requests | 30 per IP per 15 minutes |
| Generated portfolio kept for editing/deploy | 1 hour |
| AI time budget per request | 50 seconds |
| Synced history | 20 portfolios, 30 cover letters |

- Groq's free tier allows roughly 1,000 requests per day on `openai/gpt-oss-120b` — no credit card required, and comfortably enough for personal/public use at small-to-moderate traffic.
- The 4MB upload cap exists because Vercel rejects any request body over 4.5MB before it reaches the app; the limit sits below that with room for the profile photo and favicon sent in the same request. The browser checks the size before uploading, and larger resumes can be pasted as text instead.
- Scanned (image-only) PDFs contain no extractable text, so they're rejected with a message suggesting pasting the text instead, rather than being sent to the AI.
- AI calls time out after 20s and are retried automatically on rate-limit/server errors (built into `groq-sdk`). Because retries can stack across the up-to-three calls a generation makes, each request's AI work also shares the 50s budget above — under the 60s Vercel function limit set in `vercel.json` — so a slow AI day produces a readable "taking too long" error rather than a platform timeout page.
- Editing content in the preview and clicking "Apply changes" doesn't call the AI again — it's a free, instant re-render using the same extracted data. The one exception is changing the design brief, which triggers a new AI styling pass and counts toward the same rate limit as generating a portfolio.
- Deploying always targets `username.github.io` unless you give it a project name in the deploy dialog — that reserved repo name is GitHub's one-per-account "user site," so it's also the only URL a plain deploy will ever reuse.
- GitHub Pages is enabled on the repo's actual default branch, whatever your account names it.

---

## Contributing

Pull requests are welcome. For major changes please open an issue first.

---

Built with ✦ by [Swetha](https://github.com/SwethaRanganathan0184) and [Naveen S](https://github.com/nh-44)
