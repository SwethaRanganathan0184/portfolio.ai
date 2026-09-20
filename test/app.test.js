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
  assert.ok(data.html.includes("Glassmorphism Overrides"));
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
