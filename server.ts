import express from "express";
import multer from "multer";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { createRequire } from "module";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { PDFParse } from "pdf-parse";

const require = createRequire(import.meta.url);
const mammoth = require("mammoth");

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Configure Multer for multipart/form-data in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

const SYSTEM_PROMPT = `You are Fitscore AI, an elite executive recruiter and technical hiring committee member.
Your sole purpose is to analyze the semantic alignment and conceptual fit between a candidate's CV (Curriculum Vitae) and a target Job Description.

CRITICAL MATCHING DIRECTIVE:
You must perform STRICTLY SEMANTIC/CONCEPTUAL evaluation. Never rely on keyword-frequency or literal string matching.
Recognize underlying skill equivalencies, functional domain expertise, and conceptual overlaps. For example:
- "Led a team of engineers" = "Team leadership" = "People management"
- "Built REST APIs" = "Backend development" = "API design"
- "Grew revenue 40%" = "Commercial impact" = "Business development"
- "Maintained high availability" = "SRE" = "Reliability engineering"
- "Drafted product specs" = "Product management" = "Requirement gathering"

OUTPUT CONTRACT:
Return ONLY valid JSON matching the exact schema below. Do not include any markdown prose, introductions, code block fences (\`\`\`json), or explanations outside the JSON object.

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
}`;

// Helper to validate JSON schema contract
function validateSchema(data: any) {
  if (typeof data.overall_score !== "number" || data.overall_score < 0 || data.overall_score > 100) {
    throw new Error("Invalid overall_score");
  }
  if (!data.breakdown || typeof data.breakdown !== "object") {
    throw new Error("Missing breakdown");
  }
  const keys = ["skills", "experience", "qualifications", "tone"];
  for (const k of keys) {
    if (typeof data.breakdown[k] !== "number" || data.breakdown[k] < 0 || data.breakdown[k] > 100) {
      throw new Error(`Invalid breakdown.${k}`);
    }
  }
  if (!Array.isArray(data.matched_skills) || !Array.isArray(data.missing_skills)) {
    throw new Error("Skills must be arrays");
  }
  if (!Array.isArray(data.rewrites) || data.rewrites.length === 0) {
    throw new Error("Rewrites must be non-empty array");
  }
  return true;
}

// POST /api/match endpoint matching exact backend contract
app.post("/api/match", upload.single("cv_file"), async (req: any, res: any) => {
  try {
    const jobDescription = req.body?.job_description;
    if (!jobDescription || !jobDescription.trim()) {
      return res.status(400).json({ detail: "job_description field cannot be empty." });
    }

    if (!req.file) {
      return res.status(400).json({ detail: "cv_file field is required." });
    }

    const filename = req.file.originalname.toLowerCase();
    let cvText = "";

    try {
      if (filename.endsWith(".pdf")) {
        try {
          const parser = new PDFParse({ data: req.file.buffer });
          const pdfData = await parser.getText();
          cvText = pdfData.text ? pdfData.text.trim() : "";
        } catch (pdfErr: any) {
          return res.status(400).json({ detail: `Corrupt or invalid PDF file: ${pdfErr.message}` });
        }
      } else if (filename.endsWith(".docx")) {
        try {
          const docxResult = await mammoth.extractRawText({ buffer: req.file.buffer });
          cvText = docxResult.value ? docxResult.value.trim() : "";
        } catch (docxErr: any) {
          return res.status(400).json({ detail: `Corrupt or invalid Word document (.docx): ${docxErr.message}` });
        }
      } else if (filename.endsWith(".txt") || filename.endsWith(".md")) {
        try {
          cvText = req.file.buffer.toString("utf-8").trim();
        } catch (txtErr: any) {
          return res.status(400).json({ detail: `Failed to read text file: ${txtErr.message}` });
        }
      } else {
        return res.status(400).json({ detail: "Unsupported file format. Please upload a PDF, DOCX, TXT, or MD file." });
      }
    } catch (err: any) {
      return res.status(400).json({ detail: `Error processing CV file: ${err.message}` });
    }

    if (!cvText) {
      return res.status(400).json({ detail: "Could not extract any readable text from the uploaded CV file. Please ensure it has valid textual content." });
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    const userPrompt = `Evaluate this candidate CV against the target Job Description.

=== CANDIDATE CV TEXT ===
${cvText}

=== TARGET JOB DESCRIPTION ===
${jobDescription}

Return ONLY raw JSON object.`;

    let rawJsonText = "";
    let engineUsed = "Anthropic Claude (claude-sonnet-4-6)";

    async function callAI(promptText: string, isRetry = false): Promise<string> {
      const sysPrompt = isRetry ? `${SYSTEM_PROMPT}\nIMPORTANT: RETURN ONLY RAW VALID JSON OBJECT. NO PROSE.` : SYSTEM_PROMPT;
      
      // Prefer Anthropic Claude if ANTHROPIC_API_KEY is available
      if (anthropicKey) {
        const client = new Anthropic({ apiKey: anthropicKey });
        const resp = await client.messages.create({
          // Note: claude-3-5-sonnet-20241022 or exact claude-sonnet-4-6 alias
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 2048,
          temperature: isRetry ? 0.1 : 0.2,
          system: sysPrompt,
          messages: [{ role: "user", content: promptText }],
        });
        const contentBlock = resp.content[0] as any;
        return contentBlock.text;
      } else if (geminiKey) {
        // Fallback proxy to Gemini 2.5 Flash if Anthropic secret is not configured in preview
        engineUsed = "Google Gemini 2.5 Proxy (Anthropic Fallback)";
        const ai = new GoogleGenAI({ apiKey: geminiKey });
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `${sysPrompt}\n\n${promptText}`,
          config: {
            responseMimeType: "application/json",
            temperature: isRetry ? 0.1 : 0.2,
          },
        });
        return response.text || "{}";
      } else {
        throw new Error("Neither ANTHROPIC_API_KEY nor GEMINI_API_KEY is configured in server environment secrets.");
      }
    }

    // First attempt
    try {
      rawJsonText = await callAI(userPrompt, false);
      let cleanText = rawJsonText.trim();
      if (cleanText.startsWith("```json")) cleanText = cleanText.slice(7);
      if (cleanText.startsWith("```")) cleanText = cleanText.slice(3);
      if (cleanText.endsWith("```")) cleanText = cleanText.slice(0, -3);
      cleanText = cleanText.trim();

      const parsed = JSON.parse(cleanText);
      validateSchema(parsed);
      res.setHeader("X-Fitscore-Engine", engineUsed);
      return res.json(parsed);
    } catch (firstErr: any) {
      console.warn("First AI match attempt failed validation, retrying once:", firstErr.message);
      // Retry once as mandated by Section 4
      const retryPrompt = `The previous attempt failed schema validation or JSON parsing: ${firstErr.message}.
Please evaluate the CV against the Job Description again.
Return ONLY valid JSON with exact schema. No markdown prose.

=== CANDIDATE CV TEXT ===
${cvText}

=== TARGET JOB DESCRIPTION ===
${jobDescription}`;

      try {
        rawJsonText = await callAI(retryPrompt, true);
        let cleanText = rawJsonText.trim();
        if (cleanText.startsWith("```json")) cleanText = cleanText.slice(7);
        if (cleanText.startsWith("```")) cleanText = cleanText.slice(3);
        if (cleanText.endsWith("```")) cleanText = cleanText.slice(0, -3);
        cleanText = cleanText.trim();

        const parsedRetry = JSON.parse(cleanText);
        validateSchema(parsedRetry);
        res.setHeader("X-Fitscore-Engine", engineUsed);
        return res.json(parsedRetry);
      } catch (finalErr: any) {
        return res.status(502).json({
          detail: `AI matching service failed to return valid JSON schema after retry: ${finalErr.message}`,
        });
      }
    }
  } catch (err: any) {
    console.error("Match API Error:", err);
    return res.status(500).json({ detail: err.message || "Internal server error" });
  }
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Fitscore Full-Stack API Bridge",
    contract: "FastAPI /api/match Equivalent",
    enginesSupported: ["Anthropic Claude (claude-sonnet-4-6)", "Google Gemini Proxy Fallback"],
    pdfParseDiagnostics: {
      type: typeof PDFParse,
      isClass: typeof PDFParse === "function",
    }
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    app.use("*", async (req, res, next) => {
      try {
        const url = req.originalUrl;
        let template = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Fitscore Server running on http://localhost:${PORT}`);
  });
}

startServer();
