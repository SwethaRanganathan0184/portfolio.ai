// Visual style layers for generated portfolios.
//
// Each style is a complete design layer — its own display/mono fonts and a
// stylesheet that reshapes the base page — rather than a few tweaks on top
// of one shared look. Layers are injected AFTER the base stylesheet, so they
// win the cascade at equal specificity and never need !important.
//
// Every layer is built only from the palette variables the base page defines
// (--primary, --accent, --secondary, --bg, --surface, --text, --textLight,
// --border, plus --on-primary, the text color pre-computed to be readable on
// --primary) so the user's AI-picked or custom colors still drive each style.
//
// Hover effects on GSAP-animated elements (.hero-cta, .project-card,
// .skill-tag, .theme-toggle, .print-btn) use the individual `translate` /
// `rotate` / `scale` properties, never `transform`: GSAP writes an inline
// `transform` during its reveal and magnetic-button animations, which would
// silently override any `transform` set in a stylesheet. The individual
// properties compose with `transform` instead of competing with it.

const STYLE_LAYERS = {
  minimalism: {
    fonts: [],
    css: `
    /* ── Minimalism: quiet, typographic, monochrome — color only as a whisper ── */
    [data-theme="light"] { --border: color-mix(in srgb, var(--text) 12%, transparent); }
    [data-theme="dark"]  { --border: color-mix(in srgb, var(--text) 14%, transparent); }
    body { counter-reset: sec; }

    nav { background: color-mix(in srgb, var(--bg) 94%, transparent); border-bottom-color: transparent; }
    .nav-name span { color: var(--text); }
    .nav-links a { letter-spacing: 0.04em; }
    .nav-links a:hover { color: var(--text); }
    .theme-toggle, .print-btn { border-color: transparent; background: transparent; }
    .theme-toggle:hover, .print-btn:hover { background: transparent; border-color: var(--border); color: var(--text); }
    #scroll-progress { height: 1px; background: var(--text); }

    .hero-bg { display: none; }
    #hero { border-bottom: none; }
    .hero-eyebrow { color: var(--textLight); font-weight: 400; letter-spacing: 0.32em; }
    .hero-name { font-weight: 300; letter-spacing: -0.045em; }
    .hero-avatar { box-shadow: none; border: 1px solid var(--border); filter: grayscale(1); }
    .hero-name .highlight { color: var(--text); font-weight: 600; }
    .hero-tagline { font-weight: 300; }
    [data-theme] .hero-cta {
      background: transparent; color: var(--text); border: 1px solid var(--text);
      border-radius: 0; font-weight: 500; letter-spacing: 0.05em;
    }
    [data-theme] .hero-cta:hover { background: var(--text); color: var(--bg); box-shadow: none; opacity: 1; }

    section { padding: 6.5rem 0; }
    section:not(#hero) { counter-increment: sec; }
    .section-label { color: var(--textLight); font-weight: 400; letter-spacing: 0.28em; margin-bottom: 3.25rem; }
    .section-label::before { content: counter(sec, decimal-leading-zero); color: var(--text); font-weight: 600; letter-spacing: 0.1em; }

    .about-text { font-size: 1.35rem; font-weight: 300; color: var(--text); line-height: 1.8; }
    .skills-grid { gap: 0.4rem 1.75rem; }
    .skill-tag { background: none; border: none; border-radius: 0; padding: 0.3rem 0; font-size: 0.98rem; color: var(--text); }
    .skill-tag:hover { background: none; color: var(--primary); translate: none; box-shadow: none; }
    .exp-company { color: var(--textLight); }

    .projects-grid { grid-template-columns: 1fr; gap: 0; }
    .project-card { background: transparent; border: none; border-top: 1px solid var(--border); border-radius: 0; }
    .project-card:last-child { border-bottom: 1px solid var(--border); }
    .project-card:hover { translate: none; box-shadow: none; border-color: var(--border); }
    .project-card:hover .project-title { text-decoration: underline; text-underline-offset: 5px; text-decoration-thickness: 1px; }
    .project-inner { padding: 2.25rem 0; }
    .project-title { font-size: 1.15rem; font-weight: 500; }
    .project-tag { background: none; color: var(--textLight); padding: 0; font-weight: 500; letter-spacing: 0.06em; }
    .project-tag + .project-tag::before { content: "·"; margin-right: 0.45rem; }

    .contact-link { color: var(--text); }
    .contact-link:hover { color: var(--primary); }
    footer { letter-spacing: 0.06em; }
    `,
  },

  glassmorphism: {
    fonts: ["Outfit:wght@300;400;500;600;700"],
    css: `
    /* ── Glassmorphism: frosted panels floating over a vivid, blurred color field ── */
    :root { --font-display: 'Outfit', var(--font); }
    [data-theme="light"] {
      --glass: rgba(255, 255, 255, 0.55);
      --glass-strong: rgba(255, 255, 255, 0.72);
      --glass-edge: rgba(255, 255, 255, 0.7);
      --glass-shadow: 0 12px 40px rgba(31, 38, 100, 0.14);
      --blob-a: color-mix(in srgb, var(--primary) 60%, transparent);
      --blob-b: color-mix(in srgb, var(--accent) 55%, transparent);
      --blob-c: color-mix(in srgb, var(--secondary) 50%, transparent);
      --border: rgba(255, 255, 255, 0.55);
    }
    [data-theme="dark"] {
      --glass: rgba(255, 255, 255, 0.06);
      --glass-strong: rgba(255, 255, 255, 0.1);
      --glass-edge: rgba(255, 255, 255, 0.16);
      --glass-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
      --blob-a: color-mix(in srgb, var(--primary) 50%, transparent);
      --blob-b: color-mix(in srgb, var(--accent) 38%, transparent);
      --blob-c: color-mix(in srgb, var(--secondary) 45%, transparent);
      --border: rgba(255, 255, 255, 0.12);
    }

    /* The color field. Glass only reads as glass when there's something
       colorful behind it to blur — over a flat background it's just a faded
       card. Fixed, so the blobs shift behind the panels as you scroll. */
    body::before {
      content: ""; position: fixed; inset: -10%; z-index: -1; pointer-events: none;
      background:
        radial-gradient(36% 40% at 16% 20%, var(--blob-a), transparent 70%),
        radial-gradient(32% 36% at 84% 28%, var(--blob-b), transparent 70%),
        radial-gradient(40% 42% at 62% 82%, var(--blob-c), transparent 70%),
        radial-gradient(30% 28% at 46% 52%, var(--blob-a), transparent 70%),
        radial-gradient(28% 30% at 8% 88%, var(--blob-b), transparent 70%);
      filter: blur(24px);
    }
    .hero-bg { display: none; }

    nav {
      top: 1rem; left: 50%; right: auto; translate: -50% 0;
      width: min(1100px, calc(100% - 2rem)); padding: 0.8rem 1.6rem; border-radius: 999px;
      background: var(--glass-strong); border: 1px solid var(--glass-edge);
      backdrop-filter: blur(20px) saturate(180%); -webkit-backdrop-filter: blur(20px) saturate(180%);
      box-shadow: var(--glass-shadow);
    }
    .nav-name { font-family: var(--font-display); }
    .theme-toggle, .print-btn {
      background: var(--glass); border: 1px solid var(--glass-edge);
      backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    }

    #hero { border-bottom: none; }
    .hero-avatar { border: 1px solid var(--glass-edge); box-shadow: var(--glass-shadow), 0 0 0 6px var(--glass); }
    .hero-name { font-family: var(--font-display); font-weight: 600; }
    .hero-name .highlight {
      background: linear-gradient(120deg, var(--primary), var(--accent));
      -webkit-background-clip: text; background-clip: text; color: transparent;
    }
    [data-theme] .hero-cta {
      border-radius: 999px;
      box-shadow: 0 10px 30px color-mix(in srgb, var(--primary) 45%, transparent), inset 0 1px 0 rgba(255, 255, 255, 0.35);
    }

    section { border-bottom: none; padding: 1.75rem 0; }
    section:not(#hero) > .container {
      width: min(860px, calc(100% - 2rem)); padding: 2.75rem 2.5rem; border-radius: 28px;
      background: var(--glass); border: 1px solid var(--glass-edge);
      backdrop-filter: blur(22px) saturate(170%); -webkit-backdrop-filter: blur(22px) saturate(170%);
      box-shadow: var(--glass-shadow), inset 0 1px 0 rgba(255, 255, 255, 0.35);
    }
    .section-label { font-family: var(--font-display); }

    /* Tinted with --primary: an untinted white pill on a white glass panel
       has no visible edge at all in light mode. */
    .skill-tag {
      background: color-mix(in srgb, var(--primary) 12%, var(--glass-strong));
      border: 1px solid color-mix(in srgb, var(--primary) 25%, var(--glass-edge)); color: var(--text);
      backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    }
    .skill-tag:hover { background: color-mix(in srgb, var(--primary) 20%, var(--glass-strong)); border-color: var(--primary); }

    .project-card {
      border-radius: 20px; background: var(--glass-strong); border: 1px solid var(--glass-edge);
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3);
    }
    .project-card:hover { box-shadow: var(--glass-shadow); border-color: color-mix(in srgb, var(--primary) 55%, var(--glass-edge)); }
    .project-title { font-family: var(--font-display); }
    .project-tag { border-radius: 999px; background: color-mix(in srgb, var(--accent) 18%, transparent); }

    footer { border-top: none; }

    @media (max-width: 600px) {
      section:not(#hero) > .container { padding: 2rem 1.4rem; border-radius: 22px; }
    }
    `,
  },

  brutalism: {
    fonts: ["Space Grotesk:wght@400;500;700", "Space Mono:wght@400;700"],
    css: `
    /* ── Brutalism: raw structure, heavy type, hard edges — no polish, on purpose ── */
    :root { --font-display: 'Space Grotesk', var(--font); --font-mono: 'Space Mono', ui-monospace, monospace; --bw: 3px; }
    [data-theme="light"] {
      --bg: color-mix(in srgb, var(--light-bg) 70%, #fff6d6);
      --surface: #ffffff;
      --ink: #111111;
      --hard: #111111;
      --border: #111111;
      --textLight: #333333;
    }
    [data-theme="dark"] {
      --surface: color-mix(in srgb, var(--dark-bg) 88%, white);
      --ink: var(--text);
      --hard: var(--primary);
      --border: var(--text);
    }

    nav { background: var(--bg); backdrop-filter: none; -webkit-backdrop-filter: none; border-bottom: var(--bw) solid var(--ink); }
    .nav-name { font-family: var(--font-display); font-weight: 700; text-transform: uppercase; }
    .nav-links a { font-family: var(--font-mono); text-transform: uppercase; font-size: 0.78rem; color: var(--text); padding: 0.2rem 0.4rem; }
    .nav-links a:hover { background: var(--ink); color: var(--bg); }
    .theme-toggle, .print-btn { border-radius: 0; border: var(--bw) solid var(--ink); background: var(--surface); box-shadow: 3px 3px 0 var(--hard); }
    .theme-toggle:hover, .print-btn:hover { background: var(--surface); color: var(--text); border-color: var(--ink); translate: -1px -1px; box-shadow: 4px 4px 0 var(--hard); }
    #scroll-progress { height: 6px; background: var(--primary); }

    .hero-bg { display: none; }
    #hero { border-bottom: var(--bw) solid var(--ink); }
    .hero-eyebrow { font-family: var(--font-mono); display: inline-block; background: var(--ink); color: var(--bg); padding: 0.25rem 0.6rem; }
    .hero-avatar { border-radius: 0; border: var(--bw) solid var(--ink); box-shadow: 6px 6px 0 var(--hard); }
    .hero-name { font-family: var(--font-display); font-weight: 700; text-transform: uppercase; letter-spacing: -0.03em; line-height: 0.95; }
    .hero-name .highlight {
      background: var(--primary); color: var(--on-primary); padding: 0 0.12em;
      -webkit-box-decoration-break: clone; box-decoration-break: clone;
    }
    .hero-tagline { font-family: var(--font-mono); color: var(--text); font-size: 1rem; border-left: var(--bw) solid var(--ink); padding-left: 1rem; }
    [data-theme] .hero-cta {
      border-radius: 0; border: var(--bw) solid var(--ink); box-shadow: 6px 6px 0 var(--ink);
      font-family: var(--font-mono); font-weight: 700; text-transform: uppercase;
    }
    [data-theme] .hero-cta:hover { translate: -2px -2px; box-shadow: 8px 8px 0 var(--ink); opacity: 1; }
    [data-theme] .hero-cta:active { translate: 4px 4px; box-shadow: 2px 2px 0 var(--ink); }

    section { border-bottom: var(--bw) solid var(--ink); }
    .section-label {
      display: inline-flex; font-family: var(--font-mono); font-size: 0.8rem; font-weight: 700;
      color: var(--bg); background: var(--ink); padding: 0.3rem 0.7rem; letter-spacing: 0.1em;
    }
    .section-label::after { display: none; }

    .about-text { font-size: 1.25rem; font-weight: 500; color: var(--text); }
    .skill-tag {
      font-family: var(--font-mono); text-transform: uppercase; font-size: 0.78rem; border-radius: 0;
      border: 2px solid var(--ink); background: var(--surface); color: var(--text); box-shadow: 3px 3px 0 var(--hard);
    }
    .skill-tag:hover { background: var(--ink); color: var(--bg); border-color: var(--ink); translate: -1px -1px; box-shadow: 4px 4px 0 var(--hard); }

    .exp-item { border-bottom: 2px dashed var(--ink); }
    .exp-period { font-family: var(--font-mono); font-weight: 700; color: var(--text); }
    .exp-role { font-family: var(--font-display); text-transform: uppercase; font-size: 1.1rem; }
    .exp-company { font-family: var(--font-mono); color: var(--text); text-decoration: underline; text-decoration-color: var(--primary); text-decoration-thickness: 3px; }

    .project-card { border-radius: 0; border: var(--bw) solid var(--ink); background: var(--surface); box-shadow: 6px 6px 0 var(--hard); }
    .project-card:hover { border-color: var(--ink); translate: -3px -3px; box-shadow: 9px 9px 0 var(--hard); }
    .project-title { font-family: var(--font-display); text-transform: uppercase; font-size: 1.15rem; }
    .project-tag { font-family: var(--font-mono); text-transform: uppercase; border-radius: 0; background: transparent; color: var(--text); border: 2px solid var(--ink); }

    .contact-link { font-family: var(--font-mono); color: var(--text); text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 4px; }
    .contact-link:hover { background: var(--primary); color: var(--on-primary); }
    footer { border-top: var(--bw) solid var(--ink); font-family: var(--font-mono); text-transform: uppercase; color: var(--text); }
    `,
  },

  playful: {
    fonts: ["Fredoka:wght@400;500;600;700"],
    css: `
    /* ── Playful: rounded, bouncy, candy-colored — a little bit silly ── */
    :root { --font-display: 'Fredoka', var(--font); }
    [data-theme="light"] {
      --pop-1: color-mix(in srgb, var(--primary) 16%, white);
      --pop-2: color-mix(in srgb, var(--accent) 22%, white);
      --pop-3: color-mix(in srgb, var(--secondary) 18%, white);
      --dots: color-mix(in srgb, var(--primary) 16%, transparent);
      --chunk: color-mix(in srgb, var(--text) 85%, transparent);
    }
    [data-theme="dark"] {
      --pop-1: color-mix(in srgb, var(--primary) 30%, var(--dark-bg));
      --pop-2: color-mix(in srgb, var(--accent) 26%, var(--dark-bg));
      --pop-3: color-mix(in srgb, var(--secondary) 30%, var(--dark-bg));
      --dots: color-mix(in srgb, var(--primary) 22%, transparent);
      --chunk: color-mix(in srgb, var(--primary) 70%, black);
    }
    body {
      background-image: radial-gradient(var(--dots) 1.5px, transparent 1.7px);
      background-size: 22px 22px;
    }

    nav { border-bottom: none; }
    .nav-name { font-family: var(--font-display); font-size: 1.3rem; }
    .nav-links a { font-family: var(--font-display); font-size: 0.95rem; padding: 0.3rem 0.8rem; border-radius: 999px; }
    .nav-links a:hover { background: var(--pop-1); color: var(--text); }
    .theme-toggle, .print-btn { border: 2px solid var(--chunk); box-shadow: 0 3px 0 var(--chunk); }
    .theme-toggle:hover, .print-btn:hover { rotate: -10deg; border-color: var(--chunk); }
    #scroll-progress { height: 5px; border-radius: 0 999px 999px 0; background: linear-gradient(90deg, var(--primary), var(--accent), var(--secondary)); }

    .hero-bg {
      background:
        radial-gradient(circle at 82% 28%, var(--pop-2) 0 130px, transparent 131px),
        radial-gradient(circle at 12% 76%, var(--pop-3) 0 85px, transparent 86px),
        radial-gradient(circle at 70% 82%, var(--pop-1) 0 52px, transparent 53px);
    }
    #hero { border-bottom: none; }
    .hero-eyebrow {
      font-family: var(--font-display); display: inline-block; letter-spacing: 0.08em;
      background: var(--pop-2); color: var(--text); padding: 0.35rem 0.95rem; border-radius: 999px; rotate: -3deg;
    }
    .hero-avatar { border-radius: 42% 58% 55% 45% / 48% 42% 58% 52%; border: 3px solid var(--chunk); box-shadow: 0 6px 0 var(--chunk); rotate: -3deg; }
    .hero-name { font-family: var(--font-display); font-weight: 700; letter-spacing: -0.01em; }
    .hero-name .highlight { text-decoration: underline wavy var(--accent); text-decoration-thickness: 4px; text-underline-offset: 12px; }
    [data-theme] .hero-cta {
      font-family: var(--font-display); font-size: 1.05rem; border-radius: 999px; padding: 0.9rem 1.9rem;
      box-shadow: 0 5px 0 color-mix(in srgb, var(--primary) 55%, black);
      transition: translate 0.15s, rotate 0.15s, box-shadow 0.15s;
    }
    [data-theme] .hero-cta:hover { translate: 0 -3px; rotate: -2deg; opacity: 1; box-shadow: 0 8px 0 color-mix(in srgb, var(--primary) 55%, black); }
    [data-theme] .hero-cta:active { translate: 0 3px; box-shadow: 0 2px 0 color-mix(in srgb, var(--primary) 55%, black); }

    section { border-bottom: none; }
    .section-label { font-family: var(--font-display); font-size: 1.05rem; font-weight: 600; letter-spacing: 0.02em; text-transform: none; color: var(--text); }
    .section-label::before { content: "✦"; color: var(--accent); }
    .section-label::after { height: 3px; border-radius: 999px; background: repeating-linear-gradient(90deg, var(--primary) 0 10px, transparent 10px 18px); }

    .about-text { font-size: 1.2rem; color: var(--text); background: var(--pop-1); padding: 1.75rem 2rem; border-radius: 28px 28px 28px 6px; }
    .skill-tag { font-family: var(--font-display); font-size: 0.92rem; color: var(--text); background: var(--pop-1); border: 2px solid transparent; }
    .skill-tag:nth-child(3n+2) { background: var(--pop-2); }
    .skill-tag:nth-child(3n+3) { background: var(--pop-3); }
    .skill-tag:nth-child(odd) { rotate: -2deg; }
    .skill-tag:nth-child(even) { rotate: 1.5deg; }
    .skill-tag:hover { color: var(--text); border-color: var(--chunk); rotate: 0deg; scale: 1.08; box-shadow: none; }

    .exp-item { border-bottom: 2px dashed color-mix(in srgb, var(--primary) 30%, transparent); }
    .exp-period { font-family: var(--font-display); font-weight: 600; color: var(--primary); }
    .exp-role { font-family: var(--font-display); font-size: 1.15rem; }
    .exp-company { background: var(--pop-2); color: var(--text); padding: 0.05rem 0.6rem; border-radius: 999px; }

    .project-card { border-radius: 26px; border: 2px solid var(--chunk); background: var(--surface); box-shadow: 0 6px 0 var(--chunk); }
    .project-card:nth-child(odd) { rotate: -1deg; }
    .project-card:nth-child(even) { rotate: 1deg; background: var(--pop-1); }
    .project-card:hover { rotate: 0deg; translate: 0 -6px; border-color: var(--chunk); box-shadow: 0 12px 0 var(--chunk); }
    .project-title { font-family: var(--font-display); font-size: 1.2rem; }
    .project-tag { border-radius: 999px; background: var(--pop-2); color: var(--text); }

    .contact-link { font-family: var(--font-display); font-size: 1.05rem; }
    .contact-link svg { box-sizing: content-box; padding: 7px; border-radius: 50%; background: var(--pop-1); }
    footer { border-top: none; font-family: var(--font-display); }
    `,
  },

  editorial: {
    fonts: ["Playfair Display:wght@400;500;700;900", "Source Serif 4:wght@400;500;600"],
    css: `
    /* ── Editorial: a magazine feature — serif headlines, ruled columns, drop caps ── */
    :root { --font: 'Source Serif 4', Georgia, serif; --font-display: 'Playfair Display', Georgia, serif; }
    [data-theme="light"] { --bg: color-mix(in srgb, var(--light-bg) 75%, #f6f1e7); --border: color-mix(in srgb, var(--text) 22%, transparent); }
    [data-theme="dark"]  { --border: color-mix(in srgb, var(--text) 22%, transparent); }
    body { font-size: 1.04rem; }

    nav { background: var(--bg); backdrop-filter: none; -webkit-backdrop-filter: none; border-bottom: 3px double var(--text); }
    .nav-name { font-family: var(--font-display); font-weight: 900; font-size: 1.2rem; letter-spacing: -0.01em; }
    .nav-links a { font-variant: small-caps; letter-spacing: 0.08em; font-size: 0.95rem; color: var(--text); }
    .theme-toggle, .print-btn { border-radius: 0; }
    #scroll-progress { height: 2px; background: var(--text); }

    .hero-bg { display: none; }
    #hero { border-bottom: 3px double var(--text); text-align: center; }
    .hero-content { margin: 0 auto; display: flex; flex-direction: column; align-items: center; }
    .hero-avatar { filter: grayscale(0.35) sepia(0.15); box-shadow: none; border: 1px solid var(--text); padding: 4px; background: var(--bg); }
    .hero-eyebrow { font-variant: small-caps; letter-spacing: 0.3em; color: var(--textLight); border-top: 1px solid var(--text); border-bottom: 1px solid var(--text); padding: 0.3rem 1.2rem; }
    .hero-name { font-family: var(--font-display); font-weight: 900; letter-spacing: -0.02em; line-height: 1; }
    .hero-name .highlight { color: var(--text); font-style: italic; font-weight: 400; }
    .hero-tagline { font-style: italic; font-size: 1.3rem; max-width: 600px; }
    [data-theme] .hero-cta { border-radius: 0; font-variant: small-caps; letter-spacing: 0.1em; font-size: 1rem; }

    section { border-bottom: 1px solid var(--border); }
    .section-label {
      font-family: var(--font-display); font-size: 1.6rem; font-weight: 700; text-transform: none;
      letter-spacing: -0.01em; color: var(--text); border-top: 3px solid var(--text); padding-top: 0.8rem; margin-bottom: 2rem;
    }
    .section-label::after { display: none; }
    .about-text { color: var(--text); font-size: 1.2rem; line-height: 1.85; column-count: 2; column-gap: 2.5rem; column-rule: 1px solid var(--border); }
    .about-text::first-letter { font-family: var(--font-display); float: left; font-size: 4.2rem; line-height: 0.85; font-weight: 900; padding: 0.3rem 0.5rem 0 0; color: var(--primary); }

    .skill-tag { background: none; border: none; border-radius: 0; padding: 0; font-style: italic; font-size: 1.02rem; color: var(--text); }
    .skill-tag:not(:last-child)::after { content: " ·"; color: var(--textLight); font-style: normal; }
    .skill-tag:hover { background: none; color: var(--primary); translate: none; box-shadow: none; }
    .exp-period { font-variant: small-caps; letter-spacing: 0.08em; font-size: 0.9rem; }
    .exp-role { font-family: var(--font-display); font-size: 1.25rem; }
    .exp-company { font-style: italic; color: var(--textLight); }

    .projects-grid { gap: 0; }
    .project-card { background: none; border: none; border-radius: 0; border-left: 1px solid var(--border); }
    .project-card:nth-child(odd) { border-left: none; }
    .project-card:hover { translate: none; box-shadow: none; }
    .project-card:hover .project-title { text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 4px; }
    .project-title { font-family: var(--font-display); font-size: 1.35rem; }
    .project-desc { font-size: 1rem; color: var(--text); }
    .project-tag { background: none; color: var(--textLight); padding: 0; font-variant: small-caps; letter-spacing: 0.06em; font-size: 0.85rem; }

    .contact-link { color: var(--text); text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 4px; }
    footer { border-top: 3px double var(--text); font-variant: small-caps; letter-spacing: 0.1em; }

    @media (max-width: 600px) {
      .about-text { column-count: 1; }
      .project-card { border-left: none; border-top: 1px solid var(--border); }
    }
    `,
  },

  terminal: {
    fonts: ["JetBrains Mono:wght@400;500;700"],
    css: `
    /* ── Terminal: the whole page as a shell session — mono, prompts, a blinking cursor ── */
    :root { --font: 'JetBrains Mono', ui-monospace, monospace; --font-display: var(--font); }
    [data-theme="light"] { --bg: color-mix(in srgb, var(--light-bg) 80%, #e9ecef); --surface: color-mix(in srgb, var(--light-bg) 92%, #dee2e6); --border: color-mix(in srgb, var(--text) 25%, transparent); }
    [data-theme="dark"]  { --bg: #0b0e0c; --surface: #111612; --border: color-mix(in srgb, var(--primary) 35%, transparent); --text: #d7f5dc; --textLight: #8fb596; }
    body { font-size: 0.95rem; }
    /* Faint CRT scanlines in dark mode only. */
    [data-theme="dark"] body::after {
      content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 2000;
      background: repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.18) 0 1px, transparent 1px 3px);
    }

    nav { background: var(--surface); backdrop-filter: none; -webkit-backdrop-filter: none; border-bottom: 1px dashed var(--border); }
    .nav-name::before { content: "~/"; color: var(--primary); }
    .nav-links a::before { content: "./"; color: var(--primary); }
    .nav-links a:hover { color: var(--text); text-decoration: underline; }
    .theme-toggle, .print-btn { border-radius: 4px; border-style: dashed; }
    #scroll-progress { height: 3px; background: var(--primary); }

    .hero-bg { display: none; }
    #hero { border-bottom: 1px dashed var(--border); }
    .hero-avatar { border-radius: 4px; box-shadow: none; border: 1px dashed var(--primary); image-rendering: pixelated; }
    .hero-eyebrow { text-transform: none; letter-spacing: 0; color: var(--textLight); }
    .hero-eyebrow::before { content: "$ whoami"; color: var(--primary); margin-right: 0.75rem; }
    .hero-name { font-weight: 700; font-size: clamp(2.4rem, 6vw, 4rem); letter-spacing: -0.02em; }
    .hero-name::after { content: "▋"; color: var(--primary); margin-left: 0.1em; animation: term-blink 1s steps(1) infinite; }
    .hero-name .highlight { color: var(--primary); }
    .hero-tagline::before { content: "# "; color: var(--textLight); }
    [data-theme] .hero-cta { border-radius: 4px; font-family: var(--font); }
    [data-theme] .hero-cta::before { content: "> "; }
    [data-theme="dark"] .hero-name .highlight, [data-theme="dark"] .section-label { text-shadow: 0 0 10px color-mix(in srgb, var(--primary) 55%, transparent); }

    section { border-bottom: 1px dashed var(--border); }
    .section-label { text-transform: none; letter-spacing: 0; font-size: 0.95rem; color: var(--text); }
    .section-label::before { content: "$ cat"; color: var(--primary); }
    .section-label::after { background: none; border-top: 1px dashed var(--border); height: 0; }

    .about-text { color: var(--text); font-size: 1rem; border-left: 2px solid var(--primary); padding-left: 1.25rem; }
    .skill-tag { border-radius: 4px; background: var(--surface); border: 1px dashed var(--border); color: var(--text); font-size: 0.85rem; }
    .skill-tag::before { content: "> "; color: var(--primary); }
    .skill-tag:hover { border-style: solid; border-color: var(--primary); color: var(--primary); }
    .exp-period { color: var(--primary); }
    .exp-period::before { content: "["; } .exp-period::after { content: "]"; }
    .exp-company { color: var(--accent); }

    .project-card { border-radius: 6px; background: var(--surface); border: 1px dashed var(--border); }
    .project-card:hover { border-style: solid; border-color: var(--primary); box-shadow: none; }
    .project-title::before { content: "▸ "; color: var(--primary); }
    .project-tag { border-radius: 4px; background: none; border: 1px solid var(--border); color: var(--textLight); }

    .contact-link::before { content: "→"; color: var(--primary); }
    footer { border-top: 1px dashed var(--border); }
    footer .container::before { content: "[process exited with code 0] "; color: var(--textLight); }

    @keyframes term-blink { 50% { opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .hero-name::after { animation: none; } }
    `,
  },

  bento: {
    fonts: ["Plus Jakarta Sans:wght@400;500;600;700;800"],
    css: `
    /* ── Bento: the page as a grid of rounded tiles, like a product keynote slide ── */
    :root { --font-display: 'Plus Jakarta Sans', var(--font); --tile-radius: 28px; }
    [data-theme="light"] { --bg: color-mix(in srgb, var(--light-bg) 85%, #eef0f4); --surface: #ffffff; --border: color-mix(in srgb, var(--text) 8%, transparent); }
    [data-theme="dark"]  { --surface: color-mix(in srgb, var(--dark-bg) 88%, white); --border: color-mix(in srgb, var(--text) 10%, transparent); }

    /* The tile grid. Sections are direct children of <body>, so the body
       itself becomes the grid; the fixed nav and the (display:none) script
       tags don't take up cells. "dense" backfills gaps when the user hides
       or reorders sections. */
    body {
      display: grid; grid-template-columns: repeat(2, minmax(0, 470px));
      justify-content: center; gap: 1rem; padding: 6.5rem 1rem 1rem; grid-auto-flow: dense;
    }
    #hero, #experience, #projects, footer { grid-column: 1 / -1; }
    section, footer {
      background: var(--surface); border: 1px solid var(--border); border-radius: var(--tile-radius);
      padding: 2.25rem 2rem;
    }
    section:last-of-type { border-bottom: 1px solid var(--border); }
    section .container { max-width: none; padding: 0; }

    nav { top: 1rem; left: 50%; right: auto; translate: -50% 0; width: min(956px, calc(100% - 2rem)); border-radius: 20px; border: 1px solid var(--border); background: color-mix(in srgb, var(--surface) 88%, transparent); }
    .nav-name { font-family: var(--font-display); font-weight: 800; }
    #scroll-progress { height: 3px; }

    #hero {
      min-height: 0; padding: 3.5rem 2.5rem; overflow: hidden;
      background: linear-gradient(135deg, color-mix(in srgb, var(--primary) 18%, var(--surface)), color-mix(in srgb, var(--accent) 14%, var(--surface)));
    }
    .hero-bg { display: none; }
    .hero-content { padding: 0; }
    .hero-avatar { border-radius: 22px; border: 3px solid var(--surface); }
    .hero-name { font-family: var(--font-display); font-weight: 800; letter-spacing: -0.035em; }
    [data-theme] .hero-cta { border-radius: 14px; }

    .section-label { font-family: var(--font-display); text-transform: none; letter-spacing: -0.01em; font-size: 1.15rem; font-weight: 700; color: var(--text); margin-bottom: 1.25rem; }
    .section-label::after { display: none; }
    .about-text { font-size: 1.05rem; color: var(--text); }
    .skill-tag { border-radius: 12px; background: color-mix(in srgb, var(--primary) 10%, var(--surface)); border-color: transparent; color: var(--text); }
    .exp-item { grid-template-columns: 130px 1fr; padding: 1.25rem 0; }
    .exp-role { font-family: var(--font-display); }
    .projects-grid { gap: 1rem; }
    .project-card { border-radius: 20px; background: var(--bg); border: 1px solid var(--border); }
    .project-card:hover { box-shadow: 0 12px 30px var(--shadow); }
    .project-title { font-family: var(--font-display); font-weight: 700; }
    .project-tag { border-radius: 8px; }
    footer { padding: 1.25rem 2rem; }

    @media (max-width: 760px) {
      body { grid-template-columns: minmax(0, 1fr); }
    }
    @media (max-width: 600px) {
      .exp-item { grid-template-columns: 1fr; gap: 0.25rem; }
    }
    `,
  },

  neon: {
    fonts: ["Orbitron:wght@500;700;900"],
    css: `
    /* ── Neon: night-city signage — glowing tubes, a synthwave grid, deep dark ── */
    :root { --font-display: 'Orbitron', var(--font); }
    [data-theme="light"] {
      --glow: color-mix(in srgb, var(--primary) 45%, transparent);
      --glow-2: color-mix(in srgb, var(--accent) 40%, transparent);
      --border: color-mix(in srgb, var(--primary) 35%, transparent);
    }
    [data-theme="dark"] {
      --bg: color-mix(in srgb, var(--dark-bg) 60%, #05010f);
      --surface: color-mix(in srgb, var(--dark-bg) 70%, #120a26);
      --glow: color-mix(in srgb, var(--primary) 75%, transparent);
      --glow-2: color-mix(in srgb, var(--accent) 70%, transparent);
      --border: color-mix(in srgb, var(--primary) 45%, transparent);
    }

    nav { border-bottom: 1px solid var(--border); box-shadow: 0 1px 18px var(--glow); }
    .nav-name { font-family: var(--font-display); letter-spacing: 0.08em; text-transform: uppercase; }
    .nav-links a:hover { color: var(--accent); text-shadow: 0 0 8px var(--glow-2); }
    .theme-toggle:hover, .print-btn:hover { box-shadow: 0 0 14px var(--glow); }
    #scroll-progress { height: 3px; box-shadow: 0 0 12px var(--glow); }

    /* Synthwave horizon: a glowing perspective grid fading in at the bottom of
       the hero. Tilted with the individual rotate property + the parent's
       perspective — GSAP's parallax writes an inline transform on .hero-bg,
       which would flatten a transform-based tilt. */
    #hero { perspective: 320px; perspective-origin: 50% 100%; }
    .hero-bg {
      top: auto; height: 45%;
      background:
        linear-gradient(to top, var(--glow) 0 1px, transparent 1px) 0 0 / 100% 36px,
        linear-gradient(to right, var(--glow) 0 1px, transparent 1px) 0 0 / 56px 100%;
      transform-origin: bottom; rotate: x 58deg;
      -webkit-mask-image: linear-gradient(to top, black, transparent); mask-image: linear-gradient(to top, black, transparent);
      opacity: 0.55;
    }
    #hero { border-bottom: 1px solid var(--border); }
    .hero-avatar { border: 2px solid var(--primary); box-shadow: 0 0 22px var(--glow), inset 0 0 12px var(--glow); }
    .hero-eyebrow { color: var(--accent); text-shadow: 0 0 10px var(--glow-2); }
    .hero-name { font-family: var(--font-display); font-weight: 900; text-transform: uppercase; letter-spacing: 0.02em; }
    .hero-name .highlight { color: var(--primary); text-shadow: 0 0 6px var(--glow), 0 0 22px var(--glow), 0 0 48px var(--glow); }
    [data-theme] .hero-cta { border-radius: 4px; text-transform: uppercase; letter-spacing: 0.12em; box-shadow: 0 0 18px var(--glow), 0 0 4px var(--glow) inset; }
    [data-theme] .hero-cta:hover { box-shadow: 0 0 30px var(--glow), 0 0 6px var(--glow) inset; opacity: 1; }

    section { border-bottom: 1px solid var(--border); }
    .section-label { font-family: var(--font-display); color: var(--accent); text-shadow: 0 0 10px var(--glow-2); }
    .section-label::after { background: linear-gradient(90deg, var(--primary), transparent); box-shadow: 0 0 8px var(--glow); }

    .skill-tag { border-radius: 4px; background: transparent; border: 1px solid var(--primary); color: var(--text); box-shadow: 0 0 8px var(--glow) inset; }
    .skill-tag:hover { color: var(--text); background: transparent; border-color: var(--accent); box-shadow: 0 0 14px var(--glow-2), 0 0 8px var(--glow-2) inset; }
    .exp-role { font-family: var(--font-display); letter-spacing: 0.04em; font-size: 0.95rem; text-transform: uppercase; }
    .exp-company { color: var(--accent); }

    .project-card { border-radius: 8px; background: var(--surface); border: 1px solid var(--border); box-shadow: 0 0 0 transparent; }
    .project-card:hover { border-color: var(--primary); box-shadow: 0 0 24px var(--glow), 0 0 6px var(--glow) inset; }
    .project-title { font-family: var(--font-display); letter-spacing: 0.04em; text-transform: uppercase; font-size: 0.95rem; }
    .project-tag { border-radius: 4px; background: transparent; border: 1px solid var(--glow-2); }

    .contact-link:hover { color: var(--accent); text-shadow: 0 0 8px var(--glow-2); }
    footer { border-top: 1px solid var(--border); }
    `,
  },
};

// Curated font pairings. Picking one overrides both the AI-chosen font and
// the style's own display font — an explicit user choice wins over defaults.
const FONT_PAIRS = {
  modern:    { label: "Modern — Inter",                      display: "Inter",              body: "Inter",           fallback: "sans-serif", specs: ["Inter:wght@300;400;500;600;700;800"] },
  editorial: { label: "Editorial — Playfair + Source Serif", display: "Playfair Display",   body: "Source Serif 4",  fallback: "serif",      specs: ["Playfair Display:wght@500;700;900", "Source Serif 4:wght@400;500;600"] },
  geometric: { label: "Geometric — Poppins + DM Sans",       display: "Poppins",            body: "DM Sans",         fallback: "sans-serif", specs: ["Poppins:wght@500;600;700", "DM Sans:wght@400;500;700"] },
  friendly:  { label: "Friendly — Nunito",                    display: "Nunito",             body: "Nunito",          fallback: "sans-serif", specs: ["Nunito:wght@400;600;700;800"] },
  technical: { label: "Technical — JetBrains Mono + IBM Plex", display: "JetBrains Mono",   body: "IBM Plex Sans",   fallback: "sans-serif", specs: ["JetBrains Mono:wght@500;700", "IBM Plex Sans:wght@400;500;600"] },
  elegant:   { label: "Elegant — Cormorant + Lato",          display: "Cormorant Garamond", body: "Lato",            fallback: "sans-serif", specs: ["Cormorant Garamond:wght@500;600;700", "Lato:wght@400;700"] },
};

/**
 * @param {string} style - one of the built-in style names.
 * @returns {{fonts: string[], css: string}} Google Fonts family specs to load
 *   (already in css2 `Family:wght@...` form) and the layer stylesheet. An
 *   unknown style returns an empty layer, i.e. the plain base design.
 */
function getStyleLayer(style) {
  return STYLE_LAYERS[style] || { fonts: [], css: "" };
}

/**
 * @param {string} key - a FONT_PAIRS key; anything else means "keep the
 *   AI-picked font and the style's own display font".
 * @returns {{specs: string[], css: string}|null}
 */
function getFontPair(key) {
  const pair = Object.prototype.hasOwnProperty.call(FONT_PAIRS, key) ? FONT_PAIRS[key] : null;
  if (!pair) return null;
  return {
    specs: pair.specs,
    css: `
    /* ── Font pairing: ${key} ── */
    :root { --font: '${pair.body}', ${pair.fallback}; --font-display: '${pair.display}', ${pair.fallback}; }`,
  };
}

module.exports = {
  getStyleLayer,
  getFontPair,
  STYLE_NAMES: Object.keys(STYLE_LAYERS),
  FONT_PAIR_OPTIONS: Object.entries(FONT_PAIRS).map(([key, p]) => ({ key, label: p.label })),
};
