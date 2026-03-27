#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { program } = require("commander");
const chalk = require("chalk");
const ora = require("ora");

const { extractText } = require("./src/extract");
const { generatePortfolioData, generateTheme } = require("./src/ai");
const { generateHTML } = require("./src/generator");

// Fix for chalk and ora ESM issues on older setups
const getChalk = async () => (await import("chalk")).default;
const getOra = async () => (await import("ora")).default;

async function run(resumePath) {
  const chalk = await getChalk();
  const { default: ora } = await import("ora");

  console.log("\n" + chalk.bold("  ✦ portfolio-gen\n"));

  // ── 1. Validate file exists ──
  if (!fs.existsSync(resumePath)) {
    console.error(chalk.red(`  ✗ File not found: ${resumePath}`));
    process.exit(1);
  }

  const ext = path.extname(resumePath).toLowerCase();
  if (![".pdf", ".docx"].includes(ext)) {
    console.error(chalk.red("  ✗ Only PDF and DOCX files are supported."));
    process.exit(1);
  }

  // ── 2. Extract resume text ──
  const extractSpinner = ora("  Reading resume...").start();
  let resumeText;
  try {
    resumeText = await extractText(resumePath);
    extractSpinner.succeed(chalk.green("  Resume read successfully"));
  } catch (err) {
    extractSpinner.fail(chalk.red("  Failed to read resume"));
    console.error(chalk.gray("  " + err.message));
    process.exit(1);
  }

  // ── 3. Generate portfolio content ──
  const contentSpinner = ora("  Generating portfolio content with AI...").start();
  let portfolioData;
  try {
    portfolioData = await generatePortfolioData(resumeText);
    contentSpinner.succeed(chalk.green("  Portfolio content generated"));
  } catch (err) {
    contentSpinner.fail(chalk.red("  Failed to generate content"));
    console.error(chalk.gray("  " + err.message));
    process.exit(1);
  }

  // ── 4. Generate theme ──
  const themeSpinner = ora("  Generating color theme with AI...").start();
  let theme;
  try {
    theme = await generateTheme(portfolioData);
    themeSpinner.succeed(chalk.green("  Theme generated"));
  } catch (err) {
    themeSpinner.fail(chalk.red("  Failed to generate theme"));
    console.error(chalk.gray("  " + err.message));
    process.exit(1);
  }

  // ── 5. Build HTML ──
  const buildSpinner = ora("  Building site...").start();
  try {
    const html = generateHTML(portfolioData, theme);
    fs.mkdirSync("./dist", { recursive: true });
    fs.writeFileSync("./dist/index.html", html);
    buildSpinner.succeed(chalk.green("  Site built"));
  } catch (err) {
    buildSpinner.fail(chalk.red("  Failed to build site"));
    console.error(chalk.gray("  " + err.message));
    process.exit(1);
  }

  // ── 6. Done ──
  console.log("\n" + chalk.bold.green("  ✓ Done!"));
  console.log(chalk.gray("  Your portfolio is ready in the") + chalk.white.bold(" ./dist ") + chalk.gray("folder"));
  console.log(chalk.gray("  Open") + chalk.white.bold(" ./dist/index.html ") + chalk.gray("in your browser to preview it\n"));

  console.log(chalk.bold("  Next step — deploy to GitHub Pages:"));
  console.log(chalk.gray("  1. Create a repo named") + chalk.white.bold(" username.github.io ") + chalk.gray("on GitHub"));
  console.log(chalk.gray("  2. Run these commands:\n"));
  console.log(chalk.cyan("     cd dist"));
  console.log(chalk.cyan("     git init"));
  console.log(chalk.cyan("     git add ."));
  console.log(chalk.cyan('     git commit -m "Deploy portfolio"'));
  console.log(chalk.cyan("     git branch -M main"));
  console.log(chalk.cyan("     git remote add origin https://github.com/USERNAME/USERNAME.github.io.git"));
  console.log(chalk.cyan("     git push -u origin main\n"));
}

program
  .name("portfolio-gen")
  .description("Generate a portfolio website from your resume using AI")
  .argument("<resume>", "Path to your resume file (PDF or DOCX)")
  .action(run);

program.parse();