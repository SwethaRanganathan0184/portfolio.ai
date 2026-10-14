const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const app = require("../src/app");

let server;
let baseUrl;

test.before(() => {
  server = app.listen(0);
  baseUrl = `http://localhost:${server.address().port}`;
});

test.after(() => {
  server.close();
});

function seedSession(id, overrides = {}) {
  app.portfolioStore.set(id, {
    html: "<html>original</html>",
    name: "Jane Doe",
    theme: {
      font: "Inter",
      light: { primary: "#111", secondary: "#222", background: "#fff", accent: "#0a0" },
      dark: { primary: "#eee", secondary: "#ddd", background: "#000", accent: "#0fa" },
    },
    portfolioData: {
      name: "Jane Doe",
      tagline: "Engineer",
      about: "I build things",
      cta: "Reach out",
      email: "jane@real.com",
      phone: "555-1234",
      github: "https://github.com/janedoe",
      linkedin: "https://linkedin.com/in/janedoe",
      website: "https://jane.dev",
      skills: ["JS"],
      experience: [{ company: "Acme", role: "Eng", period: "2020-24", highlight: "Did stuff" }],
      projects: [{ title: "Proj", description: "desc", tags: ["a"], url: "https://proj.dev" }],
    },
    options: { style: "minimalism", title: "", favicon: "", colors: {} },
    ...overrides,
  });
}

test("GET / serves the static frontend", async () => {
  const res = await fetch(`${baseUrl}/`);
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.ok(body.includes("<title>"));
});

test("POST /generate without a file returns 400", async () => {
  const res = await fetch(`${baseUrl}/generate`, { method: "POST" });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.error, /no file/i);
});

test("POST /generate-cover-letter without resumeText returns 400", async () => {
  const res = await fetch(`${baseUrl}/generate-cover-letter`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobDescription: "Some job" }),
  });
  assert.equal(res.status, 400);
});

test("POST /generate-cover-letter without jobDescription returns 400", async () => {
  const res = await fetch(`${baseUrl}/generate-cover-letter`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resumeText: "Some resume" }),
  });
  assert.equal(res.status, 400);
});

test("POST /generate-resume-review without resumeText returns 400", async () => {
  const res = await fetch(`${baseUrl}/generate-resume-review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 400);
});

test("GET /auth/github without a valid session returns 400", async () => {
  const res = await fetch(`${baseUrl}/auth/github?sessionId=does-not-exist`);
  assert.equal(res.status, 400);
});

test("GET /deploy/confirm with an unknown/expired token redirects to the error banner", async () => {
  const res = await fetch(`${baseUrl}/deploy/confirm?token=bogus&action=overwrite`, { redirect: "manual" });
  assert.equal(res.status, 302);
  assert.match(res.headers.get("location"), /^\/\?error=/);
});

test("GET /auth/profile/session-token with an unknown/expired code returns 400", async () => {
  const res = await fetch(`${baseUrl}/auth/profile/session-token?code=bogus`);
  assert.equal(res.status, 400);
});

// The handoff/confirm tokens are stateless signed JWTs (not a server-memory
// lookup) specifically so they keep working across separate serverless
// function instances — these tests construct valid tokens directly with the
// app's own exported secret, the same way a real OAuth callback would.
test("GET /auth/profile/session-token accepts a validly-signed handoff token", async () => {
  const handoffToken = jwt.sign({ accessToken: "fake-token" }, app.JWT_SECRET, { expiresIn: "60s" });
  const res = await fetch(`${baseUrl}/auth/profile/session-token?code=${encodeURIComponent(handoffToken)}`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.accessToken, "fake-token");
});

test("GET /auth/profile/session-token rejects a token signed with a different secret", async () => {
  const forged = jwt.sign({ accessToken: "fake-token" }, "wrong-secret", { expiresIn: "60s" });
  const res = await fetch(`${baseUrl}/auth/profile/session-token?code=${encodeURIComponent(forged)}`);
  assert.equal(res.status, 400);
});

test("GET /deploy/confirm accepts a validly-signed confirm token and honors cancel", async () => {
  const confirmToken = jwt.sign(
    { accessToken: "fake-token", sessionId: "does-not-matter", repoSlug: undefined },
    app.JWT_SECRET,
    { expiresIn: "5m" }
  );
  const res = await fetch(`${baseUrl}/deploy/confirm?token=${encodeURIComponent(confirmToken)}&action=cancel`, {
    redirect: "manual",
  });
  assert.equal(res.status, 302);
  assert.match(res.headers.get("location"), /^\/\?deployCancelled=true$/);
});

test("GET /profile/sync without a bearer token returns 401", async () => {
  const res = await fetch(`${baseUrl}/profile/sync`);
  assert.equal(res.status, 401);
});

test("PUT /profile/sync without a bearer token returns 401", async () => {
  const res = await fetch(`${baseUrl}/profile/sync`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 401);
});

test("POST /auth/profile/signout without a bearer token returns 401", async () => {
  const res = await fetch(`${baseUrl}/auth/profile/signout`, { method: "POST" });
  assert.equal(res.status, 401);
});

test("POST /regenerate-html applies edits, keeps them escaped, and preserves original contact fields", async () => {
  seedSession("session-edit-test");

  const res = await fetch(`${baseUrl}/regenerate-html`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: "session-edit-test",
      portfolioData: {
        name: "<script>alert(1)</script>Jane Updated",
        tagline: "New tagline",
        about: "Updated about",
        cta: "New cta",
        skills: ["JS", "TS"],
        experience: [{ company: "NewCo", role: "Sr Eng", period: "2024-now", highlight: "Shipped stuff" }],
        projects: [{ title: "NewProj", description: "d2", tags: ["b"], url: "javascript:alert(2)" }],
        // Attempted spoofing of fields with no editable UI — must be ignored.
        email: "attacker@evil.com",
        github: "javascript:alert(3)",
      },
      style: "glassmorphism",
    }),
  });

  assert.equal(res.status, 200);
  const data = await res.json();

  assert.ok(!data.html.includes("<script>alert(1)"));
  assert.ok(data.html.includes("Jane Updated"));
  assert.ok(data.html.includes("jane@real.com"));
  assert.ok(!data.html.includes("attacker@evil.com"));
  assert.ok(data.html.includes("https://github.com/janedoe"));
  assert.ok(!data.html.includes("javascript:"));
  // The requested style's layer was applied: its frosted panels and its font.
  assert.ok(data.html.includes("section:not(#hero) > .container"));
  assert.ok(data.html.includes("family=Outfit"));
});

test("POST /regenerate-html embeds an uploaded favicon sent as faviconData", async () => {
  seedSession("session-favicon-test");
  const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const res = await fetch(`${baseUrl}/regenerate-html`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: "session-favicon-test", portfolioData: {}, faviconData: png }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.html.includes(`<link rel="icon" href="${png}"`));
});

test("POST /regenerate-html applies personalization (sections, links, font, CTA) without an AI call", async () => {
  seedSession("session-personalize-test");
  const res = await fetch(`${baseUrl}/regenerate-html`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: "session-personalize-test",
      portfolioData: {},
      style: "bento",
      fontPair: "geometric",
      ctaLabel: "Let's talk",
      sections: { order: ["projects"], hidden: ["skills"], labels: { projects: "Selected Work" } },
      // Multipart sends these as JSON strings; the JSON endpoint as objects — both must work.
      links: JSON.stringify([{ label: "", url: "https://dribbble.com/jane" }]),
    }),
  });
  assert.equal(res.status, 200);
  const { html } = await res.json();
  assert.ok(html.includes("grid-auto-flow: dense"), "bento layer applied");
  assert.ok(html.includes("family=Poppins"), "font pairing applied");
  assert.ok(html.includes("Let&#39;s talk"), "custom CTA label applied (escaped)");
  assert.ok(html.includes("Selected Work"));
  assert.ok(!html.includes('<section id="skills">'));
  assert.ok(html.indexOf('<section id="projects">') < html.indexOf('<section id="about">'));
  assert.ok(html.includes("https://dribbble.com/jane") && html.includes("<span>Dribbble</span>"));
});

test("clampPortfolioEdits leaves list fields alone when the edit doesn't include them", () => {
  const original = {
    name: "N", tagline: "T", about: "A", cta: "C", email: null, phone: null, github: null, linkedin: null, website: null,
    skills: ["JS"], experience: [{ company: "Co", role: "R", period: "P", highlight: "H" }],
    projects: [{ title: "P", description: "D", tags: [], url: null }], certifications: ["Cert"],
  };
  const clamped = app.clampPortfolioEdits({ name: "New" }, original);
  assert.equal(clamped.name, "New");
  assert.deepEqual(clamped.skills, ["JS"]);
  assert.equal(clamped.projects.length, 1);
  assert.deepEqual(clamped.certifications, ["Cert"]);
  // An explicit empty array is still an intentional clear.
  assert.deepEqual(app.clampPortfolioEdits({ skills: [] }, original).skills, []);
});

test("POST /regenerate-html survives malformed personalization fields instead of 500ing", async () => {
  seedSession("session-malformed-test");
  const res = await fetch(`${baseUrl}/regenerate-html`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: "session-malformed-test", portfolioData: {},
      title: { not: "a string" }, sections: "{not json", links: 42, fontPair: ["x"], designBrief: { x: 1 },
    }),
  });
  assert.equal(res.status, 200);
});

test("POST /regenerate-html with an unknown sessionId returns 400", async () => {
  const res = await fetch(`${baseUrl}/regenerate-html`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: "does-not-exist", portfolioData: {} }),
  });
  assert.equal(res.status, 400);
});

test("clampPortfolioEdits caps oversized arrays and strings", () => {
  const original = {
    name: "Orig", tagline: "T", about: "A", cta: "C",
    email: "e@x.com", phone: "1", github: "https://github.com/x", linkedin: null, website: null,
    skills: [], experience: [], projects: [],
  };
  const hugeSkills = Array.from({ length: 100 }, (_, i) => `skill-${i}`);
  const clamped = app.clampPortfolioEdits({ name: "New Name", skills: hugeSkills }, original);
  assert.equal(clamped.name, "New Name");
  assert.equal(clamped.skills.length, 40);
  assert.equal(clamped.email, "e@x.com"); // untouched, from original
});
