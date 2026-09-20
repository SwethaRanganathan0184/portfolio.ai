const test = require("node:test");
const assert = require("node:assert/strict");
const { findProfileGist, clampProfileData, GIST_DESCRIPTION, GIST_FILENAME } = require("../src/profileSync");

test("findProfileGist finds this tool's own gist among a user's gists", () => {
  const gists = [
    { id: "1", description: "Some other gist", files: { "notes.txt": {} } },
    { id: "2", description: GIST_DESCRIPTION, files: { [GIST_FILENAME]: {} } },
  ];
  assert.equal(findProfileGist(gists)?.id, "2");
});

test("findProfileGist returns null when no matching gist exists", () => {
  assert.equal(findProfileGist([{ id: "1", description: "Unrelated", files: {} }]), null);
  assert.equal(findProfileGist([]), null);
  assert.equal(findProfileGist(null), null);
});

test("findProfileGist ignores a gist with the right description but wrong filename", () => {
  const gists = [{ id: "1", description: GIST_DESCRIPTION, files: { "wrong.json": {} } }];
  assert.equal(findProfileGist(gists), null);
});

test("clampProfileData caps oversized cover-letter history and fields", () => {
  const hugeCoverLetters = Array.from({ length: 100 }, (_, i) => ({
    id: `id-${i}`,
    company: "C",
    role: "R",
    date: "D",
    content: "x".repeat(20000),
  }));
  const clamped = clampProfileData({ coverLetters: hugeCoverLetters });
  assert.equal(clamped.coverLetters.length, 30);
  assert.equal(clamped.coverLetters[0].content.length, 6000);
  assert.equal(clamped.version, 2);
});

test("clampProfileData keeps a full list of deployed portfolios, capped at 20", () => {
  const many = Array.from({ length: 30 }, (_, i) => ({
    liveUrl: `https://alice.github.io/proj-${i}`,
    name: "Alice",
    repoName: `proj-${i}`,
    deployedAt: "2024-01-01T00:00:00.000Z",
  }));
  const clamped = clampProfileData({ portfolios: many });
  assert.equal(clamped.portfolios.length, 20);
  assert.equal(clamped.portfolios[0].repoName, "proj-0");
});

test("clampProfileData drops a non-https portfolio entry", () => {
  const clamped = clampProfileData({
    portfolios: [
      { liveUrl: "javascript:alert(1)", name: "Bad" },
      { liveUrl: "https://alice.github.io", name: "Good" },
    ],
  });
  assert.equal(clamped.portfolios.length, 1);
  assert.equal(clamped.portfolios[0].liveUrl, "https://alice.github.io");
});

test("clampProfileData migrates a legacy v1 single portfolioLink into the v2 portfolios list", () => {
  const clamped = clampProfileData({ portfolioLink: "https://alice.github.io" });
  assert.equal(clamped.portfolios.length, 1);
  assert.equal(clamped.portfolios[0].liveUrl, "https://alice.github.io");
  assert.equal(clamped.version, 2);
});

test("clampProfileData handles missing/malformed input without throwing", () => {
  assert.doesNotThrow(() => clampProfileData({}));
  assert.doesNotThrow(() => clampProfileData(null));
  assert.doesNotThrow(() => clampProfileData({ resume: "not an object", coverLetters: "not an array" }));
});
