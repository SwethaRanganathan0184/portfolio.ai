const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

// Static checks on the single-file frontend — no browser needed. These catch
// a class of bug the server-side tests can't see: JS referencing markup that
// doesn't exist, or client-side checks that drift from the server's formats.
const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
const script = (html.match(/<script>([\s\S]*?)<\/script>/) || [])[1] || "";

test("every element ID the script looks up exists in the markup", () => {
  const referenced = new Set([...script.matchAll(/getElementById\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1]));
  const defined = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const missing = [...referenced].filter((id) => !defined.has(id));
  assert.deepEqual(missing, [], `script references IDs with no matching element: ${missing.join(", ")}`);
});

test("no element ID is defined twice", () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepEqual(dupes, []);
});

test("the main script waits for the full DOM before touching elements below it", () => {
  // Several elements the script uses (#confirmOverlay, #successBanner) are
  // defined AFTER the <script> tag; running before they're parsed made
  // getElementById return null and killed the rest of the script.
  assert.match(script, /document\.addEventListener\(\s*["']DOMContentLoaded["']/);
});

test("the client's overwrite-confirm token check accepts a real server-issued token", () => {
  // The server issues a signed JWT; the client validates its shape before
  // putting it in a URL. If the two formats drift apart, the "existing site
  // found" dialog silently never appears.
  const regexSource = (script.match(/if \((\/\^\[A-Za-z0-9_-\][^\n]*?\$\/)\.test\(token\)\)/) || [])[1];
  assert.ok(regexSource, "couldn't find the confirm-token shape check in index.html");
  const shapeCheck = new RegExp(regexSource.slice(1, -1));
  const realToken = jwt.sign({ accessToken: "t", sessionId: "s" }, "secret", { expiresIn: "5m" });
  assert.ok(shapeCheck.test(realToken));
  assert.ok(!shapeCheck.test("<script>"));
});

test("the preview iframe is sandboxed away from this page's origin", () => {
  // Generated HTML is rendered via srcdoc, which shares the parent's origin
  // (and so its localStorage, where the GitHub token lives) unless sandboxed
  // WITHOUT allow-same-origin.
  const sandbox = (html.match(/<iframe id="previewFrame"[^>]*\ssandbox="([^"]*)"/) || [])[1];
  assert.ok(sandbox, "previewFrame has no sandbox attribute");
  const flags = sandbox.split(/\s+/);
  assert.ok(flags.includes("allow-scripts"), "the portfolio's own scripts need to run");
  assert.ok(!flags.includes("allow-same-origin"));
  assert.ok(!flags.includes("allow-top-navigation"));
});

test("the client-side resume size limit matches the server's", () => {
  const source = (script.match(/const MAX_RESUME_UPLOAD_BYTES = ([0-9*\s]+);/) || [])[1];
  assert.ok(source, "couldn't find MAX_RESUME_UPLOAD_BYTES in index.html");
  const clientLimit = source.split("*").reduce((product, n) => product * Number(n), 1);
  assert.equal(clientLimit, require("../src/app").MAX_RESUME_BYTES);
});

test("no API response is parsed with a bare res.json()", () => {
  // Platform-level errors (payload too large, timeouts) aren't JSON; every
  // call must go through readJSON(), which turns those into readable errors.
  assert.ok(script.includes("async function readJSON(res)"));
  assert.deepEqual(script.match(/\b\w+\.json\(\)/g) || [], []);
});

test("the favicon files the page links to all exist", () => {
  const hrefs = [...html.matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(hrefs.sort(), ["/apple-touch-icon.png", "/favicon.ico", "/favicon.svg"]);
  for (const href of hrefs) {
    const file = path.join(__dirname, "..", "public", href);
    assert.ok(fs.existsSync(file) && fs.statSync(file).size > 0, `${href} is missing or empty`);
  }
  // Each file is what its extension claims (an .ico that's really a PNG, or
  // an .svg that isn't XML, fails silently in browsers).
  const bytes = (name) => fs.readFileSync(path.join(__dirname, "..", "public", name));
  assert.deepEqual([...bytes("favicon.ico").subarray(0, 4)], [0, 0, 1, 0]);
  assert.equal(bytes("apple-touch-icon.png").subarray(1, 4).toString("ascii"), "PNG");
  assert.match(bytes("favicon.svg").toString("utf8"), /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
});

test("the footer credits both authors with links to their GitHub profiles", () => {
  const footer = (html.match(/<footer>([\s\S]*?)<\/footer>/) || [])[1] || "";
  assert.match(footer, /Built by/);
  for (const [name, url] of [["Swetha", "https://github.com/SwethaRanganathan0184"], ["Naveen", "https://github.com/nh-44"]]) {
    const link = new RegExp(`<a href="${url}" target="_blank" rel="noopener noreferrer">${name}</a>`);
    assert.match(footer, link, `${name}'s link is missing or unsafe`);
  }
});

// ── Profile merge on sign-in ──
// The merge logic lives inside the page's script, so it's lifted out by name
// and run here against a fake localStorage. Brace-matching is enough because
// these functions contain no braces inside strings.
function extractFunction(name) {
  const start = script.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `couldn't find function ${name} in index.html`);
  let depth = 0;
  for (let i = script.indexOf("{", start); i < script.length; i++) {
    if (script[i] === "{") depth++;
    else if (script[i] === "}" && --depth === 0) return script.slice(start, i + 1);
  }
  throw new Error(`unbalanced braces in ${name}`);
}

function mergeInBrowserWith(localData, remoteProfile) {
  const store = new Map(Object.entries(localData).map(([k, v]) => [k, JSON.stringify(v)]));
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  };
  const source = ["isSafeHttpsUrl", "readLocalList", "mergeRemoteProfile"].map(extractFunction).join("\n");
  new Function("localStorage", `${source}\nmergeRemoteProfile(${JSON.stringify(remoteProfile)});`)(localStorage);
  return Object.fromEntries([...store].map(([k, v]) => [k, JSON.parse(v)]));
}

test("signing in right after a deploy keeps the portfolio that was just deployed", () => {
  // The bug this guards against: sign-in used to REPLACE local data with the
  // synced copy, which doesn't contain a deploy made seconds ago.
  const justDeployed = { liveUrl: "https://jane.github.io/new", name: "Jane", repoName: "new", deployedAt: "2026-11-16T10:00:00.000Z" };
  const result = mergeInBrowserWith(
    { portfolio_deploys: [justDeployed] },
    {
      updatedAt: "2026-11-01T00:00:00.000Z",
      resume: null,
      portfolios: [{ liveUrl: "https://jane.github.io", name: "Jane", repoName: "jane.github.io", deployedAt: "2026-10-01T00:00:00.000Z" }],
      coverLetters: [],
    }
  );
  assert.deepEqual(result.portfolio_deploys.map((p) => p.liveUrl), ["https://jane.github.io/new", "https://jane.github.io"]);
});

test("merging profiles keeps one row per site (the latest deploy) and drops unsafe URLs", () => {
  const result = mergeInBrowserWith(
    { portfolio_deploys: [{ liveUrl: "https://jane.github.io", name: "Local redeploy", deployedAt: "2026-11-16T10:00:00.000Z" }] },
    {
      portfolios: [
        { liveUrl: "https://jane.github.io", name: "Older synced copy", deployedAt: "2026-10-01T00:00:00.000Z" },
        { liveUrl: "javascript:alert(1)", name: "bad" },
      ],
    }
  );
  assert.equal(result.portfolio_deploys.length, 1);
  assert.equal(result.portfolio_deploys[0].name, "Local redeploy");
});

test("merging profiles combines cover letters from both sides without duplicates", () => {
  const result = mergeInBrowserWith(
    { cover_letters: [{ id: "local1", company: "A" }, { id: "shared", company: "S (local)" }] },
    { coverLetters: [{ id: "shared", company: "S (remote)" }, { id: "remote1", company: "B" }] }
  );
  assert.deepEqual(result.cover_letters.map((l) => l.id), ["local1", "shared", "remote1"]);
});

test("merging profiles keeps this browser's resume only when it's newer than the synced one", () => {
  const remote = { updatedAt: "2026-11-10T00:00:00.000Z", resume: { name: "Synced", tagline: "t", email: "e", skills: [] } };

  const newerLocal = mergeInBrowserWith(
    { latest_resume: { name: "Local", resumeText: "full text", savedAt: "2026-11-16T00:00:00.000Z" } },
    remote
  );
  assert.equal(newerLocal.latest_resume.name, "Local");

  const olderLocal = mergeInBrowserWith(
    { latest_resume: { name: "Local", resumeText: "full text", savedAt: "2026-11-01T00:00:00.000Z" } },
    remote
  );
  assert.equal(olderLocal.latest_resume.name, "Synced");
  // The full resume text is never synced, so it must survive the swap.
  assert.equal(olderLocal.latest_resume.resumeText, "full text");

  // A new device with nothing local simply takes the synced copy.
  assert.equal(mergeInBrowserWith({}, remote).latest_resume.name, "Synced");
});

test("a successful deploy continues into the profile sign-in instead of leaving the user signed out", () => {
  // Deploying authorizes a short-lived, server-only token; the Profile page
  // needs its own. Without this hop the page asks someone who just "logged
  // in with GitHub" to sign in again.
  const deployedBlock = script.slice(script.indexOf("params.get('deployed') === 'true'"));
  const hop = deployedBlock.indexOf("window.location.replace('/auth/profile/github')");
  assert.notEqual(hop, -1, "the post-deploy sign-in redirect is missing");
  const guard = deployedBlock.slice(0, hop);
  // Only when not already signed in, and never after the user has declined.
  assert.ok(guard.includes("!getProfileToken()") && guard.includes("!syncDeclined()"));
  // The portfolio is saved before leaving the page, so it can't be lost.
  assert.ok(guard.includes("addDeployedPortfolio("));
});

test("every theme offered in the picker has a matching style layer", () => {
  const { STYLE_NAMES } = require("../src/styles");
  const offered = [...html.matchAll(/data-style="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(offered)].sort(), [...STYLE_NAMES].sort());
});
