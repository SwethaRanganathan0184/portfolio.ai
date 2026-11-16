const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

// Pin the configuration BEFORE the app loads, so these tests behave the same
// on a laptop with a real .env, a laptop with placeholder values, and CI with
// no .env at all. dotenv never overrides a variable that is already set —
// including one set to "" — so the empty GROQ_API_KEY also guarantees no test
// can ever reach the real AI service by accident.
process.env.GROQ_API_KEY = "";
process.env.GITHUB_CLIENT_ID = "test-client-id";
process.env.GITHUB_CLIENT_SECRET = "test-client-secret";
delete process.env.VERCEL;
process.env.NODE_ENV = "test";
// Every request here comes from one address; without this the suite trips
// the real per-IP limits partway through and later tests see 429s.
process.env.RATE_LIMIT_API_MAX = "1000";
process.env.RATE_LIMIT_GENERATE_MAX = "1000";

const app = require("../src/app");

// A test "browser" is just a cookie value we choose (see ensureBrowserId).
const BROWSER_A = "A".repeat(32);
const BROWSER_B = "B".repeat(32);
const asBrowser = (id) => ({ Cookie: `${app.BROWSER_COOKIE}=${id}` });
// Seeded sessions belong to browser A, so JSON requests are sent as browser A.
const JSON_HEADERS = { "Content-Type": "application/json", ...asBrowser(BROWSER_A) };

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
    ownerHash: app.browserHash(BROWSER_A),
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
    headers: JSON_HEADERS,
    body: JSON.stringify({ jobDescription: "Some job" }),
  });
  assert.equal(res.status, 400);
});

test("POST /generate-cover-letter without jobDescription returns 400", async () => {
  const res = await fetch(`${baseUrl}/generate-cover-letter`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ resumeText: "Some resume" }),
  });
  assert.equal(res.status, 400);
});

test("POST /generate-resume-review without resumeText returns 400", async () => {
  const res = await fetch(`${baseUrl}/generate-resume-review`, {
    method: "POST",
    headers: JSON_HEADERS,
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
//
// Each token is also bound to one browser (an HttpOnly cookie whose hash is
// embedded in the token) and carries the GitHub token encrypted.
function handoffTokenFor(browserId, accessToken = "fake-token") {
  return jwt.sign(
    { sealed: app.sealAccessToken(accessToken), b: app.browserHash(browserId) },
    app.JWT_SECRET,
    { expiresIn: "60s" }
  );
}

test("GET /auth/profile/session-token accepts a validly-signed handoff token", async () => {
  const handoffToken = handoffTokenFor(BROWSER_A);
  const res = await fetch(`${baseUrl}/auth/profile/session-token?code=${encodeURIComponent(handoffToken)}`, {
    headers: asBrowser(BROWSER_A),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.accessToken, "fake-token");
});

test("GET /auth/profile/session-token rejects a token signed with a different secret", async () => {
  const forged = jwt.sign(
    { sealed: app.sealAccessToken("fake-token"), b: app.browserHash(BROWSER_A) },
    "wrong-secret",
    { expiresIn: "60s" }
  );
  const res = await fetch(`${baseUrl}/auth/profile/session-token?code=${encodeURIComponent(forged)}`, {
    headers: asBrowser(BROWSER_A),
  });
  assert.equal(res.status, 400);
});

test("a handoff token is useless to any browser other than the one it was issued to", async () => {
  // i.e. a URL lifted from a log or browser history can't be redeemed elsewhere.
  const handoffToken = handoffTokenFor(BROWSER_A);
  const url = `${baseUrl}/auth/profile/session-token?code=${encodeURIComponent(handoffToken)}`;
  assert.equal((await fetch(url, { headers: asBrowser(BROWSER_B) })).status, 400);
  assert.equal((await fetch(url)).status, 400, "no cookie at all");
});

test("the GitHub token never appears in readable form inside a URL-borne JWT", () => {
  const secretLooking = "gho_supersecretgithubtoken1234567890";
  const handoffToken = handoffTokenFor(BROWSER_A, secretLooking);
  // A JWT payload is only base64 — decode it the way anyone reading a log could.
  const payload = Buffer.from(handoffToken.split(".")[1], "base64url").toString("utf8");
  assert.ok(!payload.includes(secretLooking));
  assert.ok(!payload.includes(Buffer.from(secretLooking).toString("base64")));
  assert.equal(app.openAccessToken(JSON.parse(payload).sealed), secretLooking);
});

test("sealed tokens reject tampering and garbage instead of decrypting to something wrong", () => {
  const sealed = app.sealAccessToken("fake-token");
  const raw = Buffer.from(sealed, "base64url");
  raw[raw.length - 1] ^= 1;
  assert.throws(() => app.openAccessToken(raw.toString("base64url")));
  assert.throws(() => app.openAccessToken("not-a-sealed-token"));
  assert.throws(() => app.openAccessToken(undefined));
  // Fresh IV per seal: the same token never produces the same ciphertext twice.
  assert.notEqual(app.sealAccessToken("fake-token"), sealed);
});

test("GET /deploy/confirm accepts a validly-signed confirm token and honors cancel", async () => {
  const confirmToken = jwt.sign(
    { sealed: app.sealAccessToken("fake-token"), sessionId: "does-not-matter", repoSlug: undefined, b: app.browserHash(BROWSER_A) },
    app.JWT_SECRET,
    { expiresIn: "5m" }
  );
  const res = await fetch(`${baseUrl}/deploy/confirm?token=${encodeURIComponent(confirmToken)}&action=cancel`, {
    redirect: "manual",
    headers: asBrowser(BROWSER_A),
  });
  assert.equal(res.status, 302);
  assert.match(res.headers.get("location"), /^\/\?deployCancelled=true$/);
});

test("GET /deploy/confirm refuses to overwrite when the link is opened in a different browser", async () => {
  seedSession("session-confirm-test");
  const confirmToken = jwt.sign(
    { sealed: app.sealAccessToken("fake-token"), sessionId: "session-confirm-test", b: app.browserHash(BROWSER_A) },
    app.JWT_SECRET,
    { expiresIn: "5m" }
  );
  const res = await fetch(`${baseUrl}/deploy/confirm?token=${encodeURIComponent(confirmToken)}&action=overwrite`, {
    redirect: "manual",
    headers: asBrowser(BROWSER_B),
  });
  assert.equal(res.status, 302);
  assert.match(decodeURIComponent(res.headers.get("location")), /^\/\?error=.*different browser/);
});

test("GET /auth/github only lets the browser that generated a portfolio start deploying it", async () => {
  seedSession("session-owner-test", { ownerHash: app.browserHash(BROWSER_A) });
  const url = `${baseUrl}/auth/github?sessionId=session-owner-test`;

  // The CSRF case: someone else's sessionId, opened in the victim's browser.
  const foreign = await fetch(url, { redirect: "manual", headers: asBrowser(BROWSER_B) });
  assert.equal(foreign.status, 403);

  const owner = await fetch(url, { redirect: "manual", headers: asBrowser(BROWSER_A) });
  assert.equal(owner.status, 302);
  const location = new URL(owner.headers.get("location"));
  assert.equal(location.origin + location.pathname, "https://github.com/login/oauth/authorize");
  const state = jwt.verify(location.searchParams.get("state"), app.JWT_SECRET);
  assert.equal(state.sessionId, "session-owner-test");
  assert.equal(state.b, app.browserHash(BROWSER_A));
});

test("GET /auth/callback rejects a state that a different browser started, before contacting GitHub", async () => {
  // Login-CSRF case: an attacker's own valid state + code, sent to a victim.
  const state = jwt.sign({ purpose: "profile-signin", b: app.browserHash(BROWSER_A) }, app.JWT_SECRET, { expiresIn: "15m" });
  const res = await fetch(`${baseUrl}/auth/callback?code=attacker-code&state=${encodeURIComponent(state)}`, {
    redirect: "manual",
    headers: asBrowser(BROWSER_B),
  });
  assert.equal(res.status, 302);
  assert.match(decodeURIComponent(res.headers.get("location")), /^\/\?error=.*different browser/);
});

test("a first-time visitor is given an HttpOnly, SameSite=Lax browser cookie", async () => {
  const res = await fetch(`${baseUrl}/auth/profile/session-token?code=bogus`);
  const cookie = res.headers.get("set-cookie") || "";
  assert.match(cookie, new RegExp(`^${app.BROWSER_COOKIE}=[A-Za-z0-9_-]{32,64};`));
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  // ...and a browser that already has one isn't issued another.
  const again = await fetch(`${baseUrl}/auth/profile/session-token?code=bogus`, { headers: asBrowser(BROWSER_A) });
  assert.equal(again.headers.get("set-cookie"), null);
});

// ── Errors raised by middleware must still come back as JSON ──
// (The frontend parses every API response as JSON; an HTML error page used
// to surface to users as "Unexpected token '<'".)
async function assertJsonError(res) {
  assert.ok(res.status >= 400, `expected an error status, got ${res.status}`);
  assert.match(res.headers.get("content-type") || "", /application\/json/);
  const data = await res.json();
  assert.equal(typeof data.error, "string");
  assert.ok(data.error.length > 0);
  return data;
}

test("POST /generate with an unsupported file type answers 415 in JSON", async () => {
  const form = new FormData();
  form.append("resume", new Blob(["hello"], { type: "text/plain" }), "notes.txt");
  const res = await fetch(`${baseUrl}/generate`, { method: "POST", body: form });
  assert.equal(res.status, 415);
  assert.match((await assertJsonError(res)).error, /PDF and DOCX/);
});

test("POST /generate rejects a legacy .doc at the door even with a Word MIME type", async () => {
  const form = new FormData();
  form.append("resume", new Blob(["hello"], { type: "application/msword" }), "resume.doc");
  const res = await fetch(`${baseUrl}/generate`, { method: "POST", body: form });
  assert.equal(res.status, 415);
  await assertJsonError(res);
});

test("POST /generate with a file over the upload limit answers 413 and names the limit", async () => {
  const form = new FormData();
  form.append("resume", new Blob([Buffer.alloc(app.MAX_RESUME_BYTES + 1024)], { type: "application/pdf" }), "big.pdf");
  const res = await fetch(`${baseUrl}/generate`, { method: "POST", body: form });
  assert.equal(res.status, 413);
  assert.match((await assertJsonError(res)).error, /4MB/);
});

test("POST /generate with a file in the wrong form field answers 400, not 500", async () => {
  const form = new FormData();
  form.append("cv", new Blob(["%PDF-1.4"], { type: "application/pdf" }), "resume.pdf");
  const res = await fetch(`${baseUrl}/generate`, { method: "POST", body: form });
  assert.equal(res.status, 400);
  await assertJsonError(res);
});

test("a malformed JSON body answers 400 in JSON", async () => {
  const res = await fetch(`${baseUrl}/regenerate-html`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: "{oops",
  });
  assert.equal(res.status, 400);
  await assertJsonError(res);
});

test("an oversized JSON body answers 413 in JSON", async () => {
  const res = await fetch(`${baseUrl}/regenerate-html`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ sessionId: "x", padding: "a".repeat(600 * 1024) }),
  });
  assert.equal(res.status, 413);
  await assertJsonError(res);
});

test("describeRequestError never passes an unknown error's message through", () => {
  const internal = new Error("ECONNREFUSED 10.0.0.5:6379 at /var/task/src/secret-path.js");
  const { status, message } = app.describeRequestError(internal);
  assert.equal(status, 500);
  assert.ok(!message.includes("10.0.0.5") && !message.includes("secret-path"));
});

test("describeRouteError translates upstream failures without leaking their wording", () => {
  const fallback = "Failed to generate portfolio.";
  const upstream = (status) => Object.assign(new Error(`${status} raw upstream detail req_abc123`), { status });

  for (const [err, expectedStatus] of [
    [upstream(429), 503],
    [upstream(401), 503],
    [upstream(500), 500],
    [new Error("some internal bug"), 500],
    [Object.assign(new Error("GROQ_API_KEY is not set."), { code: "AI_NOT_CONFIGURED" }), 503],
    [new app.DeadlineError("too slow"), 504],
  ]) {
    const { status, message } = app.describeRouteError(err, fallback);
    assert.equal(status, expectedStatus, err.message);
    assert.ok(!/req_abc123|internal bug|GROQ_API_KEY/.test(message), `leaked: ${message}`);
  }

  // Unknown errors get exactly the route's fallback...
  assert.equal(app.describeRouteError(new Error("x"), fallback).message, fallback);
  // ...while a UserFacingError's own wording and status are used as written.
  assert.deepEqual(app.describeRouteError(new app.UserFacingError(422, "Readable reason."), fallback), {
    status: 422,
    message: "Readable reason.",
  });
});

test("POST /generate with an unreadable PDF explains the problem instead of calling the AI", async () => {
  const form = new FormData();
  form.append("resume", new Blob(["this is not really a pdf"], { type: "application/pdf" }), "resume.pdf");
  const res = await fetch(`${baseUrl}/generate`, { method: "POST", body: form });
  assert.equal(res.status, 422);
  assert.match((await assertJsonError(res)).error, /couldn't read that file/i);
});

test("POST /generate with too little pasted text is rejected before any AI call", async () => {
  const form = new FormData();
  form.append("resumeText", "hi");
  const res = await fetch(`${baseUrl}/generate`, { method: "POST", body: form });
  assert.equal(res.status, 422);
  assert.match((await assertJsonError(res)).error, /too short/i);
});

test("AI endpoints report a missing API key as 503 without naming the variable", async () => {
  const res = await fetch(`${baseUrl}/generate-cover-letter`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ resumeText: "A real-looking resume body.", jobDescription: "A job." }),
  });
  assert.equal(res.status, 503);
  const { error } = await assertJsonError(res);
  assert.match(error, /isn't set up/);
  assert.ok(!error.includes("GROQ_API_KEY"));
});

test("POST /regenerate-html treats another browser's session exactly like a missing one", async () => {
  seedSession("session-other-browser-test");
  const body = JSON.stringify({ sessionId: "session-other-browser-test", portfolioData: {} });
  const foreign = await fetch(`${baseUrl}/regenerate-html`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...asBrowser(BROWSER_B) },
    body,
  });
  const missing = await fetch(`${baseUrl}/regenerate-html`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ sessionId: "does-not-exist", portfolioData: {} }),
  });
  assert.equal(foreign.status, 400);
  // Identical responses: nothing distinguishes "exists but not yours".
  assert.deepEqual(await foreign.json(), await missing.json());
});

test("GET /healthz reports which configuration is present, never the values", async () => {
  const res = await fetch(`${baseUrl}/healthz`);
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.deepEqual(JSON.parse(body), {
    ok: true,
    ai: false, // GROQ_API_KEY is pinned to "" at the top of this file
    githubOAuth: true,
    jwtSecret: Boolean(process.env.JWT_SECRET),
    corsOrigin: process.env.CORS_ORIGIN ? "restricted" : "open (development)",
  });
  assert.ok(!body.includes("test-client-secret") && !body.includes("test-client-id"));
});

test("OAuth routes send the user back with an explanation when GitHub isn't configured", async () => {
  const saved = process.env.GITHUB_CLIENT_ID;
  // The .env.example placeholder must count as "not configured" too.
  for (const value of [undefined, "your_github_client_id_here"]) {
    if (value === undefined) delete process.env.GITHUB_CLIENT_ID;
    else process.env.GITHUB_CLIENT_ID = value;
    try {
      const res = await fetch(`${baseUrl}/auth/profile/github`, { redirect: "manual" });
      assert.equal(res.status, 302);
      const location = res.headers.get("location");
      assert.ok(!location.includes("github.com"), "must not send the user to GitHub with a bad client_id");
      assert.match(decodeURIComponent(location), /^\/\?error=.*isn't set up/);
    } finally {
      process.env.GITHUB_CLIENT_ID = saved;
    }
  }
});

test("responses carry the baseline security headers and don't advertise Express", async () => {
  for (const path of ["/", "/healthz"]) {
    const res = await fetch(`${baseUrl}${path}`);
    assert.equal(res.headers.get("x-content-type-options"), "nosniff", path);
    assert.equal(res.headers.get("x-frame-options"), "DENY", path);
    assert.equal(res.headers.get("x-powered-by"), null, path);
  }
});

test("the upload limit leaves headroom under Vercel's 4.5MB request-body cap", () => {
  // Headroom is for the other multipart fields sent with the resume
  // (profile photo up to ~250KB, favicon up to ~50KB).
  assert.ok(app.MAX_RESUME_BYTES + 350 * 1024 <= 4.5 * 1024 * 1024);
});

test("withDeadline passes fast work through and fails slow work with a DeadlineError", async () => {
  assert.equal(await app.withDeadline(Promise.resolve("done"), 50), "done");
  await assert.rejects(app.withDeadline(Promise.reject(new Error("boom")), 50), /boom/);
  const never = new Promise(() => {});
  await assert.rejects(app.withDeadline(never, 20), app.DeadlineError);
});

test("AI endpoints treat non-string text fields as missing rather than crashing", async () => {
  for (const body of [{ resumeText: { a: 1 }, jobDescription: "job" }, { resumeText: "resume", jobDescription: ["x"] }]) {
    const res = await fetch(`${baseUrl}/generate-cover-letter`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    });
    assert.equal(res.status, 400);
  }
});

test("GET /profile/sync without a bearer token returns 401", async () => {
  const res = await fetch(`${baseUrl}/profile/sync`);
  assert.equal(res.status, 401);
});

test("PUT /profile/sync without a bearer token returns 401", async () => {
  const res = await fetch(`${baseUrl}/profile/sync`, {
    method: "PUT",
    headers: JSON_HEADERS,
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
    headers: JSON_HEADERS,
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
    headers: JSON_HEADERS,
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
    headers: JSON_HEADERS,
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
    headers: JSON_HEADERS,
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
    headers: JSON_HEADERS,
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
