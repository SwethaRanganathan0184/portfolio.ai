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

test("every theme offered in the picker has a matching style layer", () => {
  const { STYLE_NAMES } = require("../src/styles");
  const offered = [...html.matchAll(/data-style="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(offered)].sort(), [...STYLE_NAMES].sort());
});
