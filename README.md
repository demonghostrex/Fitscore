# Fitscore — Semantic CV-to-Job-Description Matching MVP

Fitscore is a stateless MVP web application that performs **semantic and conceptual alignment analysis** between a candidate's CV (Curriculum Vitae) and a target Job Description.

Unlike traditional ATS scanners that rely on superficial keyword matching or string similarity (TF-IDF/Cosine), Fitscore bakes conceptual equivalence rules directly into system prompts sent to elite LLM reasoning engines (`claude-sonnet-4-6`). It recognizes equivalencies such as:
- *"Led a team of engineers"* = *"Team leadership"* = *"People management"*
- *"Built REST APIs"* = *"Backend development"* = *"API design"*
- *"Grew revenue 40%"* = *"Commercial impact"* = *"Business development"*

---

## 🏗️ Architecture & Folder Structure

```text
├── backend/
│   ├── main.py              # FastAPI server (POST /api/match, GET /api/health)
│   ├── requirements.txt     # Python dependencies (fastapi, uvicorn, pdfplumber, anthropic)
│   └── test_match.py        # Python verification script & sample cURL test harness
├── src/
│   ├── App.tsx              # Next.js / React App Router single-page UI
│   ├── main.tsx             # Client entry point
│   └── index.css            # Tailwind CSS styling
├── server.ts                # Express + Vite full-stack SSR proxy bridge (port 3000)
├── .env.example             # Documented environment variable template
└── README.md                # System documentation & walkthrough
```

---

## 🔐 Required Environment Variables

Configure your secrets in `.env` (or via the AI Studio Secrets panel):

```env
# Required for Claude Sonnet 4.6 semantic matching evaluations
ANTHROPIC_API_KEY="your_anthropic_api_key_here"

# Optional fallback proxy key in preview sandboxes
GEMINI_API_KEY="your_gemini_api_key_here"
```

---

## 🚀 How to Run Locally

### 1. Run the FastAPI Backend (Python 3.11+)

```bash
cd backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install required dependencies
pip install -r requirements.txt

# Export your API key
export ANTHROPIC_API_KEY="sk-ant-api03-..."

# Start FastAPI server on port 8000
uvicorn main:app --reload --port 8000
```
FastAPI Swagger documentation will be available at `http://localhost:8000/docs`.

### 2. Run the Frontend & Bridge Server (Node.js)

In a new terminal window at the project root:

```bash
# Install Node dependencies
npm install

# Start development bridge server (Express + Vite on Port 3000)
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## 🧪 Full Manual Test Walkthrough

### Option A: Instant 1-Click Browser Demo
1. Open `http://localhost:3000`.
2. Click the **"⚡ Load Sample Senior Engineer CV & Job"** button. This automatically generates a clean PDF file (`Alex_Vance_Senior_Lead_CV.pdf`) in browser memory and populates the Job Description textarea.
3. Click **"Check my Fitscore"**.
4. Observe the smooth circular animated score meter filling up, the 4 sub-score gauges (Skills, Experience, Qualifications, Tone), green matched chips, red missing chips, and actionable side-by-side bullet rewrites.

### Option B: Terminal cURL Verification

Verify the FastAPI `/api/match` endpoint directly from your terminal:

```bash
# Create a test text file or use a real PDF
curl -X POST http://localhost:8000/api/match \
  -H "Accept: application/json" \
  -F "cv_file=@/path/to/your_cv.pdf;type=application/pdf" \
  -F "job_description=Senior Backend Lead role requiring leadership and REST API architecture experience."
```

#### Expected JSON Output Contract:
```json
{
  "overall_score": 88,
  "breakdown": {
    "skills": 92,
    "experience": 85,
    "qualifications": 90,
    "tone": 85
  },
  "matched_skills": [
    "Python",
    "REST API Architecture",
    "Team leadership",
    "Reliability engineering"
  ],
  "missing_skills": [
    "Kubernetes",
    "AWS"
  ],
  "rewrites": [
    {
      "original": "Led a squad of 14 distributed software engineers across 3 squads.",
      "improved": "Spearheaded people management and technical direction for 14 cross-functional engineers, elevating delivery velocity."
    }
  ]
}
```

---

## 🛠️ Verification & Schema Guard

The backend implements a **1-shot retry schema guard**. If the LLM returns prose or truncated JSON, the server automatically intercepts the failure and issues a strict retry prompt (`"return ONLY valid JSON, no prose"`) before returning a clean HTTP 502/400 to the frontend.
