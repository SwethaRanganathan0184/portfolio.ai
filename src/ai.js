const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generatePortfolioData(resumeText) {
  const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const model = genAI.getGenerativeModel({ 
    model: modelName,
    generationConfig: { responseMimeType: "application/json" }
  });

  const prompt = `
    You are an expert portfolio copywriter and technical recruiter. Given the following resume text, 
    generate compelling portfolio website content.
    
    CRITICAL ATS-FRIENDLY & COPYWRITING INSTRUCTIONS:
    - Optimize the phrasing using professional, industry-standard, and ATS-friendly action verbs (e.g., "orchestrated", "engineered", "streamlined", "spearheaded").
    - DO NOT alter the core context, level of merit, years of experience, or degree of expertise. Do not inflate roles (e.g., do not turn a "Junior Engineer" into a "Lead Architect" or claim unearned certifications).
    - Maintain factual truth. Keep the levels of responsibility, impact, and technical depth identical to the resume.
    - Rewrite achievements to be impact-oriented (Focus on action + metric/result where available in the resume).
    
    IMPORTANT: Return ONLY a valid JSON object matching the schema below. No markdown, no backticks, no explanatory text.

    Resume:
    ${resumeText}

    Return exactly this JSON structure:
    {
      "name": "full name",
      "tagline": "one punchy headline describing who they are professionally",
      "about": "3 sentences in first person. Make it engaging, human, and clear. Avoid generic corporate buzzwords.",
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
          "highlight": "single most impressive achievement in one sentence using strong action verbs"
        }
      ],
      "projects": [
        {
          "title": "project name",
          "description": "2 sentences. Focus on what it does and the business/technical impact.",
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
  const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const model = genAI.getGenerativeModel({ 
    model: modelName,
    generationConfig: { responseMimeType: "application/json" }
  });

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

async function generateCoverLetter(resumeText, jobDescription) {
  const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const model = genAI.getGenerativeModel({ model: modelName });

  const prompt = `
    You are an expert executive coach and professional copywriter. 
    Write a highly tailored, professional, and compelling cover letter for a candidate applying to a position.
    
    Use the candidate's Resume Text and the target Job Description below:
    
    RESUME TEXT:
    ${resumeText}
    
    JOB DESCRIPTION:
    ${jobDescription}
    
    CRITICAL INSTRUCTIONS:
    1. Tailor the cover letter to highlight matching skills, experiences, and accomplishments from the Resume that directly address the requirements in the Job Description.
    2. DO NOT fabricate any facts, qualifications, years of experience, projects, or credentials. Everything mentioned must be strictly grounded in the candidate's Resume Text.
    3. Use a professional, confident, and engaging tone. Avoid generic buzzwords.
    4. Keep it concise: 3 to 4 paragraphs (plus formal header/salutation and sign-off).
    5. Return ONLY the plain text / markdown of the final cover letter. No explanations, no introductory remarks, no backticks.
  `;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

module.exports = { generatePortfolioData, generateTheme, generateCoverLetter };