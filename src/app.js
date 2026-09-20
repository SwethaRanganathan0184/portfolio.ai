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
const { generatePortfolioData, generateTheme, generateCoverLetter, generateResumeReview } = require("./ai");
const { generateHTML } = require("./generator");
const { deployToGitHubPages, checkDeployTarget, REPO_SLUG_RE } = require("./deploy");
const { getProfile, saveProfile, revokeToken } = require("./profileSync");

const app = express();

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

const ALLOWED_STYLES = ["minimalism", "glassmorphism", "brutalism", "playful"];

// ── Rate Limiting ──
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // limit each IP to 30 requests per windowMs
  message: { error: "Too many requests. Please try again later." }
});

const generateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // limit each IP to 10 generations per 15 minutes
  message: { error: "Too many portfolio generations. Please try again after 15 minutes." }
});

// ── CORS ──
// Wide open by default so local dev and the CLI/tests need no configuration.
// Set CORS_ORIGIN (comma-separated) in production to lock this down.
const corsOrigin = process.env.CORS_ORIGIN;
app.use(cors(corsOrigin ? { origin: corsOrigin.split(",").map((o) => o.trim()) } : undefined));

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

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
    cb(null, Date.now() + "-" + Math.random().toString(36).slice(2) + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = [".pdf", ".docx"];
  const allowedMimetypes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword"
  ];
  if (allowedExtensions.includes(ext) || allowedMimetypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF and DOCX files are allowed."));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB file limit
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

function readGenerationOptions(body) {
  const style = ALLOWED_STYLES.includes(body.style) ? body.style : "minimalism";
  const title = (body.title || "").slice(0, 100);
  const favicon = (body.favicon || "").slice(0, 300);
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
  return { style, title, favicon, colors };
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
    clamped.skills = arr(edited.skills, 40).map((s) => str(s, 60)).filter(Boolean);

    clamped.experience = arr(edited.experience, 20).map((exp) => ({
      company: str(exp?.company, 150),
      role: str(exp?.role, 150),
      period: str(exp?.period, 100),
      highlight: str(exp?.highlight, 400),
    }));

    clamped.projects = arr(edited.projects, 20).map((proj) => ({
      title: str(proj?.title, 150),
      description: str(proj?.description, 500),
      tags: arr(proj?.tags, 15).map((t) => str(t, 40)).filter(Boolean),
      url: str(proj?.url, 500) || null,
    }));
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

    const resumeText = req.file ? await extractText(filePath) : pastedText.slice(0, 20000);
    const portfolioData = await generatePortfolioData(resumeText);
    const theme = await generateTheme(portfolioData);
    const html = generateHTML(portfolioData, theme, options);

    // Clean up uploaded file (a no-op when this was a pasted-text submission)
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Store portfolio session (theme + data + options kept so later edits /
    // regenerations don't need another AI call)
    const sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2);
    portfolioStore.set(sessionId, { html, name: portfolioData.name, theme, portfolioData, options });

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
    res.status(500).json({ error: err.message || "Failed to generate portfolio." });
  }
});

// ── Re-render endpoint: applies content edits and/or style/color changes
// without calling the AI again (theme + extracted data are already cached). ──
app.post("/regenerate-html", apiLimiter, (req, res) => {
  try {
    const { sessionId, portfolioData: edited } = req.body || {};
    const portfolio = sessionId && portfolioStore.get(sessionId);
    if (!portfolio) {
      return res.status(400).json({ error: "Portfolio session expired. Please generate again." });
    }

    const options = readGenerationOptions(req.body || {});
    const mergedData = clampPortfolioEdits(edited, portfolio.portfolioData);
    const html = generateHTML(mergedData, portfolio.theme, options);

    // Keep the store in sync so a later deploy uses the latest edits.
    portfolioStore.set(sessionId, { ...portfolio, html, name: mergedData.name, portfolioData: mergedData, options });

    res.json({ html, name: mergedData.name });
  } catch (err) {
    console.error("Regenerate Error:", err);
    res.status(500).json({ error: err.message || "Failed to update portfolio." });
  }
});

// ── Cover Letter generation endpoint ──
app.post("/generate-cover-letter", generateLimiter, async (req, res) => {
  const { resumeText, jobDescription } = req.body;
  try {
    if (!resumeText) {
      return res.status(400).json({ error: "Missing resume text. Please upload a resume first." });
    }
    if (!jobDescription) {
      return res.status(400).json({ error: "Missing job description." });
    }

    const coverLetter = await generateCoverLetter(resumeText, jobDescription);
    res.json({ coverLetter });
  } catch (err) {
    console.error("Cover Letter Error:", err);
    res.status(500).json({ error: err.message || "Failed to generate cover letter." });
  }
});

// ── Resume Review / ATS score endpoint ──
app.post("/generate-resume-review", generateLimiter, async (req, res) => {
  const { resumeText } = req.body;
  try {
    if (!resumeText) {
      return res.status(400).json({ error: "Missing resume text. Please upload a resume first." });
    }

    const review = await generateResumeReview(resumeText);
    res.json({ review });
  } catch (err) {
    console.error("Resume Review Error:", err);
    res.status(500).json({ error: err.message || "Failed to review resume." });
  }
});

// ── "Sign in with GitHub" Step 1: separate, narrowly-scoped OAuth flow used
// only to sync the Profile dashboard (resume summary, cover letters, deploy
// link) via a secret Gist — never used for deploying. ──
app.get("/auth/profile/github", apiLimiter, (req, res) => {
  const stateToken = jwt.sign({ purpose: "profile-signin" }, JWT_SECRET, { expiresIn: "15m" });

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    scope: "gist", // Narrowest possible scope — no repo access at all
    state: stateToken,
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

// ── GitHub OAuth Step 1: Redirect to GitHub with Secure JWT State ──
app.get("/auth/github", apiLimiter, (req, res) => {
  const { sessionId, repo } = req.query;
  if (!sessionId || !portfolioStore.has(sessionId)) {
    return res.status(400).send("Invalid or expired session. Please generate again.");
  }

  // Optional custom repo name for a project-page deploy (multiple portfolios
  // per GitHub account). Validated here; anything malformed is just dropped
  // in favor of the default user-site repo.
  const repoSlug = typeof repo === "string" && REPO_SLUG_RE.test(repo) ? repo : undefined;

  // Cryptographically sign the sessionId (and repo choice) in the state
  // parameter using JWT to prevent CSRF
  const stateToken = jwt.sign({ sessionId, repoSlug }, JWT_SECRET, { expiresIn: "15m" });

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    scope: "public_repo", // Secure down-scoped permission
    state: stateToken,
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

// ── GitHub OAuth Step 2: Callback from GitHub ──
app.get("/auth/callback", apiLimiter, async (req, res) => {
  const { code, state: stateToken } = req.query;

  try {
    if (!stateToken) {
      throw new Error("Missing OAuth state verification token.");
    }

    // Verify JWT state token to protect against CSRF attacks
    let sessionId, repoSlug, purpose;
    try {
      const decoded = jwt.verify(stateToken, JWT_SECRET);
      sessionId = decoded.sessionId;
      repoSlug = decoded.repoSlug;
      purpose = decoded.purpose;
    } catch (err) {
      throw new Error("OAuth state verification failed or expired. Please try again.");
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
    if (purpose === "profile-signin") {
      const handoffToken = jwt.sign({ accessToken }, JWT_SECRET, { expiresIn: "60s" });
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
      const confirmToken = jwt.sign({ accessToken, sessionId, repoSlug }, JWT_SECRET, { expiresIn: "5m" });

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
    const portfolio = portfolioStore.get(pending.sessionId);
    if (!portfolio) {
      throw new Error("Portfolio session expired. Please generate again.");
    }

    const { liveUrl, repoName } = await deployToGitHubPages({
      accessToken: pending.accessToken,
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
    if (!decoded.accessToken) throw new Error("Malformed handoff token.");
    res.json({ accessToken: decoded.accessToken });
  } catch (err) {
    res.status(400).json({ error: "This sign-in link has expired. Please sign in again." });
  }
});

// ── Profile sync: reads/writes the signed-in user's secret Gist. ──
// Fully stateless on our side — the token travels with every request.
app.get("/profile/sync", apiLimiter, requireBearerToken, async (req, res) => {
  try {
    const { username, profile } = await getProfile({ accessToken: req.githubToken });
    res.json({ username, profile });
  } catch (err) {
    console.error("Profile sync (read) error:", err);
    res.status(500).json({ error: err.message || "Failed to load your synced profile." });
  }
});

app.put("/profile/sync", apiLimiter, requireBearerToken, async (req, res) => {
  try {
    const saved = await saveProfile({ accessToken: req.githubToken, data: req.body });
    res.json({ profile: saved });
  } catch (err) {
    console.error("Profile sync (write) error:", err);
    res.status(500).json({ error: err.message || "Failed to save your synced profile." });
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

module.exports = app;
module.exports.portfolioStore = portfolioStore;
module.exports.clampPortfolioEdits = clampPortfolioEdits;
// Exposed only so tests can sign valid handoff/confirm tokens themselves
// without going through a real GitHub OAuth round trip.
module.exports.JWT_SECRET = JWT_SECRET;
