const Groq = require("groq-sdk");
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

// openai/gpt-oss-120b: OpenAI's own open-weight 120B reasoning model, hosted
// on Groq's free tier (no card required, ~1,000 requests/day vs. Gemini's
// free tier which was capped at ~20/day and kept retiring model names under
// us). It supports Groq's "strict" JSON Schema structured-output mode, which
// uses constrained decoding to *guarantee* the response matches our schema —
// stronger guarantee than Gemini's best-effort responseMimeType: "application/json".
const DEFAULT_MODEL = "openai/gpt-oss-120b";

// Lazily constructed: unlike the previous Gemini SDK (which only failed on
// an actual API call), `new Groq(...)` throws immediately if GROQ_API_KEY is
// missing. Building the client on first use — rather than at module load —
// keeps requiring this file safe even when no key is configured (e.g. in
// tests that never touch AI generation), matching the old behavior.
let _groqClient;
function getClient() {
  if (!_groqClient) {
    _groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groqClient;
}

function getModel() {
  return process.env.GROQ_MODEL || DEFAULT_MODEL;
}

// Nullable string, in the `type: [..., "null"]` shape structured-output
// strict mode expects for an optional field (all fields are `required` under
// strict mode; a field the model has nothing for reports `null` instead of
// being omitted).
const nullableString = { type: ["string", "null"] };

/**
 * Calls the model with Structured Outputs (strict JSON Schema) so the
 * response is guaranteed to parse and match `schema`. Still defensively
 * strips markdown fences before parsing, in case of a non-strict fallback
 * path or a model swap later that doesn't support strict mode.
 *
 * @param {Object} params
 * @param {string} params.prompt
 * @param {string} params.schemaName - a-z, A-Z, 0-9, underscores/dashes only.
 * @param {Object} params.schema - JSON Schema for the expected object.
 * @returns {Promise<Object>}
 */
async function generateStructured({ prompt, schemaName, schema }) {
  const completion = await getClient().chat.completions.create({
    model: getModel(),
    messages: [{ role: "user", content: prompt }],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: schemaName,
        schema,
        strict: true,
      },
    },
  });

  const text = completion.choices[0]?.message?.content || "";
  try {
    return JSON.parse(text);
  } catch (e) {
    const cleaned = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  }
}

async function generatePortfolioData(resumeText) {
  const prompt = `
    You are an expert portfolio copywriter and technical recruiter. Given the following resume text,
    generate compelling portfolio website content.

    CRITICAL ATS-FRIENDLY & COPYWRITING INSTRUCTIONS:
    - Optimize the phrasing using professional, industry-standard, and ATS-friendly action verbs (e.g., "orchestrated", "engineered", "streamlined", "spearheaded").
    - DO NOT alter the core context, level of merit, years of experience, or degree of expertise. Do not inflate roles (e.g., do not turn a "Junior Engineer" into a "Lead Architect" or claim unearned certifications).
    - Maintain factual truth. Keep the levels of responsibility, impact, and technical depth identical to the resume.
    - Rewrite achievements to be impact-oriented (Focus on action + metric/result where available in the resume).

    For any field with no corresponding information in the resume, use null (for single values) or an empty array (for lists) — never invent a placeholder.

    Resume:
    ${resumeText}

    Fields:
    - name: full name
    - tagline: one punchy headline describing who they are professionally
    - about: 3 sentences in first person. Make it engaging, human, and clear. Avoid generic corporate buzzwords.
    - email: email address if found anywhere in resume, otherwise null
    - linkedin: full linkedin.com URL if found, otherwise null. Must start with https:// (e.g. https://linkedin.com/in/username)
    - github: full github.com URL if found, otherwise null. Must start with https:// (e.g. https://github.com/username)
    - website: full personal website/portfolio URL if found (not linkedin/github), otherwise null. Must start with https://
    - phone: phone number if found, otherwise null
    - skills: list of skills
    - experience: list of {company, role, period (start date - end date), highlight (single most impressive achievement in one sentence using strong action verbs)}
    - projects: list of {title, description (2 sentences, focus on what it does and the business/technical impact), tags (tech keywords), url (project url if mentioned, otherwise null, must start with https://)}
    - cta: one short friendly sentence inviting people to get in touch
  `;

  const schema = {
    type: "object",
    properties: {
      name: { type: "string" },
      tagline: { type: "string" },
      about: { type: "string" },
      email: nullableString,
      linkedin: nullableString,
      github: nullableString,
      website: nullableString,
      phone: nullableString,
      skills: { type: "array", items: { type: "string" } },
      experience: {
        type: "array",
        items: {
          type: "object",
          properties: {
            company: { type: "string" },
            role: { type: "string" },
            period: { type: "string" },
            highlight: { type: "string" },
          },
          required: ["company", "role", "period", "highlight"],
          additionalProperties: false,
        },
      },
      projects: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            url: nullableString,
          },
          required: ["title", "description", "tags", "url"],
          additionalProperties: false,
        },
      },
      cta: { type: "string" },
    },
    required: [
      "name", "tagline", "about", "email", "linkedin", "github",
      "website", "phone", "skills", "experience", "projects", "cta",
    ],
    additionalProperties: false,
  };

  return generateStructured({ prompt, schemaName: "portfolio_data", schema });
}

async function generateTheme(portfolioData) {
  const prompt = `
    You are a UI designer. Based on this person's professional profile,
    suggest a light mode AND dark mode color theme for their portfolio website.

    Their tagline: ${portfolioData.tagline}
    Their skills: ${portfolioData.skills.slice(0, 5).join(", ")}
    Their most recent role: ${portfolioData.experience[0]?.role || "professional"}

    Return a font name and a light/dark color set (all as hex codes, except
    shadow which is an rgba(...) string).

    Rules for light mode:
    - background: white or very light gray
    - surface: slightly darker than background for cards
    - surfaceHover: slightly darker than surface
    - text: very dark, near black
    - textLight: medium gray for secondary text
    - border: light gray
    - shadow: something like rgba(0,0,0,0.08)

    Rules for dark mode:
    - background: very dark, like #0f0f0f or #111827
    - surface: slightly lighter than background for cards, like #1a1a2e or #1f2937
    - surfaceHover: slightly lighter than surface
    - text: near white
    - textLight: light gray for secondary text
    - border: dark gray, subtle
    - primary: slightly brighter/more saturated version of light mode primary
    - shadow: something like rgba(0,0,0,0.3)

    Rules for both:
    - primary is the dominant brand color
    - accent is used for highlights and tags
    - For engineers: clean and minimal blues or greens
    - For designers: more creative purples or teals
    - For finance/business: corporate navy or deep blues
    - Make sure contrast ratios are accessible (text readable on background)
  `;

  const colorFields = {
    type: "object",
    properties: {
      primary: { type: "string" },
      secondary: { type: "string" },
      background: { type: "string" },
      surface: { type: "string" },
      surfaceHover: { type: "string" },
      text: { type: "string" },
      textLight: { type: "string" },
      accent: { type: "string" },
      border: { type: "string" },
      shadow: { type: "string" },
    },
    required: [
      "primary", "secondary", "background", "surface", "surfaceHover",
      "text", "textLight", "accent", "border", "shadow",
    ],
    additionalProperties: false,
  };

  const schema = {
    type: "object",
    properties: {
      font: { type: "string" },
      light: colorFields,
      dark: colorFields,
    },
    required: ["font", "light", "dark"],
    additionalProperties: false,
  };

  return generateStructured({ prompt, schemaName: "portfolio_theme", schema });
}

async function generateCoverLetter(resumeText, jobDescription) {
  const prompt = `
    You are an expert executive coach and professional copywriter.
    Write a highly tailored, professional, and compelling cover letter for a candidate applying to a position.

    Use the candidate's Resume Text and the target Job Description below:

    RESUME TEXT:
    ${resumeText}

    JOB DESCRIPTION:
    ${jobDescription}

    CRITICAL INSTRUCTIONS:
    1. Tailor the cover letter to highlight matching skills, experiences, and accomplishments from the Resume that directly address the requirements in the Job Description.
    2. DO NOT fabricate any facts, qualifications, years of experience, projects, or credentials. Everything mentioned must be strictly grounded in the candidate's Resume Text.
    3. Use a professional, confident, and engaging tone. Avoid generic buzzwords.
    4. Keep it concise: 3 to 4 paragraphs (plus formal header/salutation and sign-off).
    5. Return ONLY the plain text / markdown of the final cover letter. No explanations, no introductory remarks, no backticks.
  `;

  const completion = await getClient().chat.completions.create({
    model: getModel(),
    messages: [{ role: "user", content: prompt }],
  });

  return (completion.choices[0]?.message?.content || "").trim();
}

// Generates additional CSS, layered on top of an already-complete, working
// portfolio page, based on a free-text design brief the user wrote (e.g.
// "bohemian, warm brown palette" or "dark, moody developer terminal").
//
// IMPORTANT: the base theme (generateTheme()) already picked a color
// palette before this ever runs, and that palette lives in CSS custom
// properties (--primary, --accent, --bg, --surface, --text, etc.) that
// every component on the page is built on top of. If this prompt is told
// to "never invent colors, just reuse the existing variables", a brief
// asking for a different color palette is structurally impossible to
// satisfy — it'll always get the base theme's colors back, no matter what
// it asks for. So: when the brief implies specific colors or a mood with
// an obvious palette, this is explicitly told to OVERRIDE those variables
// with new literal colors at the same [data-theme="light"]/[data-theme="dark"]
// selectors the base theme uses — since this CSS is injected after the
// base stylesheet, the override wins the cascade and the new palette
// propagates everywhere automatically (nav, buttons, cards, borders...)
// without having to restyle each component individually.
async function generateCustomStyleCSS({ portfolioData, style, designBrief }) {
  const prompt = `
    You are a senior front-end designer doing a CSS-only visual pass on an
    existing, fully-functional one-page portfolio site. The page already has
    working layout, responsive behavior, a light/dark mode toggle, and
    accessible contrast — your job is to push the *feel* (and palette, if
    the brief implies one) of the page toward what the user describes below,
    without breaking any of that.

    Person's profile, for context only (do not add new text/content, you are
    only writing CSS):
    - Tagline: ${portfolioData.tagline}
    - Role: ${portfolioData.experience?.[0]?.role || "professional"}

    The current base visual style selected is: "${style}". Treat its colors
    as a starting point only, not something to preserve — the whole point of
    this feature is letting the user override them.

    USER'S DESIGN BRIEF (what they want this page to feel like):
    """
    ${designBrief}
    """

    If the brief references a well-known product or site by name (e.g. "like
    Stripe's site" or "like a terminal/IDE theme"), interpret it as a general
    aesthetic direction from what you know of it — you cannot browse or see
    the real page, so do not claim to replicate it exactly, just capture the
    spirit (color mood, shapes, typography feel, density) as CSS.

    ── Changing the color palette (do this whenever the brief names or
    implies specific colors, e.g. "brown", "pastel", "neon", "monochrome") ──
    The page's whole palette is driven by these CSS custom properties, set
    once per theme mode:
      [data-theme="light"] { --primary; --secondary; --bg; --surface;
        --surfaceHov; --text; --textLight; --accent; --border; --shadow; }
      [data-theme="dark"]  { --primary; --secondary; --bg; --surface;
        --surfaceHov; --text; --textLight; --accent; --border; --shadow; }
    To change the palette, redefine BOTH blocks above with new literal hex
    colors that match the brief (one block for light mode, one for dark —
    keep dark mode's --bg dark and light mode's --bg light; don't make light
    mode dark or vice versa, just use the brief's palette within each mode).
    Every component on the page (nav, buttons, cards, borders, text) is
    already built on these variables via var(--primary) etc., so redefining
    them here re-colors the entire site automatically — you do NOT need to
    (and should not) write separate color overrides for individual elements
    like nav or .project-card.
    Requirements when you do this:
      - --text on --bg, and --textLight on --bg, must stay clearly readable
        (treat this like AA contrast: dark text on a light --bg, light text
        on a dark --bg).
      - Also explicitly set these two rules with a color that reads clearly
        against YOUR new --primary, since they're pre-computed against the
        old palette and won't update automatically:
          [data-theme="light"] .hero-cta { color: ...; }
          [data-theme="dark"]  .hero-cta { color: ...; }
      - --accent should stay visually distinct from --primary and --bg.

    ── Changing the typeface (do this whenever the brief implies a type
    feel — "serif", "handwritten", "typewriter", "futuristic", "elegant",
    "playful", etc.) ──
    The page already loads ONE Google Font via a <link> tag you cannot add
    to — you have no way to load a second web font, so do NOT name a Google
    Font (no "Playfair Display", no "Space Mono", etc.) in font-family; it
    will silently fail to load and you'll get the browser's plain fallback
    with nothing gained. Instead redefine the --font variable itself with a
    web-safe stack the browser already has installed, picked to match the
    brief's feel, for example:
      --font: Georgia, 'Times New Roman', serif;              /* editorial, elegant, literary */
      --font: 'Courier New', 'Lucida Console', monospace;     /* terminal, technical, retro-code */
      --font: 'Brush Script MT', cursive;                     /* handwritten, personal, artsy */
      --font: 'Trebuchet MS', 'Segoe UI', sans-serif;          /* clean, modern, friendly */
      --font: Impact, 'Arial Black', sans-serif;               /* bold, loud, poster-like */
      --font: 'Papyrus', fantasy;                              /* earthy/bohemian/handcrafted */
    Redefine --font once per [data-theme] block (same two blocks as the
    color overrides above) and it cascades everywhere via the existing
    var(--font) rule — you don't need to set font-family on individual
    elements. You may still use font-weight/letter-spacing/text-transform
    for extra character within whatever stack you pick.

    ── Decorative touches / "clipart" (only if the brief calls for
    illustration, icons, or a decorative motif) ──
    You cannot load external images, icons, or illustrations (url() is
    blocked), so represent any requested motif using CSS alone:
    - Unicode/emoji characters placed via a pseudo-element's content
      property, e.g. section::before { content: "🌿"; } for a botanical
      brief, or a row of "✦" / "◆" / "〜" as a decorative divider between
      sections.
    - Shapes drawn from CSS itself: radial-gradient "blobs" in a corner,
      repeating-linear-gradient stripes/textures, clip-path polygons,
      border-radius asymmetry for an organic/hand-drawn feel.
    Keep these subtle and sized so they don't cover text or disrupt layout
    on narrow (mobile-width) screens — a few well-placed accents, not a
    background full of emoji.

    ── Everything else (shape, motion) ──
    You may also use: border-radius, box-shadow, padding/margin/spacing,
    CSS transitions and animations (CSS-only), gradients/patterns built
    from the variables above, backdrop-filter, transform/hover effects,
    custom borders. Relevant existing class/id names: nav, #hero,
    .hero-cta, section, .project-card, .skill-tag, .theme-toggle,
    #scroll-progress, footer, .contact-links.

    You must NOT:
    - use @import or url(...) (no external fonts, images, or resources)
    - write any <script>, <style>, or other HTML tags — CSS rules only
    - use "javascript:" anywhere
    - set display:none or visibility:hidden on nav, #scroll-progress,
      .theme-toggle, footer, .contact-links, or any element containing
      contact info
    - reduce body text below 14px, or remove focus-visible outlines without
      supplying a clearly visible replacement focus style
    - introduce horizontal scrolling on the page

    Return ONLY raw CSS rules. No markdown code fences, no explanation, no
    HTML — just the CSS text itself, ready to drop into a <style> tag.
  `;

  const completion = await getClient().chat.completions.create({
    model: getModel(),
    messages: [{ role: "user", content: prompt }],
  });

  const raw = (completion.choices[0]?.message?.content || "").trim();
  // Light cleanup here (the model sometimes wraps output in a fence despite
  // instructions); generator.js does the real security sanitization right
  // before this is embedded in the page.
  return raw.replace(/```css|```/gi, "").trim();
}

async function generateResumeReview(resumeText) {
  const prompt = `
    You are an expert resume reviewer and former corporate recruiter with deep
    knowledge of Applicant Tracking Systems (ATS).

    Critically evaluate the resume text below and return honest, specific,
    actionable feedback. Do not be flattering — a generic resume should score
    low. Do not invent facts about the candidate that aren't in the text.

    Resume:
    ${resumeText}

    Fields:
    - atsScore: integer 0-100, how well this resume would parse and rank in a typical ATS
    - summary: 2-3 sentence honest overall assessment
    - strengths: specific strengths grounded in the actual resume text (3-6 items, one concise sentence each)
    - weaknesses: specific weaknesses or gaps (3-6 items, one concise sentence each)
    - suggestions: specific, actionable improvements the candidate could make (3-6 items, one concise sentence each)

    Scoring rubric for atsScore:
    - 90-100: Excellent — quantified achievements, strong action verbs, clean structure, keyword-rich for its field
    - 70-89: Good — solid content but missing some metrics/keywords or has formatting issues
    - 50-69: Average — vague bullet points, few metrics, generic phrasing
    - Below 50: Weak — sparse content, no quantified impact, likely to be filtered out by ATS
  `;

  const schema = {
    type: "object",
    properties: {
      atsScore: { type: "integer" },
      summary: { type: "string" },
      strengths: { type: "array", items: { type: "string" } },
      weaknesses: { type: "array", items: { type: "string" } },
      suggestions: { type: "array", items: { type: "string" } },
    },
    required: ["atsScore", "summary", "strengths", "weaknesses", "suggestions"],
    additionalProperties: false,
  };

  return generateStructured({ prompt, schemaName: "resume_review", schema });
}

module.exports = { generatePortfolioData, generateTheme, generateCoverLetter, generateResumeReview, generateCustomStyleCSS };
