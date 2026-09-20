// Vercel entry point. Vercel's Node runtime treats an exported Express app
// as a request handler directly — no separate adapter needed. server.js
// (which calls app.listen()) is only used for local/traditional hosting;
// this file is what actually runs on Vercel.
module.exports = require("../src/app");
