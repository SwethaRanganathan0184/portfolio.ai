const { PORTFOLIO_MARKER } = require("./generator");

// @octokit/rest is a pure ESM package as of v20+, so it can't be loaded with
// require() from this CommonJS file. Load it lazily via dynamic import()
// instead (cached after the first call).
let _octokitCtorPromise;
function getOctokitCtor() {
  if (!_octokitCtorPromise) {
    _octokitCtorPromise = import("@octokit/rest").then((mod) => mod.Octokit);
  }
  return _octokitCtorPromise;
}

// A single secret Gist acts as the "database" — no server-side storage at all.
// It's found again on every sign-in by its description, the same way
// deploy.js finds its own prior deploys by a marker string.
const GIST_DESCRIPTION = "Portfol.io profile data — do not delete";
const GIST_FILENAME = "portfolio-io-profile.json";
const MAX_GISTS_TO_SCAN = 100;

/**
 * Pure — no network. Finds this tool's own gist among a user's gist list.
 * @param {Array<{description?: string, files?: Object, id: string}>} gists
 */
function findProfileGist(gists) {
  if (!Array.isArray(gists)) return null;
  return gists.find((g) => g.description === GIST_DESCRIPTION && g.files && g.files[GIST_FILENAME]) || null;
}

/**
 * Pure — caps every field so a signed-in client can never push an unbounded
 * or malformed payload into the gist.
 */
function clampProfileData(data) {
  const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");
  const arr = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);

  const resume =
    data && data.resume && typeof data.resume === "object"
      ? {
          name: str(data.resume.name, 150),
          tagline: str(data.resume.tagline, 200),
          email: str(data.resume.email, 200),
          skills: arr(data.resume.skills, 40).map((s) => str(s, 60)).filter(Boolean),
        }
      : null;

  const isHttpsUrl = (v) => typeof v === "string" && /^https:\/\/[^\s"'<>]+$/i.test(v);

  // v2: a list of every deployed portfolio (multi-portfolio deploy can
  // produce several), not just the last one. `data.portfolios` is the
  // current shape; a legacy singular `data.portfolioLink` (v1) is migrated
  // in as a single-entry list so nothing already synced gets lost.
  const rawPortfolios = Array.isArray(data?.portfolios)
    ? data.portfolios
    : isHttpsUrl(data?.portfolioLink)
    ? [{ liveUrl: data.portfolioLink, name: "", repoName: "", deployedAt: null }]
    : [];

  const portfolios = arr(rawPortfolios, 20)
    .filter((p) => isHttpsUrl(p?.liveUrl))
    .map((p) => ({
      liveUrl: p.liveUrl,
      name: str(p.name, 150),
      repoName: str(p.repoName, 100),
      deployedAt: str(p.deployedAt, 40) || null,
    }));

  const coverLetters = arr(data?.coverLetters, 30).map((l) => ({
    id: str(l?.id, 40),
    company: str(l?.company, 150),
    role: str(l?.role, 150),
    date: str(l?.date, 40),
    content: str(l?.content, 6000),
  }));

  return { version: 2, updatedAt: new Date().toISOString(), resume, portfolios, coverLetters };
}

/**
 * @param {Object} params
 * @param {string} params.accessToken - GitHub token with `gist` scope.
 * @returns {Promise<{username: string, profile: Object|null}>}
 */
async function getProfile({ accessToken }) {
  if (!accessToken) throw new Error("Missing GitHub access token.");

  const Octokit = await getOctokitCtor();
  const octokit = new Octokit({ auth: accessToken });
  const { data: user } = await octokit.rest.users.getAuthenticated();
  const { data: gists } = await octokit.rest.gists.list({ per_page: MAX_GISTS_TO_SCAN });
  const existing = findProfileGist(gists);
  if (!existing) return { username: user.login, profile: null };

  const { data: full } = await octokit.rest.gists.get({ gist_id: existing.id });
  const raw = full.files?.[GIST_FILENAME]?.content;
  let profile = null;
  if (raw) {
    try {
      profile = JSON.parse(raw);
    } catch (e) {
      profile = null;
    }
  }
  return { username: user.login, profile };
}

/**
 * @param {Object} params
 * @param {string} params.accessToken - GitHub token with `gist` scope.
 * @param {Object} params.data - Raw profile data to clamp and persist.
 * @returns {Promise<Object>} The clamped profile that was actually saved.
 */
async function saveProfile({ accessToken, data }) {
  if (!accessToken) throw new Error("Missing GitHub access token.");

  const clamped = clampProfileData(data);
  const content = JSON.stringify(clamped, null, 2);

  const Octokit = await getOctokitCtor();
  const octokit = new Octokit({ auth: accessToken });
  const { data: gists } = await octokit.rest.gists.list({ per_page: MAX_GISTS_TO_SCAN });
  const existing = findProfileGist(gists);

  if (existing) {
    await octokit.rest.gists.update({
      gist_id: existing.id,
      files: { [GIST_FILENAME]: { content } },
    });
  } else {
    await octokit.rest.gists.create({
      description: GIST_DESCRIPTION,
      public: false, // "secret" gist — unlisted, but not cryptographically private
      files: { [GIST_FILENAME]: { content } },
    });
  }

  return clamped;
}

/**
 * Properly revokes the OAuth grant on sign-out (not just forgetting the
 * token locally) using the app's client secret, per GitHub's REST API.
 */
async function revokeToken({ accessToken }) {
  if (!accessToken) return;
  const basic = Buffer.from(`${process.env.GITHUB_CLIENT_ID}:${process.env.GITHUB_CLIENT_SECRET}`).toString("base64");
  await fetch(`https://api.github.com/applications/${process.env.GITHUB_CLIENT_ID}/grant`, {
    method: "DELETE",
    headers: {
      Authorization: `Basic ${basic}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ access_token: accessToken }),
  });
}

module.exports = {
  getProfile,
  saveProfile,
  revokeToken,
  findProfileGist,
  clampProfileData,
  GIST_DESCRIPTION,
  GIST_FILENAME,
};
