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

// ── Sanitizer bypass shapes ──
// The tests above use the literal payloads each filter was written for. These
// use the shapes that defeated the previous regex-based sanitizer: payloads
// that only become dangerous after the CSS tokenizer decodes escapes, or that
// reassemble themselves when an inner match is stripped.

const customBlockOf = (html) => {
  const start = html.indexOf('<style id="custom-design-overrides">');
  return start === -1 ? "" : html.slice(start, html.indexOf("</style>", start) + "</style>".length);
};

test("a nested end tag can't reassemble into a working </style> breakout", () => {
  const html = generateHTML(baseData(), baseTheme(), {
    customCSS: "<</style>/style><</style>img src=x onerror=alert(1)>",
  });
  // Exactly one </style> may appear after the block opens: its own closing tag.
  const afterOpen = html.slice(html.indexOf('<style id="custom-design-overrides">'));
  assert.equal(afterOpen.split(/<\/style/i).length - 1, 1);
  assert.ok(!/<img src=x onerror/i.test(afterOpen.slice(afterOpen.indexOf("</style>"))));
});

test("CSS-escaped url( is decoded before filtering, so it can't load anything", () => {
  const html = generateHTML(baseData(), baseTheme(), {
    customCSS: "body{background:\\75rl(https://evil.example/t.png)}",
  });
  assert.ok(!customBlockOf(html).includes("evil.example"));
});

test("image-set() with a plain string is blocked, not just url()", () => {
  const html = generateHTML(baseData(), baseTheme(), {
    customCSS: 'body{background-image:image-set("https://evil.example/t.png" 1x)}',
  });
  assert.ok(!customBlockOf(html).includes("evil.example"));
});

test("a CSS-escaped @import is decoded and removed", () => {
  const html = generateHTML(baseData(), baseTheme(), {
    customCSS: '@\\69mport "https://evil.example/x.css"; .a{color:red}',
  });
  const block = customBlockOf(html);
  assert.ok(!/@import/i.test(block));
  assert.ok(!block.includes("evil.example"));
  assert.ok(block.includes("color:red"));
});

test("hiding nav via a compound selector like nav:not(...) is still reverted", () => {
  const html = generateHTML(baseData(), baseTheme(), { customCSS: "nav:not(#x){display:none}" });
  assert.ok(!customBlockOf(html).includes("display:none"));
});

test("a plain < in a media range query is preserved (only </ is escaped)", () => {
  const html = generateHTML(baseData(), baseTheme(), {
    customCSS: "@media (width < 600px) { .a { color: red; } }",
  });
  assert.ok(customBlockOf(html).includes("(width < 600px)"));
});

test("an AI-chosen font name can't break out of the CSS string it's placed in", () => {
  const theme = baseTheme();
  theme.font = "x'; } </style><script>alert(1)</script>";
  const html = generateHTML(baseData(), theme, {});
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.ok(html.includes("--font: 'Inter', sans-serif;"));
});

// ── Uploaded favicon (options.faviconData) ──

// A real 1x1 PNG, so the signature check runs against genuine PNG bytes.
const TINY_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const faviconLinkOf = (html) => (html.match(/<link rel="icon" href="([^"]*)"/) || [])[1];

test("an uploaded PNG favicon is embedded as-is", () => {
  const html = generateHTML(baseData(), baseTheme(), { faviconData: TINY_PNG });
  assert.equal(faviconLinkOf(html), TINY_PNG);
});

test("an uploaded favicon takes precedence over the emoji/URL text field", () => {
  const html = generateHTML(baseData(), baseTheme(), { faviconData: TINY_PNG, favicon: "🚀" });
  assert.equal(faviconLinkOf(html), TINY_PNG);
});

test("a data URL claiming to be PNG but containing other bytes is rejected", () => {
  const gifBytes = Buffer.from("GIF89a\x01\x00\x01\x00\x00\x00\x00;").toString("base64");
  const html = generateHTML(baseData(), baseTheme(), { faviconData: `data:image/png;base64,${gifBytes}`, favicon: "🚀" });
  assert.notEqual(faviconLinkOf(html), `data:image/png;base64,${gifBytes}`);
  assert.ok(faviconLinkOf(html).startsWith("data:image/svg+xml,"), "should fall back to the emoji favicon");
});

test("non-PNG data URL types, SVG included, are rejected", () => {
  for (const faviconData of [
    TINY_PNG.replace("image/png", "image/jpeg"),
    "data:image/svg+xml;base64," + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString("base64"),
  ]) {
    const html = generateHTML(baseData(), baseTheme(), { faviconData });
    assert.notEqual(faviconLinkOf(html), faviconData);
  }
});

test("a favicon data URL can't break out of the href attribute", () => {
  const html = generateHTML(baseData(), baseTheme(), { faviconData: TINY_PNG + '" onload="alert(1)' });
  assert.ok(!html.includes('onload="alert(1)'));
});

test("an oversized favicon data URL is rejected", () => {
  const huge = TINY_PNG + "A".repeat(60000);
  const html = generateHTML(baseData(), baseTheme(), { faviconData: huge });
  assert.ok(!html.includes("A".repeat(1000)));
});

// ── Visual style layers (src/styles.js) ──

test("each built-in style emits its own distinct design layer", () => {
  const signatures = {
    minimalism: "counter(sec, decimal-leading-zero)",
    glassmorphism: "section:not(#hero) > .container",
    brutalism: "--bw: 3px",
    playful: "underline wavy",
    editorial: "column-count: 2",
    terminal: "term-blink",
    bento: "grid-auto-flow: dense",
    neon: "rotate: x 58deg",
  };
  for (const [style, signature] of Object.entries(signatures)) {
    const html = generateHTML(baseData(), baseTheme(), { style });
    assert.ok(html.includes(signature), `${style} layer missing its signature rule`);
    for (const [other, otherSig] of Object.entries(signatures)) {
      if (other !== style) assert.ok(!html.includes(otherSig), `${style} leaked ${other}'s rules`);
    }
  }
});

test("styles load their own display fonts alongside the AI-picked font", () => {
  const brutal = generateHTML(baseData(), baseTheme(), { style: "brutalism" });
  assert.ok(brutal.includes("family=Inter:wght@300;400;500;600;700"));
  assert.ok(brutal.includes("family=Space+Grotesk:wght@400;500;700"));
  assert.ok(brutal.includes("family=Space+Mono:wght@400;700"));
  const playful = generateHTML(baseData(), baseTheme(), { style: "playful" });
  assert.ok(playful.includes("family=Fredoka"));
});

test("the style layer comes after the base stylesheet but before the print rules", () => {
  const html = generateHTML(baseData(), baseTheme(), { style: "brutalism" });
  const base = html.indexOf(".project-card {");
  const layer = html.indexOf("--bw: 3px");
  const print = html.indexOf("@media print");
  assert.ok(base < layer && layer < print);
});

test("an unknown style name renders the plain base design and is never echoed into the page", () => {
  const html = generateHTML(baseData(), baseTheme(), { style: "*/ </style><script>alert(1)</script>" });
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.ok(html.includes("Visual style layer (base)"));
});

test("brutalism keeps the CTA on the primary color so its pre-computed text color stays readable", () => {
  // Regression: the old brutalism theme set the button background to the
  // light --surface while its text stayed white (computed against --primary),
  // making "Get in touch" nearly invisible.
  const html = generateHTML(baseData(), baseTheme(), { style: "brutalism" });
  const ctaRule = html.slice(html.indexOf("[data-theme] .hero-cta {"), html.indexOf("[data-theme] .hero-cta:hover"));
  assert.ok(!/background\s*:/.test(ctaRule), "brutalism must not override the CTA background");
});

// ── Personalization: sections, links, certifications, avatar, fonts, CTA ──

const navOf = (html) => (html.match(/<ul class="nav-links">([\s\S]*?)<\/ul>/) || [])[1] || "";

test("hidden sections are neither rendered nor linked in the nav", () => {
  const html = generateHTML(baseData(), baseTheme(), { sections: { hidden: ["skills", "projects"] } });
  assert.ok(!html.includes('<section id="skills">'));
  assert.ok(!html.includes('<section id="projects">'));
  assert.ok(!navOf(html).includes("#projects"));
  assert.ok(html.includes('<section id="experience">'));
});

test("sections follow the requested order, and unknown keys are ignored", () => {
  const html = generateHTML(baseData(), baseTheme(), { sections: { order: ["contact", "bogus", "projects", "about"] } });
  const pos = (id) => html.indexOf(`<section id="${id}">`);
  assert.ok(pos("contact") < pos("projects") && pos("projects") < pos("about"));
  // Keys not listed keep their default relative order after the listed ones.
  assert.ok(pos("about") < pos("skills") && pos("skills") < pos("experience"));
  assert.ok(!html.includes('<section id="bogus">'));
});

test("custom section labels are escaped and also used in the nav", () => {
  const html = generateHTML(baseData(), baseTheme(), { sections: { labels: { projects: "Selected <b>Work</b>" } } });
  assert.ok(html.includes("Selected &lt;b&gt;Work&lt;/b&gt;"));
  assert.ok(!html.includes("<b>Work</b>"));
  assert.ok(navOf(html).includes("Selected &lt;b&gt;Work&lt;/b&gt;"));
});

test("sections with no content are skipped instead of rendering an empty heading", () => {
  const data = baseData();
  data.projects = [];
  const html = generateHTML(data, baseTheme(), {});
  assert.ok(!html.includes('<section id="projects">'));
  assert.ok(!html.includes('<section id="certifications">'), "no certifications in the resume means no section");
});

test("hiding the contact section also removes the hero button that scrolls to it", () => {
  const html = generateHTML(baseData(), baseTheme(), { sections: { hidden: ["contact"] } });
  assert.ok(!html.includes('class="hero-cta'));
});

test("the hero button text can be customized and is escaped", () => {
  const html = generateHTML(baseData(), baseTheme(), { ctaLabel: "Hire <me>" });
  assert.ok(html.includes("Hire &lt;me&gt;"));
});

test("certifications render as their own section when the resume has them", () => {
  const data = baseData();
  data.certifications = ["AWS Certified Developer", "<script>x</script>"];
  const html = generateHTML(data, baseTheme(), {});
  assert.ok(html.includes('<section id="certifications">'));
  assert.ok(html.includes("AWS Certified Developer"));
  assert.ok(!html.includes("<script>x</script>"));
});

test("extra links get a service icon and default label from their hostname", () => {
  const html = generateHTML(baseData(), baseTheme(), {
    links: [{ label: "", url: "https://x.com/priya" }, { label: "My Talk", url: "https://www.youtube.com/watch?v=1" }],
  });
  assert.ok(html.includes('href="https://x.com/priya"'));
  assert.match(html, /href="https:\/\/x\.com\/priya"[\s\S]*?<span>X<\/span>/);
  assert.ok(html.includes("<span>My Talk</span>"));
});

test("extra links drop non-http(s) URLs, escape labels, and cap at 6", () => {
  const links = [
    { label: "bad", url: "javascript:alert(1)" },
    { label: "<img src=x>", url: "https://example.com/a" },
    ...Array.from({ length: 10 }, (_, i) => ({ label: `L${i}`, url: `https://example.com/${i}` })),
  ];
  const html = generateHTML(baseData(), baseTheme(), { links });
  assert.ok(!html.includes("javascript:"));
  assert.ok(html.includes("&lt;img src=x&gt;"));
  assert.ok(!html.includes("https://example.com/8"), "only the first 6 links are used");
});

test("an uploaded JPEG profile photo is embedded in the hero", () => {
  const jpeg = "data:image/jpeg;base64," + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1]).toString("base64");
  const html = generateHTML(baseData(), baseTheme(), { avatarData: jpeg });
  assert.ok(html.includes(`<img class="hero-avatar gsap-reveal" src="${jpeg}"`));
});

test("a profile photo whose bytes don't match its declared type is rejected", () => {
  const fakeJpeg = "data:image/jpeg;base64," + Buffer.from("not really a jpeg").toString("base64");
  const html = generateHTML(baseData(), baseTheme(), { avatarData: fakeJpeg });
  assert.ok(!html.includes('class="hero-avatar'));
});

test("a font pairing loads its fonts and overrides fonts after the style layer", () => {
  const html = generateHTML(baseData(), baseTheme(), { style: "terminal", fontPair: "editorial" });
  assert.ok(html.includes("family=Playfair+Display"));
  assert.ok(html.indexOf("Font pairing: editorial") > html.indexOf("term-blink"), "the user's pairing must win over the theme's fonts");
});

test("an unknown font pairing is ignored rather than echoed into the page", () => {
  const html = generateHTML(baseData(), baseTheme(), { fontPair: "x'; } </style><script>alert(1)</script>" });
  assert.ok(!html.includes("Font pairing:"));
  assert.ok(!html.includes("<script>alert(1)</script>"));
});
