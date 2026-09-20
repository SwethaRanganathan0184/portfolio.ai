const app = require("./src/app");

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  ✦ Portfol.io running at http://localhost:${PORT}\n`);
});
