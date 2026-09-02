import os
import json
import io
import uvicorn
from fastapi import FastAPI, UploadFile, Form, HTTPException, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import pdfplumber
from anthropic import Anthropic

app = FastAPI(
    title="Fitscore API",
    description="Semantic CV-to-Job-Description Matching Service",
    version="1.0.0"
)

# Enable CORS for frontend localhost:3000 and local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Breakdown(BaseModel):
    skills: int = Field(..., ge=0, le=100)
    experience: int = Field(..., ge=0, le=100)
    qualifications: int = Field(..., ge=0, le=100)
    tone: int = Field(..., ge=0, le=100)

class Rewrite(BaseModel):
    original: str
    improved: str

class MatchResponse(BaseModel):
    overall_score: int = Field(..., ge=0, le=100)
    breakdown: Breakdown
    matched_skills: list[str]
    missing_skills: list[str]
    rewrites: list[Rewrite]

SYSTEM_PROMPT = """You are Fitscore AI, an elite executive recruiter and technical hiring committee member.
Your sole purpose is to analyze the semantic alignment and conceptual fit between a candidate's CV (Curriculum Vitae) and a target Job Description.

CRITICAL MATCHING DIRECTIVE:
You must perform STRICTLY SEMANTIC/CONCEPTUAL evaluation. Never rely on keyword-frequency or literal string matching.
Recognize underlying skill equivalencies, functional domain expertise, and conceptual overlaps. For example:
- "Led a team of engineers" = "Team leadership" = "People management"
- "Built REST APIs" = "Backend development" = "API design"
- "Grew revenue 40%" = "Commercial impact" = 'Business development'
- "Maintained high availability" = "SRE" = "Reliability engineering"
- "Drafted product specs" = "Product management" = "Requirement gathering"

OUTPUT CONTRACT:
Return ONLY valid JSON matching the exact schema below. Do not include any markdown prose, introductions, code block fences (```json), or explanations outside the JSON object.

Required JSON Schema shape:
{
  "overall_score": integer (0 to 100),
  "breakdown": {
    "skills": integer (0 to 100),
    "experience": integer (0 to 100),
    "qualifications": integer (0 to 100),
    "tone": integer (0 to 100)
  },
  "matched_skills": list of strings (conceptual skills candidate possesses required by job),
  "missing_skills": list of strings (key requirements candidate lacks),
  "rewrites": list of exactly 3 objects with {"original": "...", "improved": "..."} (actionable CV bullet rewrites tailored to the job description)
}
"""

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extracts raw text from PDF file bytes using pdfplumber."""
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded PDF file is empty.")
    
    text_content = []
    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            if not pdf.pages:
                raise HTTPException(status_code=400, detail="Uploaded PDF has no pages.")
            for page in pdf.pages:
                extracted = page.extract_text()
                if extracted:
                    text_content.append(extracted)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Corrupt or invalid PDF file format: {str(e)}")
    
    full_text = "\n".join(text_content).strip()
    if not full_text:
        raise HTTPException(status_code=400, detail="Could not extract any readable text from the uploaded PDF. Please ensure it is not a scanned image without OCR.")
    
    return full_text

@app.post("/api/match", response_model=MatchResponse)
async def match_cv_to_job(
    cv_file: UploadFile = File(...),
    job_description: str = Form(...)
):
    """
    POST /api/match
    Accepts multipart/form-data: cv_file (PDF) and job_description (string).
    Returns semantic match breakdown.
    """
    if not job_description or not job_description.strip():
        raise HTTPException(status_code=400, detail="job_description field cannot be empty.")

    if not cv_file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF file uploads are supported.")

    file_bytes = await cv_file.read()
    cv_text = extract_text_from_pdf(file_bytes)

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Server configuration error: ANTHROPIC_API_KEY environment variable is not set.")

    client = Anthropic(api_key=api_key)

    user_prompt = f"""Evaluate this candidate CV against the target Job Description.

=== CANDIDATE CV TEXT ===
{cv_text}

=== TARGET JOB DESCRIPTION ===
{job_description}

Return ONLY the JSON matching schema.
"""

    # First API attempt
    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            temperature=0.2,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}]
        )
        raw_output = response.content[0].text.strip()
        
        # Clean potential markdown block wrapping if present
        if raw_output.startswith("```json"):
            raw_output = raw_output[7:]
        if raw_output.endswith("```"):
            raw_output = raw_output[:-3]
        raw_output = raw_output.strip()

        parsed_json = json.loads(raw_output)
        validated_data = MatchResponse(**parsed_json)
        return validated_data

    except Exception as first_error:
        # Retry once with explicit strict instruction
        retry_prompt = f"""The previous response failed schema validation or JSON parsing: {str(first_error)}.
Please evaluate the CV and Job Description again.
Return ONLY valid JSON with no markdown prose, no code fences, and no explanations.

=== CANDIDATE CV TEXT ===
{cv_text}

=== TARGET JOB DESCRIPTION ===
{job_description}
"""
        try:
            retry_response = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=2048,
                temperature=0.1,
                system=SYSTEM_PROMPT + "\nIMPORTANT: RETURN ONLY STRICT RAW VALID JSON OBJECT.",
                messages=[{"role": "user", "content": retry_prompt}]
            )
            raw_retry = retry_response.content[0].text.strip()
            if raw_retry.startswith("```json"):
                raw_retry = raw_retry[7:]
            if raw_retry.endswith("```"):
                raw_retry = raw_retry[:-3]
            raw_retry = raw_retry.strip()

            parsed_retry = json.loads(raw_retry)
            validated_retry = MatchResponse(**parsed_retry)
            return validated_retry
        except Exception as final_error:
            raise HTTPException(
                status_code=502,
                detail=f"AI matching service failed to return valid JSON schema after retry: {str(final_error)}"
            )

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "Fitscore FastAPI Backend", "version": "1.0.0"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
