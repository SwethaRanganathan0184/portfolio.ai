# Portfol.io — AI Portfolio & Cover Letter Suite

Portfol.io is an all-in-one AI companion that turns your resume into a beautiful, deployable portfolio website and tailored cover letters in seconds. 

---

## Features

- 💻 **AI Portfolio Generator**: Upload a PDF/DOCX resume — or paste resume text directly (handy if you're copying from LinkedIn or a Google Doc) — pick a theme, optionally set a page title/favicon and a 3-color palette (primary / accent / background), and generate a fully designed portfolio.
- 🧭 **Resume Review**: A separate tab scores your resume's ATS-friendliness (0-100) and lists specific, grounded strengths, weaknesses, and suggestions — no job description needed, just an honest read on the resume itself.
- 🖨️ **Save as PDF**: Every generated portfolio ships with a print button and a dedicated print stylesheet (light colors, no nav/backdrop blur, no wasted ink) so "Save as PDF" from the browser's print dialog produces a clean one-pager.
- 📚 **My Portfolios List**: The Profile tab tracks every site you've deployed — not just the last one — so multiple project-page deploys (see below) show up as a proper list with an Open link for each.
- 🎨 **Premium Styling Options**: Supports four visually striking layout modes: **Minimalism**, **Glassmorphism**, **Brutalism**, and **Playful**, fully integrated with Lenis smooth scrolling and GSAP animations. Leave colors on "AI-picked" and Gemini chooses a palette that matches your professional profile — or flip on the custom-color toggle to set your own primary/accent/background colors.
- 🔗 **Icon-Linked Contact Section**: Email, phone, GitHub, LinkedIn, and personal website are each rendered with their own icon when present in the resume.
- 📝 **Tailored Cover Letter Generator**: Paste a target Job Description to generate an ATS-optimized, professional cover letter highlighting matching accomplishments from your resume.
- 👤 **Candidate Profile Dashboard**: View your latest uploaded resume details (tagline, skills), keep track of your live portfolio link, and manage your cover letter generation history.
- ✏️ **Edit Before You Deploy**: Click **Edit content** in the preview to fix a wrong AI guess — name, tagline, about, CTA, skills, experience, and project entries are all editable, and "Apply changes to preview" re-renders instantly without another AI call.
- 🖼️ **Multiple Portfolios, One GitHub Account**: Deploying always targets `username.github.io` by default (GitHub's one-per-account "user site"). Give a deploy a project name instead (e.g. `side-project`) to publish it as a separate site at `username.github.io/side-project`, so you can keep more than one portfolio live at once.
- 🛡️ **Overwrite Protection**: If `username.github.io` already has content Portfol.io didn't create, deploying pauses and asks you to confirm before overwriting it, instead of silently clobbering an existing site.
- ♿ **Contrast-Checked Themes**: Body text and the hero call-to-action button's text color are computed against the actual resolved background/primary color (AI-picked or custom) using the real WCAG contrast formula, so an unusual palette can't accidentally produce unreadable text.
- 🔒 **Privacy-First State**: Your resume summary, deployment status, and cover letter archives are stored completely offline in your browser's `localStorage`. No personal data is persisted on server databases.
- 🔁 **Optional Cross-Device Sync**: Click **Sign in with GitHub** in the Profile tab to back that same local state up to a secret Gist in *your own* GitHub account and restore it on another device — see [Syncing Across Devices](#syncing-across-devices) for exactly what that means and doesn't mean.
- 🚀 **Zero-Backend Output, One-Click Deploy**: The generated portfolio is a single self-contained static HTML file — no server or database required to host it. Click **Deploy to GitHub Pages** for an automatic one-click publish, or download the file and drag it into Vercel, Netlify, or any static host.

---

## Tech Stack

- **Backend** — Node.js + Express
- **AI Engine** — Google Gemini 2.5 Flash / 1.5 Flash (via `@google/generative-ai`)
- **Resume Parsing** — `pdf-parse`, `mammoth`
- **GitHub API Deployment** — GitHub OAuth + `@octokit/rest`
- **Frontend** — Vanilla HTML, CSS, JavaScript (tabs, localStorage sync)
- **Scroller & Animation** — Lenis + GSAP (dynamic motion control)
- **Security** — `express-rate-limit`, JWT state CSRF signatures (random per-process secret if `JWT_SECRET` isn't set), down-scoped OAuth scopes (`public_repo` for deploy, `gist` — nothing else — for the optional profile sync sign-in), file filters, consistent HTML-escaping and URL-scheme validation (`http(s)://` only) across all user- and AI-supplied content injected into the generated portfolio, configurable CORS origin restriction
- **Testing** — Node's built-in test runner (`node --test`, no extra dependency), GitHub Actions CI on every push/PR


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

**Gemini API key (free):**
1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Click "Get API Key" → "Create API key in new project"
3. Copy the key

**GitHub OAuth credentials (free):**
1. Go to [github.com/settings/developers](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in:
   - Application name: `Portfol.io`
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3000/auth/callback`
4. Copy the Client ID and generate a Client Secret

### 4. Create your .env file

Copy `.env.example` to `.env` and fill in your keys:
```bash
cp .env.example .env
```
```
GEMINI_API_KEY=your_gemini_api_key_here
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here

# Optional — a random secret is generated per-process if you omit this.
# Set it explicitly in production so OAuth "deploy" links survive server
# restarts and work across multiple instances.
JWT_SECRET=a_long_random_string

# Optional — restricts which origins may call the API in production.
# Comma-separated list. Omit to allow all origins (fine for local dev).
CORS_ORIGIN=https://portfol.io
```

### 5. Run the app
```bash
npm run server
```

Open your browser and go to `http://localhost:3000`

### 6. Run the tests (optional)
```bash
npm test
```
Uses Node's built-in test runner — no extra dependency to install. CI runs the same command on every push/PR via GitHub Actions.

---

## Deploying to Production

Whichever host you use, update your GitHub OAuth App settings first:

- Homepage URL → your live domain e.g. `https://portfol.io`
- Authorization callback URL → `https://portfol.io/auth/callback`

Then add your environment variables in the hosting platform's dashboard instead of a `.env` file. In particular, set `JWT_SECRET` (so OAuth deploy/sign-in links keep working across restarts and multiple instances) and `CORS_ORIGIN` (comma-separated list of allowed origins — omitting it allows all origins, which is fine for local dev but not recommended in production).

### Deploying to Vercel

This repo is already set up for it — `api/index.js` re-exports the Express app from `src/app.js` (which never calls `.listen()`, so it's already shaped as a request handler), and `vercel.json` rewrites every path to that one function.

1. Push the repo to GitHub, then [import it on Vercel](https://vercel.com/new) — it needs no framework preset, the included `vercel.json`/`api/index.js` are enough.
2. In the Vercel project's **Settings → Environment Variables**, add: `GEMINI_API_KEY`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and **`JWT_SECRET`** (see the callout below — this one isn't optional here). `CORS_ORIGIN` and `GEMINI_MODEL` are optional as elsewhere.
3. Once you have your `*.vercel.app` URL (or a custom domain), update the GitHub OAuth App's Homepage URL and Authorization callback URL to point at it (`https://your-app.vercel.app/auth/callback`), per the section above.
4. Redeploy so the new callback URL and env vars take effect.

**Why `JWT_SECRET` is required, not just recommended, here:** Vercel serverless functions are stateless and short-lived — a request can land on a different function instance than the one before it, with no memory shared between them. If `JWT_SECRET` is left unset, this app falls back to a random secret generated fresh per instance; a state token signed by one instance would then fail to verify on another, causing OAuth deploys and sign-ins to fail intermittently and confusingly. Set it explicitly and every instance agrees on the same secret.

Because of that same statelessness, two flows in this app that used to hold data in a plain in-memory `Map` — the deploy overwrite-confirmation step and the "Sign in with GitHub" handoff — were rewritten as short-lived signed JWTs instead, specifically so they don't depend on hitting the same server instance twice. One piece of state remains genuinely in-memory: `portfolioStore`, which holds the full generated HTML between "Generate" and "Deploy"/"Apply changes" (too large to fit in a token). In practice this works fine for typical single-user usage — Vercel tends to keep a function instance warm for the short window between those actions — but it isn't *guaranteed*, and a cold start or concurrent traffic can occasionally produce a "Portfolio session expired. Please generate again." error even on a fresh session. If that turns out to matter for your traffic, the fix is to move that store to an external cache (e.g. Vercel KV) — a small, well-contained change if you ever want it, but not something this project takes on by default given the "no database" design goal.

---

## Project Structure
```
portfolio-gen/
├── src/
│   ├── extract.js      # Resume text extraction (PDF + DOCX)
│   ├── ai.js           # Gemini AI content + theme generation
│   ├── generator.js    # HTML portfolio generation (+ WCAG contrast checks)
│   ├── deploy.js       # GitHub Pages deployment (user-site + multi-portfolio project-site)
│   ├── profileSync.js  # Cross-device profile sync via a secret Gist (no database)
│   └── app.js          # Express app: routes, rate limiting, CORS, OAuth
├── public/
│   └── index.html      # Frontend web app
├── api/
│   └── index.js         # Vercel serverless entry point (re-exports src/app.js)
├── test/                # node:test suite (generator, deploy, profileSync, app)
├── .github/workflows/   # CI: runs `npm test` on push/PR
├── vercel.json           # Vercel routing + function config
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
- Signing in on another device fetches that Gist and merges it into that browser's `localStorage`, restoring your dashboard.
- "Sign out" doesn't just forget the token locally — it calls GitHub's API to actually revoke the OAuth grant.

Two tradeoffs worth knowing before you rely on this:

1. **The GitHub token lives in `localStorage`.** With no server session to hold it instead, the token itself *is* the session — every sync request sends it. If this page were ever compromised by an XSS bug or a malicious browser extension, that token could be read. It only grants `gist` access (no repos, no account changes), and revoking it any time via GitHub's [Settings → Applications](https://github.com/settings/applications) immediately kills it.
2. **A "secret" Gist is unlisted, not private.** GitHub doesn't index or search it, but anyone who obtains the exact URL can view it. This is a materially different privacy bar than "nothing leaves your browser" — acceptable for a resume summary and cover letter drafts, but go in with that expectation.

If neither tradeoff sits well with you, just don't sign in — everything works exactly as before, entirely local to your browser.

---

## Usage Notes

- Gemini free tier allows 1,500 requests per day — more than enough for personal use
- Generated portfolios include dark/light mode toggle
- Portfolios are mobile responsive out of the box
- No data is stored — resumes are deleted immediately after processing
- Deploying always targets `username.github.io` unless you give it a project name in the deploy dialog — that reserved repo name is GitHub's one-per-account "user site," so it's also the only URL a plain deploy will ever reuse
- If `username.github.io` already has unrelated content when you deploy (e.g. an existing personal site), you'll be asked to confirm before it's overwritten
- Editing content in the preview and clicking "Apply changes" doesn't call the AI again — it's a free, instant re-render using the same extracted data

---

## Contributing

Pull requests are welcome. For major changes please open an issue first.

---

Built with ✦ by [Swetha](https://github.com/SwethaRanganathan0184) and [Naveen S](https://github.com/nh-44)
