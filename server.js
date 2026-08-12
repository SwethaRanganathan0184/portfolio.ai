const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const { extractText } = require("./src/extract");
const { generatePortfolioData, generateTheme, generateCoverLetter } = require("./src/ai");
const { generateHTML } = require("./src/generator");
const { deployToGitHubPages } = require("./src/deploy");

const app = express();

const JWT_SECRET = process.env.JWT_SECRET || "portfolio_secret_key_12345!";

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

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// ── Multer Storage Configuration ──
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
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
// Key: sessionId, Value: { html, name }
const portfolioStore = new Map();

// ── Main generation endpoint ──
app.post("/generate", generateLimiter, upload.single("resume"), async (req, res) => {
  const filePath = req.file?.path;
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    // Read options
    const style = req.body.style || "minimalism";
    const title = req.body.title || "";
    const favicon = req.body.favicon || "";
    let colors = {};
    if (req.body.colors) {
      try {
        colors = typeof req.body.colors === "string" ? JSON.parse(req.body.colors) : req.body.colors;
      } catch (e) {
        // Fallback if parsing fails
      }
    }

    const resumeText = await extractText(filePath);
    const portfolioData = await generatePortfolioData(resumeText);
    const theme = await generateTheme(portfolioData);
    const html = generateHTML(portfolioData, theme, { style, title, favicon, colors });

    // Clean up uploaded file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Store portfolio session
    const sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2);
    portfolioStore.set(sessionId, { html, name: portfolioData.name });

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

// ── GitHub OAuth Step 1: Redirect to GitHub with Secure JWT State ──
app.get("/auth/github", apiLimiter, (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId || !portfolioStore.has(sessionId)) {
    return res.status(400).send("Invalid or expired session. Please generate again.");
  }

  // Cryptographically sign the sessionId in state parameter using JWT to prevent CSRF
  const stateToken = jwt.sign({ sessionId }, JWT_SECRET, { expiresIn: "15m" });

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
    let sessionId;
    try {
      const decoded = jwt.verify(stateToken, JWT_SECRET);
      sessionId = decoded.sessionId;
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

    // Get portfolio HTML from memory store
    const portfolio = portfolioStore.get(sessionId);
    if (!portfolio) {
      throw new Error("Portfolio session expired. Please generate again.");
    }

    // Deploy using modular deploy.js logic
    const { liveUrl } = await deployToGitHubPages({
      accessToken,
      html: portfolio.html,
      portfolioName: portfolio.name
    });

    res.redirect(`/?deployed=true&url=${encodeURIComponent(liveUrl)}&name=${encodeURIComponent(portfolio.name)}`);

  } catch (err) {
    console.error("OAuth callback error:", err);
    res.redirect(`/?error=${encodeURIComponent(err.message)}`);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  ✦ Portfol.io running at http://localhost:${PORT}\n`);
});