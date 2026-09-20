const test = require("node:test");
const assert = require("node:assert/strict");
const { generateHTML, PORTFOLIO_MARKER } = require("../src/generator");

const baseData = () => ({
  name: "Jane Doe",
  tagline: "Software Engineer",
  about: "I build things.",
  cta: "Get in touch",
  email: "jane@example.com",
  phone: "+1 555 123 4567",
  github: "https://github.com/janedoe",
  linkedin: "https://linkedin.com/in/janedoe",
  website: "https://jane.dev",
  skills: ["JavaScript", "Node.js"],
  experience: [{ company: "Acme", role: "Engineer", period: "2020-2024", highlight: "Shipped things" }],
  projects: [{ title: "Cool Project", description: "It does stuff.", tags: ["JS"], url: "https://proj.dev" }],
});

const baseTheme = () => ({
  font: "Inter",
  light: { primary: "#111111", secondary: "#222222", background: "#ffffff", accent: "#00aa00" },
  dark: { primary: "#eeeeee", secondary: "#dddddd", background: "#000000", accent: "#00ffaa" },
});

test("embeds the Portfol.io marker so deploy.js can detect its own output", () => {
  const html = generateHTML(baseData(), baseTheme(), {});
  assert.ok(html.includes(PORTFOLIO_MARKER));
});

test("renders normally with no XSS payloads present", () => {
  const html = generateHTML(baseData(), baseTheme(), { style: "glassmorphism" });
  assert.ok(html.includes("Jane Doe"));
  assert.ok(html.includes("jane@example.com"));
  assert.ok(html.includes("https://github.com/janedoe"));
});

test("escapes a malicious name/tagline/about/cta instead of injecting raw markup", () => {
  const data = baseData();
  data.name = '<script>alert(1)</script>Jane';
  data.tagline = 'Builder</style><script>alert(2)</script>';
  data.about = 'About <img src=x onerror=alert(3)>';
  data.cta = 'CTA"><script>alert(4)</script>';

  const html = generateHTML(data, baseTheme(), {});
  assert.ok(!html.includes("<script>alert(1)"));
  assert.ok(!html.includes("<script>alert(2)"));
  // The <img> tag itself must be neutralized (escaped to inert text) — its
  // onerror text surviving harmlessly inside &lt;...&gt; is fine and expected.
  assert.ok(!html.includes("<img src=x onerror=alert(3)>"));
  assert.ok(html.includes("&lt;img src=x onerror=alert(3)&gt;"));
  assert.ok(!html.includes("<script>alert(4)"));
});

test("drops javascript: URLs from github/linkedin/website/project links", () => {
  const data = baseData();
  data.github = "javascript:alert(1)";
  data.linkedin = "javascript:alert(2)";
  data.website = "javascript:alert(3)";
  data.projects = [{ title: "P", description: "d", tags: [], url: "javascript:alert(4)" }];

  const html = generateHTML(data, baseTheme(), {});
  assert.ok(!html.includes("javascript:"));
});

test("escapes a malicious page title and favicon supplied via options", () => {
  const html = generateHTML(baseData(), baseTheme(), {
    title: "</title><script>alert(1)</script>",
    favicon: '"><script>alert(2)</script>',
  });
  assert.ok(!html.includes("<script>alert(1)"));
  assert.ok(!html.includes("<script>alert(2)"));
});

test("rejects a color value that attempts CSS/style-block injection", () => {
  const html = generateHTML(baseData(), baseTheme(), {
    colors: { primary: "red; } </style><script>alert(1)</script>", accent: "#ff00ff", background: "#123456" },
  });
  assert.ok(!html.includes("<script>alert(1)"));
  // Valid colors still get applied
  assert.ok(html.includes("#ff00ff"));
  assert.ok(html.includes("#123456"));
});

test("accepts a valid custom 3-color palette", () => {
  const html = generateHTML(baseData(), baseTheme(), {
    colors: { primary: "#ff0000", accent: "#00ff00", background: "#0000ff" },
  });
  assert.ok(html.includes("#ff0000"));
  assert.ok(html.includes("#00ff00"));
});

test("renders without throwing for every built-in style", () => {
  for (const style of ["minimalism", "glassmorphism", "brutalism", "playful"]) {
    assert.doesNotThrow(() => generateHTML(baseData(), baseTheme(), { style }));
  }
});

test("picks readable (AA-contrast) hero-button text for a very light custom primary", () => {
  const html = generateHTML(baseData(), baseTheme(), { colors: { primary: "#f5f5f5" } });
  assert.match(html, /\[data-theme="light"\] \.hero-cta \{ color: #111111; \}/);
});

test("includes a print stylesheet and a working Save-as-PDF button", () => {
  const html = generateHTML(baseData(), baseTheme(), {});
  assert.match(html, /@media print/);
  assert.ok(html.includes('id="printBtn"'));
  assert.ok(html.includes("window.print()"));
  // The print stylesheet must hide the button/nav so they never appear on paper
  assert.match(html, /\.print-btn\s*\{\s*display:\s*none\s*!important;?\s*\}|nav,\s*#scroll-progress,\s*\.print-btn/);
});

test("picks readable (AA-contrast) hero-button text for a very dark custom primary", () => {
  const html = generateHTML(baseData(), baseTheme(), { colors: { primary: "#0a0a0a" } });
  assert.match(html, /\[data-theme="light"\] \.hero-cta \{ color: #ffffff; \}/);
});
