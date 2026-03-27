const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generatePortfolioData(resumeText) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
    You are an expert portfolio copywriter. Given the following resume text, 
    generate compelling portfolio website content.
    
    IMPORTANT: Return ONLY a valid JSON object. No markdown, no backticks, 
    no explanation. Just the raw JSON.

    Resume:
    ${resumeText}

    Return exactly this JSON structure:
    {
      "name": "full name",
      "tagline": "one punchy headline describing who they are professionally",
      "about": "3 sentences in first person. Make it engaging and human, not corporate.",
      "email": "email address if found anywhere in resume, otherwise null",
      "linkedin": "full linkedin.com URL if found, otherwise null. Common formats: linkedin.com/in/username",
      "github": "full github.com URL if found, otherwise null. Common formats: github.com/username",
      "phone": "phone number if found, otherwise null",
      "skills": ["skill1", "skill2", "skill3"],
      "experience": [
        {
          "company": "company name",
          "role": "job title",
          "period": "start date - end date",
          "highlight": "single most impressive achievement in one sentence"
        }
      ],
      "projects": [
        {
          "title": "project name",
          "description": "2 sentences. Focus on what it does and why it matters.",
          "tags": ["tech1", "tech2"],
          "url": "project url if mentioned, otherwise null"
        }
      ],
      "cta": "one short friendly sentence inviting people to get in touch"
    }
  `;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  try {
    return JSON.parse(text);
  } catch (e) {
    const cleaned = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  }
}

async function generateTheme(portfolioData) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
    You are a UI designer. Based on this person's professional profile, 
    suggest a light mode AND dark mode color theme for their portfolio website.

    Their tagline: ${portfolioData.tagline}
    Their skills: ${portfolioData.skills.slice(0, 5).join(", ")}
    Their most recent role: ${portfolioData.experience[0]?.role || "professional"}

    IMPORTANT: Return ONLY a valid JSON object. No markdown, no backticks,
    no explanation. Just raw JSON.

    Return exactly this JSON structure:
    {
      "font": "name of one Google Font that fits their personality",
      "light": {
        "primary": "#hexcode",
        "secondary": "#hexcode",
        "background": "#hexcode",
        "surface": "#hexcode",
        "surfaceHover": "#hexcode",
        "text": "#hexcode",
        "textLight": "#hexcode",
        "accent": "#hexcode",
        "border": "#hexcode",
        "shadow": "rgba(0,0,0,0.08)"
      },
      "dark": {
        "primary": "#hexcode",
        "secondary": "#hexcode",
        "background": "#hexcode",
        "surface": "#hexcode",
        "surfaceHover": "#hexcode",
        "text": "#hexcode",
        "textLight": "#hexcode",
        "accent": "#hexcode",
        "border": "#hexcode",
        "shadow": "rgba(0,0,0,0.3)"
      }
    }

    Rules for light mode:
    - background: white or very light gray
    - surface: slightly darker than background for cards
    - surfaceHover: slightly darker than surface
    - text: very dark, near black
    - textLight: medium gray for secondary text
    - border: light gray

    Rules for dark mode:
    - background: very dark, like #0f0f0f or #111827
    - surface: slightly lighter than background for cards, like #1a1a2e or #1f2937
    - surfaceHover: slightly lighter than surface
    - text: near white
    - textLight: light gray for secondary text
    - border: dark gray, subtle
    - primary: slightly brighter/more saturated version of light mode primary

    Rules for both:
    - primary is the dominant brand color
    - accent is used for highlights and tags
    - For engineers: clean and minimal blues or greens
    - For designers: more creative purples or teals
    - For finance/business: corporate navy or deep blues
    - Make sure contrast ratios are accessible (text readable on background)
  `;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  try {
    return JSON.parse(text);
  } catch (e) {
    const cleaned = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  }
}

module.exports = { generatePortfolioData, generateTheme };