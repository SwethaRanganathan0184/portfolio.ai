const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const { extractText } = require("./extract");
const { generatePortfolioData, generateTheme, generateCoverLetter, generateResumeReview, generateCustomStyleCSS } = require("./ai");
const { generateHTML } = require("./generator");
const { deployToGitHubPages, checkDeployTarget, REPO_SLUG_RE } = require("./deploy");
const { getProfile, saveProfile, revokeToken } = require("./profileSync");

const app = express();

// On Vercel every request reaches us through Vercel's proxy, so without this
// req.ip is the proxy's address and express-rate-limit would put ALL users
// in one shared bucket. Only enabled where we know a trusted proxy sits in
// front — trusting X-Forwarded-For anywhere else would let a client spoof
// its IP and dodge the rate limits entirely.
if (process.env.VERCEL) {
  app.set("trust proxy", 1);
}

// A predictable/shared JWT secret would let an attacker forge the OAuth
// CSRF "state" token. Never fall back to a hardcoded string — generate a
// random per-process secret if the operator hasn't configured one.
if (!process.env.JWT_SECRET) {
  console.warn(
    "⚠ JWT_SECRET is not set in your .env — using a random secret for this process only.\n" +
    "  This is fine for local development, but set JWT_SECRET in production so OAuth\n" +
    "  state tokens remain valid across restarts and multiple server instances."
  );
}
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString("hex");

// ── Sealing GitHub tokens that have to travel through a URL ──
// A JWT is signed, not encrypted: anyone who sees one can base64-decode its
// payload. Two redirects in the OAuth flows have to carry the user's GitHub
// access token across a page load, and a URL ends up in request logs and
// browser history. So the token is AES-256-GCM encrypted before it goes into
// the JWT — a leaked URL then exposes only ciphertext. The key is derived
// from JWT_SECRET (domain-separated, so it's never the same bytes that sign
// the JWTs), which keeps this stateless across serverless instances.
const TOKEN_KEY = crypto.createHash("sha256").update("portfolio-gen:token-seal:" + JWT_SECRET).digest();

function sealAccessToken(accessToken) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", TOKEN_KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(String(accessToken), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
}

// Throws on anything that isn't a token sealed by this server (wrong key,
// tampered bytes, garbage) — callers treat that like any other bad token.
function openAccessToken(sealed) {
  const raw = Buffer.from(String(sealed || ""), "base64url");
  if (raw.length < 29) throw new Error("Malformed sealed token.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", TOKEN_KEY, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

// ── Browser binding (CSRF protection for the OAuth flows) ──
// Every browser gets a random ID in an HttpOnly cookie. A generated portfolio
// remembers which browser made it, and every OAuth state / handoff / confirm
// token carries a hash of that ID which must match the cookie of the browser
// presenting it. Without this, a signed `state` proves only that THIS SERVER
// issued it — not that the browser finishing the flow is the one that started
// it — so an attacker could start a flow themselves and trick someone else
// into completing it (publishing the attacker's portfolio to the victim's
// GitHub Pages, or signing the victim in to the attacker's profile gist).
// SameSite=Lax is what lets the cookie come back on GitHub's top-level
// redirect to /auth/callback while still being withheld from cross-site
// subrequests.
const BROWSER_COOKIE = "pf_bid";
const BROWSER_ID_RE = /^[A-Za-z0-9_-]{32,64}$/;

function readCookie(req, name) {
  for (const part of String(req.headers.cookie || "").split(";")) {
    const eq = part.indexOf("=");
    if (eq !== -1 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return "";
}

// Only the hash ever leaves the server (in tokens that pass through URLs), so
// seeing a token never reveals the cookie value needed to use it.
function browserHash(browserId) {
  return crypto.createHash("sha256").update("portfolio-gen:browser:" + browserId).digest("base64url");
}

function ensureBrowserId(req, res, next) {
  let id = readCookie(req, BROWSER_COOKIE);
  if (!BROWSER_ID_RE.test(id)) {
    id = crypto.randomBytes(24).toString("base64url");
    res.cookie(BROWSER_COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      secure: req.secure,
      path: "/",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }
  req.browserHash = browserHash(id);
  next();
}

function sameBrowser(req, expectedHash) {
  if (typeof expectedHash !== "string" || !expectedHash) return false;
  const a = Buffer.from(req.browserHash);
  const b = Buffer.from(expectedHash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ── AI time budget ──
// vercel.json kills the function at 60s, and a kill is an opaque platform 504
// the frontend can't explain. Each Groq call has its own 20s timeout, but
// with the SDK's retries a slow day can stack well past 60s across the up-to-
// three calls /generate makes. Racing the whole AI step against one deadline
// under the platform limit means the user always gets a real JSON error.
const AI_DEADLINE_MS = 50 * 1000;

class DeadlineError extends Error {}

function withDeadline(promise, ms = AI_DEADLINE_MS) {
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new DeadlineError("The AI service is taking too long to respond. Please try again in a minute.")),
      ms
    );
  });
  // The losing promise keeps running; make sure a late rejection from it
  // can't surface as an unhandled rejection after we've already responded.
  promise.catch(() => {});
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

// ── What a failed request tells the user ──
// Raw error messages are for the server log, not the response: an upstream
// SDK's message can carry request IDs, key hints or stack fragments. Routes
// throw a UserFacingError when the wording is ours and safe to show; anything
// else is translated by describeRouteError() below, with the route's own
// generic fallback for whatever it doesn't recognise.
class UserFacingError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function describeRouteError(err, fallback) {
  if (err instanceof UserFacingError) return { status: err.status, message: err.message };
  if (err instanceof DeadlineError) return { status: 504, message: err.message };
  if (err?.code === "AI_NOT_CONFIGURED") {
    return { status: 503, message: "AI generation isn't set up on this server yet. Please let the site owner know." };
  }
  // The Groq and Octokit SDKs both put the upstream HTTP status on err.status.
  const upstream = Number(err?.status);
  if (upstream === 429) {
    return { status: 503, message: "The AI service is at its rate limit right now. Please try again in a few minutes." };
  }
  if (upstream === 401 || upstream === 403) {
    return { status: 503, message: "The AI service rejected this server's credentials. Please let the site owner know." };
  }
  if (upstream === 413) {
    return { status: 413, message: "That's too much text for the AI model to process. Please shorten it and try again." };
  }
  return { status: 500, message: fallback };
}

function sendRouteError(res, err, fallback) {
  const { status, message } = describeRouteError(err, fallback);
  res.status(status).json({ error: message });
}

// A value counts as configured only if it's set AND isn't still the
// placeholder copied from .env.example ("your_groq_api_key_here").
const isConfigured = (value) => Boolean(value) && !/^your_.*_here$/i.test(value);
const githubOAuthConfigured = () =>
  isConfigured(process.env.GITHUB_CLIENT_ID) && isConfigured(process.env.GITHUB_CLIENT_SECRET);

for (const name of ["GROQ_API_KEY", "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"]) {
  if (!isConfigured(process.env[name])) {
    console.warn(`⚠ ${name} is not set (or is still the .env.example placeholder) — the features that need it will report themselves as unavailable.`);
  }
}

// Used on the routes that hand off to GitHub. Without it, a missing client ID
// sends the user to github.com/login/oauth/authorize?client_id=undefined and
// strands them on GitHub's 404 page.
function requireGitHubOAuth(req, res, next) {
  if (githubOAuthConfigured()) return next();
  res.redirect(`/?error=${encodeURIComponent("GitHub sign-in isn't set up on this server yet.")}`);
}

// Shortest text we'll treat as a resume. Mostly catches scanned (image-only)
// PDFs, which "extract" successfully to an empty string — sending that to the
// AI produces a confidently invented person.
const MIN_RESUME_TEXT_CHARS = 50;

// Upload cap. Vercel rejects any request body over 4.5MB before it reaches
// this code, so the limit has to sit below that with headroom for the other
// multipart fields sent alongside the resume (profile photo, favicon).
// Keep in sync with MAX_RESUME_UPLOAD_BYTES in public/index.html.
const MAX_RESUME_BYTES = 4 * 1024 * 1024;

// Caps on free text that is forwarded to the AI. Without these, the 512kb
// JSON body limit is the only bound and the endpoints are an open proxy for
// burning this deployment's Groq quota.
const MAX_RESUME_TEXT_CHARS = 20000;
const MAX_JOB_DESCRIPTION_CHARS = 8000;

// Single source of truth: the styles that actually exist in src/styles.js.
const { STYLE_NAMES: ALLOWED_STYLES } = require("./styles");

// ── Rate Limiting ──
// The per-IP budgets can be tuned per deployment without a code change (and
// the test suite raises them, since it makes far more requests from one
// address than a real visitor would). Anything unparseable or non-positive
// falls back to the default rather than accidentally disabling the limit.
const positiveIntFromEnv = (name, fallback) => {
  const parsed = Number.parseInt(process.env[name], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: positiveIntFromEnv("RATE_LIMIT_API_MAX", 30), // requests per IP per window
  message: { error: "Too many requests. Please try again later." }
});

const generateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: positiveIntFromEnv("RATE_LIMIT_GENERATE_MAX", 10), // AI generations per IP per window
  message: { error: "Too many portfolio generations. Please try again after 15 minutes." }
});

// ── CORS ──
// Wide open by default so local dev and the CLI/tests need no configuration.
// Set CORS_ORIGIN (comma-separated) in production to lock this down.
const corsOrigin = process.env.CORS_ORIGIN;
const isProduction = Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";
if (corsOrigin) {
  app.use(cors({ origin: corsOrigin.split(",").map((o) => o.trim()).filter(Boolean) }));
} else if (!isProduction) {
  app.use(cors());
}
// In production with no CORS_ORIGIN, no CORS headers are sent at all, i.e.
// same-origin only. The bundled frontend is served from this same origin and
// never needed CORS; "allow everyone" is a convenience for local development
// that shouldn't become the production default just because a variable was
// forgotten.

// ── Baseline response headers ──
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.set({
    // Never let a browser guess a different content type than the one sent.
    "X-Content-Type-Options": "nosniff",
    // This app has buttons that publish to someone's GitHub account; it must
    // not be embeddable in another site's frame (clickjacking). This doesn't
    // affect the preview iframe INSIDE the app — that's this page framing
    // generated HTML, not another site framing this page.
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  });
  next();
});

// Deployment self-check: reports WHETHER each piece of configuration is
// present, never its value. Meant for the "is this deploy wired up?" check
// right after setting env vars on a host.
app.get("/healthz", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({
    ok: true,
    ai: isConfigured(process.env.GROQ_API_KEY),
    githubOAuth: githubOAuthConfigured(),
    jwtSecret: Boolean(process.env.JWT_SECRET),
    corsOrigin: corsOrigin ? "restricted" : isProduction ? "same-origin" : "open (development)",
  });
});

// Raised from the 100kb default: /regenerate-html can now carry an uploaded
// profile photo (~180KB max as base64) and favicon alongside the edits.
app.use(express.json({ limit: "512kb" }));
app.use(express.static(path.join(__dirname, "..", "public")));
// After static on purpose: only the API/OAuth routes need the browser cookie.
app.use(ensureBrowserId);

// ── Multer Storage Configuration ──
// Uses the OS temp dir (not a project-relative "uploads/" folder) because
// serverless hosts like Vercel have a read-only filesystem everywhere except
// /tmp. os.tmpdir() resolves correctly both there and on a normal server.
const uploadDir = path.join(os.tmpdir(), "portfolio-gen-uploads");
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, Date.now() + "-" + crypto.randomBytes(8).toString("hex") + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  // Extension only: extractText() picks its parser by extension, so that is
  // what has to be right. (This used to also accept by MIME type, which let
  // a legacy .doc through the filter only to fail later in extraction; and
  // browsers are too inconsistent about MIME types to require one.)
  if ([".pdf", ".docx"].includes(ext)) {
    cb(null, true);
  } else {
    const err = new Error("Only PDF and DOCX files are allowed.");
    err.code = "UNSUPPORTED_FILE_TYPE";
    cb(err);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_RESUME_BYTES, files: 1 }
});

// ── In-memory store for generated portfolios ──
// Key: sessionId, Value: { html, name, theme, portfolioData, options }
//
// NOTE ON SERVERLESS HOSTING (Vercel etc.): this Map only lives in one
// function instance's memory. A low-traffic single-user deploy will usually
// stay on the same warm instance for the few seconds between "Generate" and
// "Deploy"/"Apply changes", but it is not guaranteed — a cold start or a
// concurrent request landing on a different instance can make a session
// look "expired" even though it was just created. The two flows below this
// (deploy confirmation and sign-in handoff) used to have the same problem
// and were rewritten as stateless signed JWTs specifically to remove it;
// this one carries the full generated HTML/theme/data, which is too large
// to put in a token, so it remains in-memory. See README → "Deploying to
// Vercel" for the practical impact and options.
const portfolioStore = new Map();

// Extracts the bearer GitHub token a signed-in client sends per-request.
// The server never stores this beyond the lifetime of the request.
function requireBearerToken(req, res, next) {
  const header = req.headers.authorization || "";
  const match = /^Bearer (.+)$/.exec(header);
  if (!match) {
    return res.status(401).json({ error: "Missing or invalid Authorization header." });
  }
  req.githubToken = match[1];
  next();
}

// Shared by readGenerationOptions() and limitIfBriefChanged() so the rate
// limiter and the handler can never disagree about what the brief is.
function readDesignBrief(body) {
  return typeof body?.designBrief === "string" ? body.designBrief.slice(0, 1500).trim() : "";
}

function readGenerationOptions(body) {
  const style = ALLOWED_STYLES.includes(body.style) ? body.style : "minimalism";
  // String() so a JSON body sending an object/array here can't crash .slice().
  const title = String(body.title || "").slice(0, 100);
  const favicon = String(body.favicon || "").slice(0, 300);
  // Uploaded favicon as a PNG data: URL. Only length-capped here (anything
  // longer is rejected outright rather than truncated into garbage);
  // generateHTML() does the real validation, including the PNG signature check.
  const rawFaviconData = typeof body.faviconData === "string" ? body.faviconData : "";
  const faviconData = rawFaviconData.length <= 50000 ? rawFaviconData : "";
  let colors = {};
  if (body.colors) {
    try {
      const parsed = typeof body.colors === "string" ? JSON.parse(body.colors) : body.colors;
      if (parsed && typeof parsed === "object") {
        const { primary, accent, background } = parsed;
        colors = { primary, accent, background };
      }
    } catch (e) {
      // Fallback if parsing fails
    }
  }
  // Free-form "design this like X" prompt — capped hard, since it's the one
  // free-text field that gets sent back to the AI as an instruction (not
  // just stored/displayed). generateCustomStyleCSS() treats it as content to
  // riff on, never as something that can change what it's allowed to output,
  // and sanitizeCustomCSS() in generator.js is the actual security backstop
  // on whatever CSS comes back either way.
  // Strings only: String() on an object would turn it into the literal brief
  // "[object Object]" and spend a real AI call on it.
  const designBrief = readDesignBrief(body);

  // ── Personalization ── Bounded and shape-checked here; generateHTML() does
  // the content validation (allowlisted keys, URL schemes, escaping).
  // Multipart (/generate) sends these as JSON strings, the JSON endpoint
  // (/regenerate-html) as objects, so accept both.
  const parseJSONField = (value) => {
    if (typeof value !== "string") return value;
    try { return JSON.parse(value); } catch { return undefined; }
  };
  const rawSections = parseJSONField(body.sections);
  const sections = rawSections && typeof rawSections === "object" && !Array.isArray(rawSections)
    ? {
        order: Array.isArray(rawSections.order) ? rawSections.order.slice(0, 10).map(String) : [],
        hidden: Array.isArray(rawSections.hidden) ? rawSections.hidden.slice(0, 10).map(String) : [],
        labels: rawSections.labels && typeof rawSections.labels === "object"
          ? Object.fromEntries(Object.entries(rawSections.labels).slice(0, 10).map(([k, v]) => [String(k), String(v).slice(0, 40)]))
          : {},
      }
    : {};
  const rawLinks = parseJSONField(body.links);
  const links = Array.isArray(rawLinks)
    ? rawLinks.slice(0, 6).map((l) => ({ label: String(l?.label || "").slice(0, 30), url: String(l?.url || "").slice(0, 300) }))
    : [];
  const fontPair = typeof body.fontPair === "string" ? body.fontPair.slice(0, 30) : "";
  const ctaLabel = typeof body.ctaLabel === "string" ? body.ctaLabel.slice(0, 40) : "";
  const rawAvatarData = typeof body.avatarData === "string" ? body.avatarData : "";
  const avatarData = rawAvatarData.length <= 250000 ? rawAvatarData : "";

  return { style, title, favicon, faviconData, colors, designBrief, sections, links, fontPair, ctaLabel, avatarData };
}

// Merges user-submitted edits onto the originally-extracted portfolioData,
// capping every field's size and always keeping contact links (email, phone,
// github, linkedin, website) from the original — there's no UI for editing
// those, so we never trust a client-submitted value for them.
function clampPortfolioEdits(edited, original) {
  const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");
  const arr = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);

  const clamped = { ...original };
  if (edited && typeof edited === "object") {
    clamped.name = str(edited.name, 150) || original.name;
    clamped.tagline = str(edited.tagline, 200) || original.tagline;
    clamped.about = str(edited.about, 2000) || original.about;
    clamped.cta = str(edited.cta, 200) || original.cta;

    // List fields are only replaced when the edit actually includes them —
    // an edit that omits `projects` means "unchanged", not "delete them all".
    // (An explicitly sent empty array still clears the list on purpose.)
    if (Array.isArray(edited.skills)) {
      clamped.skills = arr(edited.skills, 40).map((s) => str(s, 60)).filter(Boolean);
    }
    if (Array.isArray(edited.experience)) {
      clamped.experience = arr(edited.experience, 20).map((exp) => ({
        company: str(exp?.company, 150),
        role: str(exp?.role, 150),
        period: str(exp?.period, 100),
        highlight: str(exp?.highlight, 400),
      }));
    }
    if (Array.isArray(edited.projects)) {
      clamped.projects = arr(edited.projects, 20).map((proj) => ({
        title: str(proj?.title, 150),
        description: str(proj?.description, 500),
        tags: arr(proj?.tags, 15).map((t) => str(t, 40)).filter(Boolean),
        url: str(proj?.url, 500) || null,
      }));
    }
    if (Array.isArray(edited.certifications)) {
      clamped.certifications = arr(edited.certifications, 20).map((c) => str(c, 150)).filter(Boolean);
    }
  }

  // Contact fields always come from the original extraction, never from the client.
  clamped.email = original.email;
  clamped.phone = original.phone;
  clamped.github = original.github;
  clamped.linkedin = original.linkedin;
  clamped.website = original.website;

  return clamped;
}

// ── Main generation endpoint ──
// Accepts either an uploaded PDF/DOCX ("resume") or pasted plain text
// ("resumeText" — e.g. copied from LinkedIn) — whichever the client sent.
app.post("/generate", generateLimiter, upload.single("resume"), async (req, res) => {
  const filePath = req.file?.path;
  const pastedText = typeof req.body?.resumeText === "string" ? req.body.resumeText.trim() : "";

  try {
    if (!req.file && !pastedText) {
      return res.status(400).json({ error: "No file uploaded and no resume text pasted." });
    }

    // Read options — validated/bounded here; generateHTML() also escapes
    // and validates everything before it touches the output HTML.
    const options = readGenerationOptions(req.body);

    let extracted = pastedText;
    if (req.file) {
      try {
        extracted = await extractText(filePath);
      } catch (err) {
        console.error("Resume extraction failed:", err);
        throw new UserFacingError(422, "Couldn't read that file — it may be corrupted or password-protected. Try re-exporting it, or paste your resume text instead.");
      }
    }
    // Capped for uploads too, not just pasted text — a long PDF shouldn't be
    // able to send an unbounded prompt to the AI.
    const resumeText = String(extracted || "").trim().slice(0, MAX_RESUME_TEXT_CHARS);
    if (resumeText.length < MIN_RESUME_TEXT_CHARS) {
      throw new UserFacingError(422, req.file
        ? "Couldn't find any readable text in that file — it may be a scanned image. Try pasting your resume text instead."
        : "That's too short to build a portfolio from. Please paste your full resume text.");
    }

    // All AI work shares one deadline (see withDeadline above).
    const { portfolioData, theme, customCSS } = await withDeadline((async () => {
      const portfolioData = await generatePortfolioData(resumeText);
      const theme = await generateTheme(portfolioData);

      // If the user described a custom look, ask the AI for a CSS-only pass
      // on top of the base theme. Best-effort: if this fails (or there's no
      // brief), we still deliver the normal portfolio rather than erroring
      // the whole generation out.
      let customCSS = "";
      if (options.designBrief) {
        try {
          customCSS = await generateCustomStyleCSS({ portfolioData, style: options.style, designBrief: options.designBrief });
        } catch (err) {
          console.error("Custom style generation failed, continuing without it:", err);
          customCSS = "";
        }
      }
      return { portfolioData, theme, customCSS };
    })());

    const html = generateHTML(portfolioData, theme, { ...options, customCSS });

    // Clean up uploaded file (a no-op when this was a pasted-text submission)
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Store portfolio session (theme + data + options kept so later edits /
    // regenerations don't need another AI call)
    // Cryptographically random: the sessionId is what retrieves a stored
    // portfolio (someone's resume data), so it must not be guessable the way
    // a timestamp + Math.random() value is.
    const sessionId = crypto.randomBytes(18).toString("base64url");
    // ownerHash ties this portfolio to the browser that generated it; the
    // deploy flow refuses to publish it from any other browser.
    portfolioStore.set(sessionId, { html, name: portfolioData.name, theme, portfolioData, options, customCSS, ownerHash: req.browserHash });

    // Clean up from memory store after 1 hour
    setTimeout(() => portfolioStore.delete(sessionId), 3600000);

    res.json({
      html,
      name: portfolioData.name,
      sessionId,
      portfolioData,
      resumeText
    });

  } catch (err) {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    console.error("Generation Error:", err);
    sendRouteError(res, err, "Failed to generate portfolio. Please try again.");
  }
});

// ── Re-render endpoint: applies content edits and/or style/color changes
// without calling the AI again (theme + extracted data are already cached). ──
// /regenerate-html is normally a free re-render, but a CHANGED design brief
// makes it call the AI. Those calls count against the same budget as
// /generate instead of the looser apiLimiter, so toggling a brief back and
// forth can't be used to make 3x as many AI calls.
function limitIfBriefChanged(req, res, next) {
  const portfolio = req.body?.sessionId && portfolioStore.get(req.body.sessionId);
  const brief = readDesignBrief(req.body);
  if (portfolio && brief && brief !== (portfolio.options?.designBrief || "")) {
    return generateLimiter(req, res, next);
  }
  next();
}

app.post("/regenerate-html", apiLimiter, limitIfBriefChanged, async (req, res) => {
  try {
    const { sessionId, portfolioData: edited } = req.body || {};
    const portfolio = sessionId && portfolioStore.get(sessionId);
    // A session from another browser gets the same answer as a missing one,
    // so this endpoint can't be used to probe which sessionIds exist.
    if (!portfolio || !sameBrowser(req, portfolio.ownerHash)) {
      return res.status(400).json({ error: "Portfolio session expired. Please generate again." });
    }

    const options = readGenerationOptions(req.body || {});
    const mergedData = clampPortfolioEdits(edited, portfolio.portfolioData);

    // Only re-call the AI for a fresh custom-CSS pass when the design brief
    // actually changed — switching style/colors or editing text shouldn't
    // cost another Groq call, so we reuse the cached CSS whenever the brief
    // is unchanged (including the empty-string "no brief" case).
    let customCSS = portfolio.customCSS || "";
    if (options.designBrief !== (portfolio.options?.designBrief || "")) {
      if (options.designBrief) {
        try {
          customCSS = await withDeadline(
            generateCustomStyleCSS({ portfolioData: mergedData, style: options.style, designBrief: options.designBrief })
          );
        } catch (err) {
          console.error("Custom style generation failed, keeping previous styling:", err);
        }
      } else {
        customCSS = "";
      }
    }

    const html = generateHTML(mergedData, portfolio.theme, { ...options, customCSS });

    // Keep the store in sync so a later deploy uses the latest edits.
    portfolioStore.set(sessionId, { ...portfolio, html, name: mergedData.name, portfolioData: mergedData, options, customCSS });

    res.json({ html, name: mergedData.name });
  } catch (err) {
    console.error("Regenerate Error:", err);
    sendRouteError(res, err, "Failed to update portfolio. Please try again.");
  }
});

// ── Cover Letter generation endpoint ──
// Free text bound for the AI: must be a string (a JSON body could send an
// object/array here), trimmed, and capped.
const boundedText = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");

app.post("/generate-cover-letter", generateLimiter, async (req, res) => {
  const resumeText = boundedText(req.body?.resumeText, MAX_RESUME_TEXT_CHARS);
  const jobDescription = boundedText(req.body?.jobDescription, MAX_JOB_DESCRIPTION_CHARS);
  try {
    if (!resumeText) {
      return res.status(400).json({ error: "Missing resume text. Please upload a resume first." });
    }
    if (!jobDescription) {
      return res.status(400).json({ error: "Missing job description." });
    }

    const coverLetter = await withDeadline(generateCoverLetter(resumeText, jobDescription));
    res.json({ coverLetter });
  } catch (err) {
    console.error("Cover Letter Error:", err);
    sendRouteError(res, err, "Failed to generate cover letter. Please try again.");
  }
});

// ── Resume Review / ATS score endpoint ──
app.post("/generate-resume-review", generateLimiter, async (req, res) => {
  const resumeText = boundedText(req.body?.resumeText, MAX_RESUME_TEXT_CHARS);
  try {
    if (!resumeText) {
      return res.status(400).json({ error: "Missing resume text. Please upload a resume first." });
    }

    const review = await withDeadline(generateResumeReview(resumeText));
    res.json({ review });
  } catch (err) {
    console.error("Resume Review Error:", err);
    sendRouteError(res, err, "Failed to review resume. Please try again.");
  }
});

// ── "Sign in with GitHub" Step 1: separate, narrowly-scoped OAuth flow used
// only to sync the Profile dashboard (resume summary, cover letters, deploy
// link) via a secret Gist — never used for deploying. ──
app.get("/auth/profile/github", apiLimiter, requireGitHubOAuth, (req, res) => {
  // `b` binds this flow to the browser starting it (see ensureBrowserId).
  const stateToken = jwt.sign({ purpose: "profile-signin", b: req.browserHash }, JWT_SECRET, { expiresIn: "15m" });

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    scope: "gist", // Narrowest possible scope — no repo access at all
    state: stateToken,
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

// ── GitHub OAuth Step 1: Redirect to GitHub with Secure JWT State ──
app.get("/auth/github", apiLimiter, requireGitHubOAuth, (req, res) => {
  const { sessionId, repo } = req.query;
  const portfolio = sessionId && portfolioStore.get(sessionId);
  if (!portfolio) {
    return res.status(400).send("Invalid or expired session. Please generate again.");
  }
  // A sessionId in a link is not proof of ownership: only the browser that
  // generated this portfolio may start publishing it. This is what stops a
  // crafted /auth/github?sessionId=... link from deploying someone else's
  // portfolio to the GitHub account of whoever clicks it.
  if (!sameBrowser(req, portfolio.ownerHash)) {
    return res.status(403).send("This portfolio was generated in a different browser. Please generate it again here to deploy.");
  }

  // Optional custom repo name for a project-page deploy (multiple portfolios
  // per GitHub account). Validated here; anything malformed is just dropped
  // in favor of the default user-site repo.
  const repoSlug = typeof repo === "string" && REPO_SLUG_RE.test(repo) ? repo : undefined;

  // Cryptographically sign the sessionId (and repo choice) in the state
  // parameter using JWT, bound to this browser via `b`, to prevent CSRF
  const stateToken = jwt.sign({ sessionId, repoSlug, b: req.browserHash }, JWT_SECRET, { expiresIn: "15m" });

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    scope: "public_repo", // Secure down-scoped permission
    state: stateToken,
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

// ── GitHub OAuth Step 2: Callback from GitHub ──
app.get("/auth/callback", apiLimiter, requireGitHubOAuth, async (req, res) => {
  const { code, state: stateToken } = req.query;

  try {
    if (!stateToken) {
      throw new Error("Missing OAuth state verification token.");
    }

    // Verify JWT state token to protect against CSRF attacks
    let sessionId, repoSlug, purpose, startedBy;
    try {
      const decoded = jwt.verify(stateToken, JWT_SECRET);
      sessionId = decoded.sessionId;
      repoSlug = decoded.repoSlug;
      purpose = decoded.purpose;
      startedBy = decoded.b;
    } catch (err) {
      throw new Error("OAuth state verification failed or expired. Please try again.");
    }

    // The signature above proves we issued this state; this proves the
    // browser finishing the flow is the one that started it. Checked before
    // the code exchange so a mismatched request never touches GitHub.
    if (!sameBrowser(req, startedBy)) {
      throw new Error("This GitHub sign-in was started in a different browser. Please start again from this one.");
    }

    // Exchange authorization code for access token
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      throw new Error("Failed to authenticate with GitHub.");
    }

    // "Sign in with GitHub" flow: hand the token to the client via a
    // short-lived signed JWT instead of a server-side lookup — the browser
    // holds the real token from here on. Signing/verifying a JWT needs no
    // shared memory, so this works the same whether one process or many
    // (e.g. Vercel serverless) end up handling the two requests involved.
    // The GitHub token inside is encrypted (this JWT rides in a URL) and the
    // handoff is redeemable only by this same browser.
    if (purpose === "profile-signin") {
      const handoffToken = jwt.sign({ sealed: sealAccessToken(accessToken), b: req.browserHash }, JWT_SECRET, { expiresIn: "60s" });
      return res.redirect(`/?profileSignin=${encodeURIComponent(handoffToken)}`);
    }

    // Get portfolio HTML from memory store
    const portfolio = portfolioStore.get(sessionId);
    if (!portfolio) {
      throw new Error("Portfolio session expired. Please generate again.");
    }

    // Check whether this would overwrite a site Portfol.io didn't create
    const { repoName, isForeign } = await checkDeployTarget({ accessToken, repoSlug });

    if (isForeign) {
      // Same reasoning as the sign-in handoff above: a signed JWT carrying
      // what /deploy/confirm needs, instead of a server-memory lookup.
      const confirmToken = jwt.sign(
        { sealed: sealAccessToken(accessToken), sessionId, repoSlug, b: req.browserHash },
        JWT_SECRET,
        { expiresIn: "5m" }
      );

      return res.redirect(
        `/?confirmOverwrite=true&token=${encodeURIComponent(confirmToken)}&repo=${encodeURIComponent(repoName)}`
      );
    }

    // Deploy using modular deploy.js logic (repoName already resolved above)
    const { liveUrl } = await deployToGitHubPages({
      accessToken,
      html: portfolio.html,
      portfolioName: portfolio.name,
      repoSlug,
    });

    res.redirect(
      `/?deployed=true&url=${encodeURIComponent(liveUrl)}&name=${encodeURIComponent(portfolio.name)}&repo=${encodeURIComponent(repoName)}`
    );

  } catch (err) {
    console.error("OAuth callback error:", err);
    res.redirect(`/?error=${encodeURIComponent(err.message)}`);
  }
});

// ── Deploy Step 3 (only when the target repo had unrelated content): ──
// User explicitly confirms or cancels the overwrite from the banner shown on "/".
app.get("/deploy/confirm", apiLimiter, async (req, res) => {
  const { token, action } = req.query;

  let pending;
  try {
    pending = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.redirect(
      `/?error=${encodeURIComponent("This confirmation link has expired. Please try deploying again.")}`
    );
  }

  if (action !== "overwrite") {
    return res.redirect("/?deployCancelled=true");
  }

  try {
    // Overwriting a repo is the one destructive step here, so the link alone
    // must not be enough: it has to come from the browser it was issued to.
    if (!sameBrowser(req, pending.b)) {
      throw new Error("This confirmation link belongs to a different browser. Please try deploying again.");
    }
    const accessToken = openAccessToken(pending.sealed);

    const portfolio = portfolioStore.get(pending.sessionId);
    if (!portfolio) {
      throw new Error("Portfolio session expired. Please generate again.");
    }

    const { liveUrl, repoName } = await deployToGitHubPages({
      accessToken,
      html: portfolio.html,
      portfolioName: portfolio.name,
      repoSlug: pending.repoSlug,
    });

    res.redirect(
      `/?deployed=true&url=${encodeURIComponent(liveUrl)}&name=${encodeURIComponent(portfolio.name)}&repo=${encodeURIComponent(repoName)}`
    );
  } catch (err) {
    console.error("Deploy confirm error:", err);
    res.redirect(`/?error=${encodeURIComponent(err.message)}`);
  }
});

// ── "Sign in with GitHub" Step 2: exchange the redirect's short-lived signed
// handoff token for the actual GitHub token. The client calls this once,
// immediately, then holds the token itself — the server keeps nothing. ──
app.get("/auth/profile/session-token", apiLimiter, (req, res) => {
  const { code } = req.query;

  try {
    const decoded = jwt.verify(code, JWT_SECRET);
    if (!sameBrowser(req, decoded.b)) throw new Error("Handoff token presented by a different browser.");
    // The token is returned in a response body only, never a URL; no-store
    // keeps it out of any HTTP cache along the way.
    res.set("Cache-Control", "no-store");
    res.json({ accessToken: openAccessToken(decoded.sealed) });
  } catch (err) {
    res.status(400).json({ error: "This sign-in link has expired. Please sign in again." });
  }
});

// A 401 from GitHub means the user's stored token was revoked or expired.
// That is passed through AS a 401 so the frontend can sign the user out
// locally instead of silently failing to sync forever; everything else is an
// upstream problem (502) with the route's generic message.
function sendGitHubError(res, err, fallback) {
  if (Number(err?.status) === 401) {
    return res.status(401).json({ error: "Your GitHub sign-in has expired. Please sign in again." });
  }
  res.status(502).json({ error: fallback });
}

// ── Profile sync: reads/writes the signed-in user's secret Gist. ──
// Fully stateless on our side — the token travels with every request.
app.get("/profile/sync", apiLimiter, requireBearerToken, async (req, res) => {
  try {
    const { username, profile } = await getProfile({ accessToken: req.githubToken });
    res.json({ username, profile });
  } catch (err) {
    console.error("Profile sync (read) error:", err);
    sendGitHubError(res, err, "Failed to load your synced profile.");
  }
});

app.put("/profile/sync", apiLimiter, requireBearerToken, async (req, res) => {
  try {
    const saved = await saveProfile({ accessToken: req.githubToken, data: req.body });
    res.json({ profile: saved });
  } catch (err) {
    console.error("Profile sync (write) error:", err);
    sendGitHubError(res, err, "Failed to save your synced profile.");
  }
});

// ── Sign out: actually revokes the OAuth grant (not just a local forget). ──
app.post("/auth/profile/signout", apiLimiter, requireBearerToken, async (req, res) => {
  try {
    await revokeToken({ accessToken: req.githubToken });
  } catch (err) {
    console.error("Sign-out revoke error:", err);
    // Revocation failing server-side shouldn't block the client from
    // forgetting the token locally, so this is intentionally non-fatal.
  }
  res.status(204).end();
});

// ── Errors raised before a route handler runs ──
// Every route above catches its own errors and answers in JSON, but errors
// thrown by MIDDLEWARE (multer rejecting an upload, express.json() choking on
// a malformed body) never reach those try/catch blocks. Without the handler
// below they fall through to Express's default HTML error page, which the
// frontend cannot parse and surfaces as "Unexpected token '<'...".
//
// describeRequestError() decides what the user is told for each kind of
// failure. What it can receive:
//   - multer:        err instanceof multer.MulterError, with err.code such as
//                    "LIMIT_FILE_SIZE" (over MAX_RESUME_BYTES) or
//                    "LIMIT_UNEXPECTED_FILE" (wrong form field name)
//   - fileFilter:    err.code === "UNSUPPORTED_FILE_TYPE" (message is already
//                    user-friendly)
//   - express.json:  err.type === "entity.parse.failed" (malformed JSON) or
//                    "entity.too.large" (body over 512kb); these also carry
//                    a numeric err.status
//   - anything else: an unexpected bug — its message may contain internals
function describeRequestError(err) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      const limitMB = Math.floor(MAX_RESUME_BYTES / (1024 * 1024));
      return { status: 413, message: `That file is over the ${limitMB}MB limit. Try a smaller export, or paste your resume text instead.` };
    }
    // Wrong field name, too many files, etc. — a malformed form, not a bug.
    return { status: 400, message: "That upload couldn't be processed. Please choose a single PDF or DOCX file." };
  }
  // Our own fileFilter error: its message was written for users.
  if (err?.code === "UNSUPPORTED_FILE_TYPE") return { status: 415, message: err.message };
  if (err?.type === "entity.too.large") {
    return { status: 413, message: "That request is too large. Try a smaller profile photo or shorter text." };
  }
  if (err?.type === "entity.parse.failed") {
    return { status: 400, message: "The request body wasn't valid JSON." };
  }
  // Anything else is a bug on our side; its message may contain internals,
  // so it goes to the log only.
  return { status: 500, message: "Something went wrong handling that request. Please try again." };
}

// Express recognises an error handler by its four-argument signature, and it
// must be registered after every route.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const { status, message } = describeRequestError(err);
  if (status >= 500) console.error("Unhandled request error:", err);
  res.status(status).json({ error: message });
});

module.exports = app;
module.exports.portfolioStore = portfolioStore;
module.exports.clampPortfolioEdits = clampPortfolioEdits;
// Exposed only so tests can build valid handoff/confirm tokens themselves
// without going through a real GitHub OAuth round trip.
module.exports.JWT_SECRET = JWT_SECRET;
module.exports.sealAccessToken = sealAccessToken;
module.exports.openAccessToken = openAccessToken;
module.exports.browserHash = browserHash;
module.exports.BROWSER_COOKIE = BROWSER_COOKIE;
module.exports.withDeadline = withDeadline;
module.exports.DeadlineError = DeadlineError;
module.exports.describeRequestError = describeRequestError;
module.exports.describeRouteError = describeRouteError;
module.exports.UserFacingError = UserFacingError;
module.exports.MAX_RESUME_BYTES = MAX_RESUME_BYTES;
