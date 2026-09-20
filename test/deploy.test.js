const test = require("node:test");
const assert = require("node:assert/strict");
const { PORTFOLIO_MARKER } = require("../src/generator");
const { resolveRepoName, buildLiveUrl, isForeignContent, REPO_SLUG_RE } = require("../src/deploy");

test("resolveRepoName defaults to the reserved username.github.io user-site repo", () => {
  assert.equal(resolveRepoName("alice", undefined), "alice.github.io");
  assert.equal(resolveRepoName("alice", ""), "alice.github.io");
});

test("resolveRepoName uses a valid custom slug for a project-site (multi-portfolio) deploy", () => {
  assert.equal(resolveRepoName("alice", "my-project"), "my-project");
  assert.equal(resolveRepoName("alice", "side.project_2"), "side.project_2");
});

test("resolveRepoName falls back to the user-site repo for a malformed slug", () => {
  assert.equal(resolveRepoName("alice", "../etc/passwd"), "alice.github.io");
  assert.equal(resolveRepoName("alice", "has spaces"), "alice.github.io");
  assert.equal(resolveRepoName("alice", "-leading-dash"), "alice.github.io");
});

test("buildLiveUrl serves the user-site repo at the bare domain", () => {
  assert.equal(buildLiveUrl("alice", "alice.github.io"), "https://alice.github.io");
  // Case-insensitive match against the reserved name
  assert.equal(buildLiveUrl("Alice", "alice.GITHUB.io"), "https://Alice.github.io");
});

test("buildLiveUrl serves any other repo as a project-page path", () => {
  assert.equal(buildLiveUrl("alice", "my-project"), "https://alice.github.io/my-project");
});

test("isForeignContent: no existing file is never foreign", () => {
  assert.equal(isForeignContent(null), false);
});

test("isForeignContent: content carrying the Portfol.io marker is not foreign", () => {
  assert.equal(isForeignContent(`<!DOCTYPE html><!-- ${PORTFOLIO_MARKER} --><html></html>`), false);
});

test("isForeignContent: unrelated existing content is flagged foreign", () => {
  assert.equal(isForeignContent("<html><body>My personal blog</body></html>"), true);
});

test("REPO_SLUG_RE matches GitHub's actual repo-naming rules closely enough to be safe", () => {
  assert.ok(REPO_SLUG_RE.test("my-repo_1.x"));
  assert.ok(!REPO_SLUG_RE.test(""));
  assert.ok(!REPO_SLUG_RE.test(".hidden"));
  assert.ok(!REPO_SLUG_RE.test("has/slash"));
  assert.ok(!REPO_SLUG_RE.test("a".repeat(91)));
});
