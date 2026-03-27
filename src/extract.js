const fs = require("fs");
const path = require("path");

async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".pdf") {
    const pdfParse = require("pdf-parse");
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;

  } else if (ext === ".docx") {
    const mammoth = require("mammoth");
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;

  } else {
    throw new Error("Unsupported file type. Please use a PDF or DOCX file.");
  }
}

module.exports = { extractText };