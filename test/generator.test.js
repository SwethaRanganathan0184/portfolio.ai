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

// ── Custom design-brief CSS (options.customCSS) ──

test("injects well-formed custom CSS into its own <style> tag, cascading after the base styles", () => {
  const html = generateHTML(baseData(), baseTheme(), {
    customCSS: ".hero-title { font-family: Georgia, serif; letter-spacing: 0.02em; }",
  });
  assert.ok(html.includes('<style id="custom-design-overrides">'));
  assert.ok(html.includes("font-family: Georgia, serif"));
  // The custom block must come after the main stylesheet, not before.
  assert.ok(html.indexOf('<style id="custom-design-overrides">') > html.indexOf("</style>"));
});

test("a custom-CSS palette override on [data-theme] wins over the base theme's colors", () => {
  // This is the actual bug report: the base theme already set --primary to
  // blue/purple, and the custom CSS needs to be able to override it with a
  // brief-requested palette (e.g. brown) rather than being stuck reusing
  // the base theme's variables. Confirms the override appears *after* the
  // base [data-theme="light"] block, so it wins the cascade.
  const html = generateHTML(baseData(), baseTheme(), {
    customCSS: '[data-theme="light"] { --primary: #6b4226; --bg: #f5efe6; } [data-theme="dark"] { --primary: #a97155; --bg: #2a211c; }',
  });
  const baseBlockIndex = html.indexOf('[data-theme="light"] {');
  const overrideIndex = html.lastIndexOf('[data-theme="light"] {');
  assert.ok(overrideIndex > baseBlockIndex, "override block must come after the base theme block");
  assert.ok(html.includes("#6b4226"));
  assert.ok(html.includes("#a97155"));
});

test("omits the custom-overrides style tag entirely when there's no custom CSS", () => {
  const html = generateHTML(baseData(), baseTheme(), {});
  assert.ok(!html.includes('id="custom-design-overrides"'));
});

test("strips script/html tags smuggled inside custom CSS", () => {
  const html = generateHTML(baseData(), baseTheme(), {
    customCSS: '.hero{color:red}</style><script>alert(1)</script><style>',
  });
  assert.ok(!html.includes("<script>alert(1)</script>"));
});

test("strips @import and url() from custom CSS so it can't load external resources", () => {
  const html = generateHTML(baseData(), baseTheme(), {
    customCSS: `@import url('https://evil.example/x.css'); .bg { background: url(https://evil.example/track.png); }`,
  });
  const customBlock = html.slice(html.indexOf('id="custom-design-overrides"'));
  assert.ok(!customBlock.includes("@import"));
  assert.ok(!customBlock.includes("evil.example"));
});

test("neutralizes javascript: and expression() in custom CSS", () => {
  const html = generateHTML(baseData(), baseTheme(), {
    customCSS: `.x { background: expression(alert(1)); } a { color: javascript:alert(1); }`,
  });
  const customBlock = html.slice(html.indexOf('id="custom-design-overrides"'));
  assert.ok(!customBlock.includes("expression("));
  assert.ok(!customBlock.includes("javascript:"));
});

test("force-reverts an attempt to hide nav/footer/contact-links via custom CSS", () => {
  const html = generateHTML(baseData(), baseTheme(), {
    customCSS: "nav { display: none; } footer { visibility: hidden; }",
  });
  const customBlock = html.slice(html.indexOf('id="custom-design-overrides"'));
  assert.ok(!customBlock.includes("display: none"));
  assert.ok(!customBlock.includes("visibility: hidden"));
});

test("ignores non-string/empty custom CSS without throwing", () => {
  assert.doesNotThrow(() => generateHTML(baseData(), baseTheme(), { customCSS: null }));
  assert.doesNotThrow(() => generateHTML(baseData(), baseTheme(), { customCSS: 12345 }));
  const html = generateHTML(baseData(), baseTheme(), { customCSS: "   " });
  assert.ok(!html.includes('id="custom-design-overrides"'));
});

test("strips decorative ::before/::after content off the hero name so it can't visually collide with the text", () => {
  const html = generateHTML(baseData(), baseTheme(), {
    customCSS: '.hero-name::before { content: "🌿"; font-size: 3rem; position: absolute; }',
  });
  const customBlock = html.slice(html.indexOf('id="custom-design-overrides"'));
  assert.ok(!customBlock.includes("🌿"));
  assert.match(customBlock, /\.hero-name::\s*before\s*\{\s*content:\s*none;\s*\}/);
});

test("still allows decorative content on a safe, non-heading element like a section divider", () => {
  const html = generateHTML(baseData(), baseTheme(), {
    customCSS: '.section-divider::before { content: "✦"; font-size: 1.2rem; margin-right: 0.5rem; }',
  });
  const customBlock = html.slice(html.indexOf('id="custom-design-overrides"'));
  assert.ok(customBlock.includes("✦"));
});
