function generateHTML(data, theme) {
  const skillsHTML = data.skills
    .map(skill => `<span class="skill-tag">${skill}</span>`)
    .join("");

  const experienceHTML = data.experience
    .map(
      (exp, i) => `
      <div class="exp-item" style="animation-delay: ${i * 0.1}s">
        <div class="exp-left">
          <span class="exp-period">${exp.period}</span>
        </div>
        <div class="exp-right">
          <div class="exp-header">
            <h3 class="exp-role">${exp.role}</h3>
            <span class="exp-company">@ ${exp.company}</span>
          </div>
          <p class="exp-highlight">${exp.highlight}</p>
        </div>
      </div>`
    )
    .join("");

  const projectsHTML = data.projects
    .map(
      (proj, i) => `
      <div class="project-card" style="animation-delay: ${i * 0.15}s">
        <div class="project-inner">
          <div class="project-header">
            <h3 class="project-title">${proj.title}</h3>
            ${proj.url ? `<a href="${proj.url}" target="_blank" class="project-link" aria-label="View project">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>` : ""}
          </div>
          <p class="project-desc">${proj.description}</p>
          <div class="project-tags">
            ${proj.tags.map(tag => `<span class="project-tag">${tag}</span>`).join("")}
          </div>
        </div>
      </div>`
    )
    .join("");

  const contactLinks = [
    data.email ? `<a href="mailto:${data.email}" class="contact-link">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
      <span>${data.email}</span>
    </a>` : "",
    data.github ? `<a href="${data.github}" target="_blank" class="contact-link">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.2c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
      <span>${data.github}</span>
    </a>` : "",
    data.linkedin ? `<a href="${data.linkedin}" target="_blank" class="contact-link">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
      <span>LinkedIn</span>
    </a>` : "",
  ]
    
    .filter(Boolean)
    .join("");

  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${data.tagline}" />
  <title>${data.name}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(theme.font)}:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    /* ── CSS Variables ── */
    :root {
      --font: '${theme.font}', sans-serif;

      /* Light mode */
      --light-primary:     ${theme.light.primary};
      --light-secondary:   ${theme.light.secondary};
      --light-bg:          ${theme.light.background};
      --light-surface:     ${theme.light.surface};
      --light-surfaceHov:  ${theme.light.surfaceHover};
      --light-text:        ${theme.light.text};
      --light-textLight:   ${theme.light.textLight};
      --light-accent:      ${theme.light.accent};
      --light-border:      ${theme.light.border};
      --light-shadow:      ${theme.light.shadow};

      /* Dark mode */
      --dark-primary:      ${theme.dark.primary};
      --dark-secondary:    ${theme.dark.secondary};
      --dark-bg:           ${theme.dark.background};
      --dark-surface:      ${theme.dark.surface};
      --dark-surfaceHov:   ${theme.dark.surfaceHover};
      --dark-text:         ${theme.dark.text};
      --dark-textLight:    ${theme.dark.textLight};
      --dark-accent:       ${theme.dark.accent};
      --dark-border:       ${theme.dark.border};
      --dark-shadow:       ${theme.dark.shadow};
    }

    [data-theme="light"] {
      --primary:    var(--light-primary);
      --secondary:  var(--light-secondary);
      --bg:         var(--light-bg);
      --surface:    var(--light-surface);
      --surfaceHov: var(--light-surfaceHov);
      --text:       var(--light-text);
      --textLight:  var(--light-textLight);
      --accent:     var(--light-accent);
      --border:     var(--light-border);
      --shadow:     var(--light-shadow);
    }

    [data-theme="dark"] {
      --primary:    var(--dark-primary);
      --secondary:  var(--dark-secondary);
      --bg:         var(--dark-bg);
      --surface:    var(--dark-surface);
      --surfaceHov: var(--dark-surfaceHov);
      --text:       var(--dark-text);
      --textLight:  var(--dark-textLight);
      --accent:     var(--dark-accent);
      --border:     var(--dark-border);
      --shadow:     var(--dark-shadow);
    }

    /* ── Reset & Base ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    html { scroll-behavior: smooth; }

    body {
      font-family: var(--font);
      background: var(--bg);
      color: var(--text);
      line-height: 1.7;
      transition: background 0.3s ease, color 0.3s ease;
      overflow-x: hidden;
    }

    a { color: inherit; text-decoration: none; }

    /* ── Layout ── */
    .container {
      max-width: 860px;
      margin: 0 auto;
      padding: 0 2rem;
    }

    section {
      padding: 5rem 0;
      border-bottom: 1px solid var(--border);
    }

    section:last-of-type { border-bottom: none; }

    .section-label {
      font-size: 0.72rem;
      font-weight: 600;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--primary);
      margin-bottom: 2.5rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .section-label::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--border);
    }

    /* ── Nav ── */
    nav {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 100;
      padding: 1.25rem 2rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      background: color-mix(in srgb, var(--bg) 85%, transparent);
      border-bottom: 1px solid var(--border);
      transition: background 0.3s ease;
    }

    .nav-name {
      font-weight: 700;
      font-size: 1rem;
      letter-spacing: -0.02em;
    }

    .nav-name span { color: var(--primary); }

    .nav-right {
      display: flex;
      align-items: center;
      gap: 2rem;
    }

    .nav-links {
      display: flex;
      gap: 1.75rem;
      list-style: none;
    }

    .nav-links a {
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--textLight);
      transition: color 0.2s;
    }

    .nav-links a:hover { color: var(--primary); }

    /* ── Theme Toggle ── */
    .theme-toggle {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: 1px solid var(--border);
      background: var(--surface);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      color: var(--text);
      flex-shrink: 0;
    }

    .theme-toggle:hover {
      background: var(--surfaceHov);
      border-color: var(--primary);
      color: var(--primary);
    }

    .icon-sun, .icon-moon { transition: opacity 0.2s, transform 0.3s; }
    [data-theme="light"] .icon-moon { display: none; }
    [data-theme="dark"]  .icon-sun  { display: none; }

    /* ── Hero ── */
    #hero {
      min-height: 100vh;
      display: flex;
      align-items: center;
      border-bottom: 1px solid var(--border);
      position: relative;
      overflow: hidden;
    }

    .hero-bg {
      position: absolute;
      inset: 0;
      background: radial-gradient(ellipse 80% 60% at 60% 40%, color-mix(in srgb, var(--primary) 8%, transparent), transparent);
      pointer-events: none;
    }

    .hero-content {
      position: relative;
      padding: 8rem 0 5rem;
    }

    .hero-eyebrow {
      font-size: 0.8rem;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--primary);
      margin-bottom: 1.5rem;
      opacity: 0;
      animation: fadeUp 0.6s ease 0.2s forwards;
    }

    .hero-name {
      font-size: clamp(3rem, 8vw, 5.5rem);
      font-weight: 700;
      line-height: 1.05;
      letter-spacing: -0.03em;
      margin-bottom: 1.25rem;
      opacity: 0;
      animation: fadeUp 0.6s ease 0.35s forwards;
    }

    .hero-name .highlight { color: var(--primary); }

    .hero-tagline {
      font-size: clamp(1.1rem, 2.5vw, 1.35rem);
      font-weight: 400;
      color: var(--textLight);
      max-width: 540px;
      margin-bottom: 2.5rem;
      opacity: 0;
      animation: fadeUp 0.6s ease 0.5s forwards;
    }

    .hero-cta {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.85rem 1.75rem;
      background: var(--primary);
      color: #fff;
      border-radius: 6px;
      font-size: 0.9rem;
      font-weight: 600;
      transition: opacity 0.2s, transform 0.2s;
      opacity: 0;
      animation: fadeUp 0.6s ease 0.65s forwards;
    }

    .hero-cta:hover { opacity: 0.88; transform: translateY(-2px); }

    /* ── About ── */
    .about-text {
      font-size: 1.15rem;
      line-height: 1.85;
      color: var(--textLight);
      max-width: 680px;
    }

    .about-text strong { color: var(--text); font-weight: 600; }

    /* ── Skills ── */
    .skills-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem;
    }

    .skill-tag {
      padding: 0.45rem 1rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 100px;
      font-size: 0.82rem;
      font-weight: 500;
      color: var(--textLight);
      transition: all 0.2s ease;
      cursor: default;
    }

    .skill-tag:hover {
      background: var(--surfaceHov);
      border-color: var(--primary);
      color: var(--primary);
      transform: translateY(-1px);
    }

    /* ── Experience ── */
    .exp-list { display: flex; flex-direction: column; gap: 0; }

    .exp-item {
      display: grid;
      grid-template-columns: 160px 1fr;
      gap: 2rem;
      padding: 2rem 0;
      border-bottom: 1px solid var(--border);
      opacity: 0;
      animation: fadeUp 0.5s ease forwards;
    }

    .exp-item:last-child { border-bottom: none; }

    .exp-period {
      font-size: 0.78rem;
      font-weight: 500;
      color: var(--textLight);
      letter-spacing: 0.02em;
      padding-top: 0.25rem;
    }

    .exp-header {
      display: flex;
      align-items: baseline;
      gap: 0.6rem;
      flex-wrap: wrap;
      margin-bottom: 0.5rem;
    }

    .exp-role {
      font-size: 1rem;
      font-weight: 600;
      color: var(--text);
    }

    .exp-company {
      font-size: 0.88rem;
      color: var(--primary);
      font-weight: 500;
    }

    .exp-highlight {
      font-size: 0.9rem;
      color: var(--textLight);
      line-height: 1.6;
    }

    /* ── Projects ── */
    .projects-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 1.25rem;
    }

    .project-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      transition: all 0.25s ease;
      opacity: 0;
      animation: fadeUp 0.5s ease forwards;
    }

    .project-card:hover {
      transform: translateY(-4px);
      border-color: var(--primary);
      box-shadow: 0 12px 32px var(--shadow);
    }

    .project-inner { padding: 1.75rem; }

    .project-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.75rem;
    }

    .project-title {
      font-size: 1rem;
      font-weight: 600;
    }

    .project-link {
      color: var(--textLight);
      transition: color 0.2s;
      display: flex;
    }

    .project-link:hover { color: var(--primary); }

    .project-desc {
      font-size: 0.875rem;
      color: var(--textLight);
      line-height: 1.65;
      margin-bottom: 1.25rem;
    }

    .project-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }

    .project-tag {
      font-size: 0.72rem;
      font-weight: 600;
      padding: 0.25rem 0.65rem;
      background: color-mix(in srgb, var(--accent) 15%, transparent);
      color: var(--accent);
      border-radius: 4px;
      letter-spacing: 0.02em;
    }

    /* ── Contact ── */
    .contact-intro {
      font-size: 1.1rem;
      color: var(--textLight);
      margin-bottom: 2rem;
      max-width: 480px;
    }

    .contact-links {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .contact-link {
      display: inline-flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 0.95rem;
      font-weight: 500;
      color: var(--textLight);
      transition: color 0.2s, gap 0.2s;
    }

    .contact-link:hover { color: var(--primary); gap: 1rem; }

    /* ── Footer ── */
    footer {
      padding: 2.5rem 0;
      text-align: center;
      font-size: 0.8rem;
      color: var(--textLight);
      border-top: 1px solid var(--border);
    }

    /* ── Animations ── */
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Responsive ── */
    @media (max-width: 600px) {
      .nav-links { display: none; }
      .exp-item { grid-template-columns: 1fr; gap: 0.25rem; }
      .exp-period { padding-top: 0; }
      .projects-grid { grid-template-columns: 1fr; }
      .hero-name { font-size: 2.8rem; }
    }

    /* ── Scrollbar ── */
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: var(--bg); }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--primary); }
  </style>
</head>
<body>

  <!-- Nav -->
  <nav>
    <div class="nav-name">${data.name.split(" ")[0]}<span>.</span></div>
    <div class="nav-right">
      <ul class="nav-links">
        <li><a href="#about">About</a></li>
        <li><a href="#experience">Experience</a></li>
        <li><a href="#projects">Projects</a></li>
        <li><a href="#contact">Contact</a></li>
      </ul>
      <button class="theme-toggle" id="themeToggle" aria-label="Toggle dark mode">
        <svg class="icon-sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
        </svg>
        <svg class="icon-moon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
        </svg>
      </button>
    </div>
  </nav>

  <!-- Hero -->
  <section id="hero">
    <div class="hero-bg"></div>
    <div class="container hero-content">
      <p class="hero-eyebrow">Portfolio</p>
      <h1 class="hero-name">${data.name.split(" ").map((w, i) => i === data.name.split(" ").length - 1 ? `<span class="highlight">${w}</span>` : w).join(" ")}</h1>
      <p class="hero-tagline">${data.tagline}</p>
      <a href="#contact" class="hero-cta">
        Get in touch
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </a>
    </div>
  </section>

  <!-- About -->
  <section id="about">
    <div class="container">
      <p class="section-label">About</p>
      <p class="about-text">${data.about}</p>
    </div>
  </section>

  <!-- Skills -->
  <section id="skills">
    <div class="container">
      <p class="section-label">Skills</p>
      <div class="skills-grid">${skillsHTML}</div>
    </div>
  </section>

  <!-- Experience -->
  <section id="experience">
    <div class="container">
      <p class="section-label">Experience</p>
      <div class="exp-list">${experienceHTML}</div>
    </div>
  </section>

  <!-- Projects -->
  <section id="projects">
    <div class="container">
      <p class="section-label">Projects</p>
      <div class="projects-grid">${projectsHTML}</div>
    </div>
  </section>

  <!-- Contact -->
  <section id="contact">
    <div class="container">
      <p class="section-label">Contact</p>
      <p class="contact-intro">${data.cta}</p>
      <div class="contact-links">${contactLinks}</div>
    </div>
  </section>

  <footer>
    <div class="container">
      Built with ✦ — ${data.name}
    </div>
  </footer>

  <script>
    const toggle = document.getElementById('themeToggle');
    const html = document.documentElement;

    // Respect system preference on first load
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (saved) {
      html.setAttribute('data-theme', saved);
    } else if (prefersDark) {
      html.setAttribute('data-theme', 'dark');
    }

    toggle.addEventListener('click', () => {
      const current = html.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
    });

    // Intersection observer for scroll animations
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.animationPlayState = 'running';
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.exp-item, .project-card').forEach(el => {
      el.style.animationPlayState = 'paused';
      observer.observe(el);
    });
  </script>
</body>
</html>`;
}

module.exports = { generateHTML };