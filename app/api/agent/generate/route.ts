import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { getKnowledgeItems } from "@/lib/knowledgeStore";
import { sanitizeModelName, STABLE_FALLBACK_MODEL } from "@/lib/gemini-utils";

// Helper to parse and format Gemini errors
function parseAgentGeminiError(err: any): { message: string; status: number } {
  let errStr = err?.message || String(err);
  let status = err?.status || err?.code || 500;

  try {
    if (errStr.includes("{")) {
      const jsonStart = errStr.indexOf("{");
      const jsonStr = errStr.substring(jsonStart);
      const parsed = JSON.parse(jsonStr);
      if (parsed?.error?.code) {
        status = parsed.error.code;
      }
      if (parsed?.error?.message) {
        errStr = parsed.error.message;
      }
    }
  } catch (e) {
    // ignore
  }

  if (status === 503 || errStr.includes("503") || errStr.toLowerCase().includes("overloaded") || errStr.toLowerCase().includes("high demand") || errStr.toLowerCase().includes("unavailable")) {
    return {
      message: "🧠 AI models are currently handling heavy traffic (503). Retrying...",
      status: 503
    };
  }

  if (status === 429 || errStr.includes("429") || errStr.toLowerCase().includes("quota") || errStr.toLowerCase().includes("too many requests") || errStr.toLowerCase().includes("rate limit") || errStr.toLowerCase().includes("resource_exhausted") || errStr.toLowerCase().includes("exhausted")) {
    return {
      message: "⏳ API Quota Exhausted (429). This usually means your personal Gemini API key has reached its free tier limit or a specific model limit. Nexa AI is attempting to switch to a fallback model if available.",
      status: 429
    };
  }

  if (status === 401 || status === 403 || errStr.toLowerCase().includes("api key") || errStr.toLowerCase().includes("authentication") || errStr.toLowerCase().includes("permission") || errStr.toLowerCase().includes("api_key_invalid")) {
    return {
      message: "🔑 Authentication failed. Please check or re-enter your personal Gemini API Key in BYOK Settings.",
      status: status === 401 || status === 403 ? status : 401
    };
  }

  if (status === 404 || errStr.toLowerCase().includes("not found") || errStr.toLowerCase().includes("invalid model")) {
    return {
      message: "🧩 The requested AI model was not found or is currently unavailable. Nexa AI is automatically attempting to use a fallback model.",
      status: 404
    };
  }

  return {
    message: errStr.length > 250 ? "An unexpected error occurred while communicating with the AI service." : errStr,
    status: typeof status === 'number' ? status : 500
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, files, projectId, activeFilePath, model, useSearch = true, apiKey, userApiKey: bodyApiKey } = body;
    const requestedModel = typeof model === "string" && model.trim().length > 0 ? model.trim() : "gemini-2.0-flash";
    const sanitizedModel = sanitizeModelName(requestedModel);
    
    const modelsToTry = [
      sanitizedModel,
      "gemini-2.0-flash",
      "gemini-1.5-flash-latest",
      "gemini-1.5-flash",
      "gemini-1.5-flash-8b",
      "gemini-2.0-flash-lite-preview-02-05",
      "gemini-1.5-pro-latest",
      STABLE_FALLBACK_MODEL
    ].filter((m, i, arr) => m && arr.indexOf(m) === i);

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "messages array is required" }, { status: 400 });
    }

    // Extract user-provided custom key from headers or request body (Strict BYOK Enforcement)
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    let userKey = req.headers.get("x-goog-api-key") || req.headers.get("x-gemini-api-key") || "";
    
    if (!userKey && authHeader && authHeader.startsWith("Bearer ")) {
      userKey = authHeader.substring(7).trim();
    }
    if (!userKey && apiKey && typeof apiKey === "string") {
      userKey = apiKey.trim();
    }
    if (!userKey && bodyApiKey && typeof bodyApiKey === "string") {
      userKey = bodyApiKey.trim();
    }

    // MANDATORY BYOK: Use ONLY the extracted key. Do NOT fallback to server env key.
    const finalApiKey = userKey;

    if (!finalApiKey || finalApiKey.length < 10) {
      return NextResponse.json(
        { error: "🔑 Missing or Invalid BYOK API Key. Please configure your personal Gemini API Key in BYOK Settings to use the Agent." },
        { status: 401 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey: finalApiKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' }
      }
    });

    const fileContext = files ? Object.entries(files).map(([path, content]) => {
      return `File: ${path}\n\`\`\`\n${content}\n\`\`\``;
    }).join("\n\n") : "No files yet.";

    // Inject data library knowledge
    const knowledgeItems = getKnowledgeItems();
    const knowledgeContext = knowledgeItems ? knowledgeItems.map(item => {
      return `Knowledge Item [${item.filename}] (Category: ${item.category}):\n${item.content}`;
    }).join("\n\n") : "No custom library items.";

    const systemInstruction = `You are Nexa-AI, an elite Autonomous Architect and Senior Front-End Application Engineer.
You build, modify, and refine production-ready web applications in a browser-based virtual workspace.

TECHNOLOGY STACK RULES (MANDATORY & ABSOLUTE):
1. Permitted Technologies:
   - Generate code EXCLUSIVELY using React (JSX/TSX), Tailwind CSS, and Vanilla JavaScript/HTML.
   - DO NOT output backend server code (such as Python, Node.js servers, PHP, Ruby, Django, Flask, FastAPI, Go servers, or Dockerfiles) because the runtime preview sandbox exclusively executes browser-side web technologies.
   - All data persistence and state must be handled on the client side using React hooks (useState, useEffect, useReducer, useRef, useMemo, useCallback) or browser localStorage.

2. Code Output Format:
   - Whenever a user asks to build an app or a component, you MUST return a structured response containing clean, production-ready React code styled with Tailwind CSS.
   - Your primary application entry point MUST be "App.tsx", which must export a default React functional component (e.g., "export default function App() { ... }").
   - You can also output or update "styles.css", "index.html", or supporting component files (e.g., "components/Card.tsx").
   - Style all UI elements using modern Tailwind CSS utility classes.
   - Icons must be imported from "lucide-react" (e.g., import { Plus, Trash, Search, Download, Check, Settings } from "lucide-react";).
   - The output format must be parsed correctly by the Sandpack preview panel so that the app renders immediately without crashing.

3. Execution Rule:
   - Prioritize single-file or multi-file React components that can be directly mounted inside a React Sandpack template. 
   - Ensure ALL required imports (like React hooks and Lucide icons) are explicitly included at the top of every file so that the preview mounts and renders immediately.

4. STRUCTURED JSON SCHEMA:
   - Your response MUST be valid JSON conforming exactly to this structure:
{
  "explanation": "Brief, professional, design-focused overview of the app or changes made (2-3 sentences). No emojis or promotional hype.",
  "files": [
    {
      "file": "App.tsx",
      "code": "// Complete, runnable React code styled with Tailwind CSS"
    }
  ]
}

5. GENERAL QUALITY DIRECTIVES:
   - NEVER output emojis anywhere in explanation or code.
   - Output complete, production-grade, bug-free implementations (no truncated blocks, no "// TODO" comments).
   - Ensure robust error boundaries, responsive design (desktop and mobile), and accessible contrast.

Existing Data Library knowledge for context:
${knowledgeContext}

Active workspace file tree and contents:
${fileContext}

Currently active file: ${activeFilePath || "None"}
Project ID: ${projectId || "None"}`;

    const contents = [
      ...messages.map((m: any) => ({
        role: m.role === "assistant" ? "model" : m.role,
        parts: [{ text: m.content }]
      }))
    ];

    const config: any = {
      systemInstruction,
      responseMimeType: "application/json",
      temperature: 0.2,
    };

    if (useSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    let response: any = null;
    let lastError: any = null;

    for (const modelToCall of modelsToTry) {
      let attempts = 0;
      const maxAttempts = 2;

      while (attempts < maxAttempts) {
        try {
          response = await ai.models.generateContent({
            model: modelToCall,
            contents,
            config: {
              ...config,
              safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
              ]
            }
          });
          if (response) break;
        } catch (err: any) {
          lastError = err;
          attempts++;
          const parsed = parseAgentGeminiError(err);

          if ((parsed.status === 503 || parsed.status === 429) && attempts < maxAttempts) {
            console.warn(`[Agent] Model ${modelToCall} hit ${parsed.status}. Retrying (Attempt ${attempts}/${maxAttempts})...`);
            await new Promise(res => setTimeout(res, 2000 * attempts));
            continue;
          }
          console.warn(`Model ${modelToCall} failed, trying next fallback:`, err.message);
          break;
        }
      }
      if (response) break;
    }

    if (!response) {
      const parsed = parseAgentGeminiError(lastError);
      return NextResponse.json(
        { error: parsed.message },
        { status: parsed.status }
      );
    }

    const rawText = response.text || "";
    let parsedData;
    try {
      // Find JSON block if it has markdown tags
      let jsonStr = rawText;
      if (rawText.includes("```json")) {
        const start = rawText.indexOf("```json") + 7;
        const end = rawText.lastIndexOf("```");
        jsonStr = rawText.substring(start, end).trim();
      } else if (rawText.includes("```")) {
        const start = rawText.indexOf("```") + 3;
        const end = rawText.lastIndexOf("```");
        jsonStr = rawText.substring(start, end).trim();
      }
      parsedData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.warn("Could not parse JSON directly, falling back to clean text wrapper", parseError);
      parsedData = {
        explanation: rawText || "Failed to parse structured JSON response from AI.",
        files: []
      };
    }

    return NextResponse.json({
      success: true,
      explanation: parsedData.explanation,
      files: parsedData.files || [],
      rawResponse: rawText,
      groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    });

  } catch (err: any) {
    console.error("Agent Generate error:", err);
    const parsed = parseAgentGeminiError(err);
    return NextResponse.json({ error: parsed.message || "Internal server error" }, { status: parsed.status });
  }
}
