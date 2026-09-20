# Portfol.io — Public Resource & Open Source Readiness Blueprint

This document tracks what's been fixed toward making Portfol.io a production-grade, secure, and community-friendly open-source resource, and what's still genuinely open. It's updated in place rather than left stale — treat it as current status, not a historical snapshot.

---

## Executive Summary

**Portfol.io** converts a resume (PDF/DOCX, or pasted text) into a customized, single-page portfolio website using Gemini and deploys it directly to GitHub Pages, plus generates tailored cover letters and an ATS resume review.

Of the five areas originally flagged, security, testing/CI, and pre-deployment UX are now addressed. What's left is mostly open-source project hygiene (license, contributing docs) and a couple of deeper architectural choices that were deliberately deferred rather than left unexamined.

1. ~~Security & Auth Vulnerabilities~~ — ✅ Resolved (see §1)
2. Architectural Bottlenecks — ⚠️ Mostly resolved; one documented, deliberate tradeoff remains (see §2)
3. ~~User Experience & Customization~~ — ✅ Resolved (see §3)
4. Developer Experience & Operations — ⚠️ Testing/CI done; Docker and lint tooling still open (see §4)
5. Open Source Governance — ❌ Still open (see §5)

---

## 1. Security & Data Protection — ✅ Resolved

| Issue | Status | Notes |
| :--- | :---: | :--- |
| **OAuth State & CSRF** | ✅ Fixed | `state` is a signed JWT (`sessionId` + repo choice), verified on callback. |
| **Over-Privileged OAuth Scope** | ✅ Fixed | Deploy uses `public_repo`; the separate optional sign-in flow uses only `gist` — nothing broader. |
| **Missing Rate Limiting** | ✅ Fixed | `express-rate-limit` on generation, auth, and sync endpoints. |
| **File Upload Vulnerabilities** | ⚠️ Partial | Extension + MIME `fileFilter` and a 10MB cap are in place; true magic-byte/content sniffing is still not implemented. Low real-world severity since `pdf-parse`/`mammoth` fail gracefully on non-matching content, but a genuine gap if someone wants to close it further. |
| **Template XSS Risk** | ✅ Fixed | `generator.js` previously defined escaped variables but used the raw unescaped values in several template spots (hero name/tagline/about/CTA, footer) — fixed, plus URL-scheme validation (`http(s)://` only) on every link and CSS-injection-proof color validation. |
| **Permissive CORS** | ✅ Fixed | `CORS_ORIGIN` env var restricts origins in production; open by default only for local dev. |
| **Hardcoded JWT fallback secret** | ✅ Fixed | Previously fell back to a hardcoded string if `JWT_SECRET` was unset; now generates a random per-process secret and warns instead. |

---

## 2. Architecture & Backend Robustness — ⚠️ Mostly resolved

- **In-Memory Session Store** — ⚠️ Partially addressed, deliberately.
  - Two of the three in-memory `Map`s (`pendingDeploys`, the sign-in handoff) were rewritten as short-lived signed JWTs, so they work correctly across separate serverless function instances (e.g. Vercel) with no shared memory needed.
  - `portfolioStore` (the generated HTML/theme/data between "Generate" and "Deploy") remains in-memory — it's too large to fit in a token. This is a known, documented tradeoff (see README → "Deploying to Vercel"), not an oversight. Fixing it fully means external storage (e.g. Vercel KV), which was intentionally not added to keep the project database-free.
- **Dead Code (`src/deploy.js`)** — ✅ Resolved. Populated, and further extended with `checkDeployTarget` (overwrite protection) and multi-portfolio project-site support.
- **Gemini API & AI Resilience** — ⚠️ Partial.
  - ✅ Model is configurable via `GEMINI_MODEL`.
  - ✅ Structured JSON output (`responseMimeType: "application/json"`) is used for all structured generations.
  - ❌ Still no automatic retry/backoff on Gemini API failures — a single transient error surfaces straight to the user.

---

## 3. Frontend & User Experience (UX/UI) — ✅ Resolved

- ✅ **Interactive Pre-Deployment Customization** — theme/color/title/favicon picker, plus an in-preview "Edit content" panel (name, tagline, about, CTA, skills, experience, projects) that re-renders instantly with no extra AI call.
- ✅ **Multiple Portfolio Styles** — four layout modes (Minimalism, Glassmorphism, Brutalism, Playful).
- ⚠️ **Deployment Progress Feedback** — generation has step-by-step progress; the deploy step itself is still a single OAuth redirect round-trip with no granular progress UI.
- ✅ **Accessibility** — body text and the hero CTA button's text color are computed against the real WCAG contrast formula for whatever background/primary is in play, AI-picked or custom.
- ❌ **Custom Domains** — no UI or guidance for configuring a `CNAME` on the deployed GitHub Pages site. Still open.

---

## 4. Developer Experience & Quality Assurance — ⚠️ Partially resolved

- ✅ **Automated Testing Suite** — 45+ tests via Node's built-in test runner (`node --test`), covering escaping/XSS, color and contrast logic, deploy repo resolution, profile-sync clamping, and endpoint contracts. (Jest/Vitest/Supertest were the original suggestion; the built-in runner was chosen instead to add zero new dependencies.)
- ✅ **CI/CD** — GitHub Actions runs the full suite on every push/PR across Node 20/22/24 (18 was dropped from the matrix — `@octokit/rest` v22 requires Node ≥ 20).
- ❌ **CLI Enhancement** (`--deploy` flag, interactive prompts) — still open; the CLI only builds `./dist/index.html` locally.
- ❌ **Docker & Containerization** — still open.
- ❌ **Static Analysis & Tooling** (ESLint, Prettier, Husky) — still open.

---

## 5. Open Source Standards & Documentation — ❌ Still open

- [ ] `LICENSE` file (MIT recommended)
- [ ] `CONTRIBUTING.md`
- [ ] `CODE_OF_CONDUCT.md`
- [ ] `SECURITY.md` (vulnerability reporting)
- [ ] GitHub Issue & PR templates (`.github/ISSUE_TEMPLATE/`)
- [ ] `package.json` metadata — repository URL, author, keywords, license identifier

None of this affects functionality or security; it's purely what's expected of a repo that wants outside contributors. Worth doing before actively promoting the project as a public/open-source resource.

---

## What Shipped Beyond the Original Scope

A few things weren't in the original blueprint at all:

- **Multi-portfolio deploys** — a named project deploys as a separate `username.github.io/project-name` site instead of overwriting the main profile, with a "My Portfolios" list tracking every one.
- **Overwrite protection** — deploying now detects and pauses on unrelated existing content at the target repo instead of silently overwriting it.
- **Resume Review tab** — ATS score plus grounded strengths/weaknesses/suggestions, independent of the cover-letter flow.
- **Paste-resume-text** as an alternative to file upload.
- **Save as PDF** — a dedicated print stylesheet and button on every generated portfolio.
- **Optional cross-device sync** — "Sign in with GitHub" backs up the resume summary, portfolio list, and cover-letter history to a secret Gist in the user's own account. No server-side database; the Gist *is* the store.
- **Vercel serverless deployment support** — `api/index.js` + `vercel.json`, with the tmpdir/stateless-JWT fixes described in §2.

---

## Recommended Next Steps

1. **If open-sourcing publicly**: add `LICENSE`, `CONTRIBUTING.md`, and the other §5 items — this is the only fully-open category left.
2. **If traffic grows**: revisit the `portfolioStore` in-memory tradeoff from §2 with real external storage.
3. **Nice-to-haves, no urgency**: Gemini retry/backoff, deploy-step progress UI, Docker, lint tooling, CNAME guidance.
