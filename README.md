# Portfol.io — AI Portfolio Generator

Portfol.io turns your resume into a beautiful, deployable portfolio website in seconds. Upload a PDF or DOCX resume, and AI generates a fully designed portfolio with a custom color theme — ready to host on GitHub Pages for free.

---

## What It Does

- Upload your resume (PDF or DOCX)
- AI reads it and generates compelling portfolio copy
- AI picks a custom color theme based on your field
- Preview your portfolio instantly in the browser
- Download it as a single HTML file
- Or deploy it directly to GitHub Pages in one click

---

## Tech Stack

- **Backend** — Node.js + Express
- **AI** — Google Gemini 2.5 Flash
- **Resume parsing** — pdf-parse, mammoth
- **GitHub deployment** — GitHub OAuth + Octokit
- **Frontend** — Vanilla HTML/CSS/JS

---

## Setup

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/portfolio-gen.git
cd portfolio-gen
```

### 2. Install dependencies
```bash
npm install
```

### 3. Get your API keys

**Gemini API key (free):**
1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Click "Get API Key" → "Create API key in new project"
3. Copy the key

**GitHub OAuth credentials (free):**
1. Go to [github.com/settings/developers](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in:
   - Application name: `Portfol.io`
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3000/auth/callback`
4. Copy the Client ID and generate a Client Secret

### 4. Create your .env file

Create a file called `.env` in the root of the project:
```
GEMINI_API_KEY=your_gemini_api_key_here
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here
```

### 5. Run the app
```bash
node server.js
```

Open your browser and go to `http://localhost:3000`

---

## Deploying to Production

When hosting publicly (e.g. on Render or Railway), update your GitHub OAuth App settings:

- Homepage URL → your live domain e.g. `https://portfol.io`
- Authorization callback URL → `https://portfol.io/auth/callback`

Also add your environment variables in your hosting platform's dashboard instead of a `.env` file.

---

## Project Structure
```
portfolio-gen/
├── src/
│   ├── extract.js      # Resume text extraction (PDF + DOCX)
│   ├── ai.js           # Gemini AI content + theme generation
│   ├── generator.js    # HTML portfolio generation
│   └── deploy.js       # GitHub Pages deployment
├── public/
│   └── index.html      # Frontend web app
├── server.js           # Express server + GitHub OAuth
├── index.js            # CLI entry point
└── .env                # Your secret keys (never upload this)
|__ .gitignore
|__ index.js
|__package-lock.json
|__package.json
|__server.js
```

---

## Usage Notes

- Gemini free tier allows 1,500 requests per day — more than enough for personal use
- Generated portfolios include dark/light mode toggle
- Portfolios are mobile responsive out of the box
- No data is stored — resumes are deleted immediately after processing

---

## Contributing

Pull requests are welcome. For major changes please open an issue first.

---

Built with ✦ by [Your Name](https://github.com/YOUR_USERNAME)
