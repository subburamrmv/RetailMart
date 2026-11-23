import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const app = express();
app.use(express.json({ limit: "1mb" }));

interface FirebaseAppletConfig {
  projectId: string;
}

let firebaseProjectId = "";
try {
  const cfgPath = path.resolve(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(cfgPath)) {
    const parsed = JSON.parse(fs.readFileSync(cfgPath, "utf8")) as FirebaseAppletConfig;
    firebaseProjectId = parsed.projectId || "";
  }
} catch {
  firebaseProjectId = "";
}

// Cache Google public certs for verifying Firebase ID tokens without requiring IAM
let cachedCerts: Record<string, string> = {};
let certsExpiresAt = 0;

async function getGoogleCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (now < certsExpiresAt && Object.keys(cachedCerts).length > 0) {
    return cachedCerts;
  }
  const resp = await fetch(
    "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
  );
  if (!resp.ok) {
    throw new Error("Unable to fetch Firebase public verification certificates.");
  }
  const cacheControl = resp.headers.get("cache-control") || "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeSec = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;
  certsExpiresAt = now + maxAgeSec * 1000;
  cachedCerts = (await resp.json()) as Record<string, string>;
  return cachedCerts;
}

function decodeBase64Url(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4;
  const padded = pad === 0 ? normalized : normalized + "=".repeat(4 - pad);
  return Buffer.from(padded, "base64");
}

interface VerifiedFirebaseToken {
  uid: string;
  email?: string;
  email_verified?: boolean;
}

async function verifyFirebaseIdToken(token: string): Promise<VerifiedFirebaseToken> {
  if (!firebaseProjectId) {
    throw new Error("Firebase project configuration is missing on the server.");
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed authentication token.");
  }
  const [headerB64, payloadB64, signatureB64] = parts;
  const header = JSON.parse(decodeBase64Url(headerB64).toString("utf8")) as {
    alg?: string;
    kid?: string;
  };
  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("Unsupported token signing algorithm.");
  }

  const certs = await getGoogleCerts();
  const cert = certs[header.kid];
  if (!cert) {
    throw new Error("Token key ID not recognized.");
  }

  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();
  const signatureValid = verifier.verify(cert, decodeBase64Url(signatureB64));
  if (!signatureValid) {
    throw new Error("Invalid authentication token signature.");
  }

  const payload = JSON.parse(decodeBase64Url(payloadB64).toString("utf8")) as {
    aud?: string;
    iss?: string;
    sub?: string;
    exp?: number;
    iat?: number;
    email?: string;
    email_verified?: boolean;
  };

  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.aud !== firebaseProjectId) {
    throw new Error("Token audience mismatch.");
  }
  if (payload.iss !== `https://securetoken.google.com/${firebaseProjectId}`) {
    throw new Error("Token issuer mismatch.");
  }
  if (!payload.sub || typeof payload.sub !== "string") {
    throw new Error("Token subject missing.");
  }
  if (!payload.exp || payload.exp <= nowSec) {
    throw new Error("Authentication token has expired.");
  }

  return {
    uid: payload.sub,
    email: payload.email,
    email_verified: payload.email_verified,
  };
}

interface AssistantHistoryItem {
  role: "user" | "assistant";
  content: string;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "retailmate-api" });
});

app.post("/api/ai/assistant", async (req, res) => {
  try {
    const body = req.body as {
      question?: string;
      language?: string;
      isSampleMode?: boolean;
      businessContext?: Record<string, unknown>;
      history?: AssistantHistoryItem[];
    };

    const isSampleMode = body.isSampleMode === true;
    const authHeader = req.headers.authorization || "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

    let verifiedUser: VerifiedFirebaseToken | null = null;
    if (!isSampleMode) {
      if (!bearerToken) {
        res.status(401).json({ error: "Please sign in to ask the AI Business Assistant about live business data." });
        return;
      }
      verifiedUser = await verifyFirebaseIdToken(bearerToken);
      if (!verifiedUser.email_verified) {
        res.status(403).json({ error: "Please verify your email address before using AI Business Assistant." });
        return;
      }
    }

    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (!question || question.length > 1500) {
      res.status(400).json({ error: "Please enter a clear question (1 to 1500 characters)." });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        error: "Gemini API key is not configured on the server yet. Please add GEMINI_API_KEY in Settings > Secrets.",
      });
      return;
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const langLabel = body.language === "ta" ? "Tamil (தமிழ்) with clear simple retail terms" : "English";
    const contextJson = JSON.stringify(body.businessContext || {}, null, 2).slice(0, 24000);
    const recentHistory = Array.isArray(body.history)
      ? body.history
          .slice(-6)
          .map((m) => `${m.role === "user" ? "Owner" : "Assistant"}: ${String(m.content || "").slice(0, 800)}`)
          .join("\n")
      : "";

    const systemInstruction = `You are RetailMate's AI Business Assistant for a small retail shop owner.
Reply in ${langLabel}.

STRICT RULES:
1. Use ONLY the verified, pre-calculated business data provided in BUSINESS_CONTEXT below. Never invent, extrapolate, or fabricate sales figures, stock counts, or product names.
2. Distinguish clearly between ACTUAL recorded figures and ESTIMATES/RECOMMENDATIONS. Profit figures (Gross Profit, Operating Profit) are estimates when product costs or expenses may be incomplete—state this honestly when relevant.
3. If the data in BUSINESS_CONTEXT does not contain enough history to answer a trend or forecast question, explicitly say what is missing rather than guessing.
4. You cannot modify stock, prices, or financial records directly—if the owner wants an action taken, tell them which RetailMate screen to use.
5. Use simple, everyday shopkeeper language. Whenever mentioning accounting concepts (COGS, Gross Margin, Operating Profit), briefly explain what they mean in plain words.
6. Be concise, practical, and structured with clear bullet points when helpful.`;

    const prompt = `BUSINESS_CONTEXT (Deterministic figures from the owner's authorized business${isSampleMode ? " — SAMPLE SANDBOX STORE" : ""}):
${contextJson}

${recentHistory ? `RECENT CONVERSATION:\n${recentHistory}\n` : ""}
OWNER QUESTION:
${question}`;

    const response = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: prompt,
      config: {
        systemInstruction,
      },
    });

    const answer = response.text?.trim();
    if (!answer) {
      res.status(502).json({ error: "The AI assistant returned an empty response. Please try asking again." });
      return;
    }

    res.json({
      answer,
      mode: isSampleMode ? "sample" : "live",
      uid: verifiedUser?.uid || null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to process AI assistant request.";
    const status = message.includes("token") || message.includes("Token") ? 401 : 500;
    res.status(status).json({ error: message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), "dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`RetailMate server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
