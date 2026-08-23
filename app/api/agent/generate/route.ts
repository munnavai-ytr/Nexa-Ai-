import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { getKnowledgeItems } from "@/lib/knowledgeStore";

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

  if (status === 429 || errStr.includes("429") || errStr.toLowerCase().includes("quota") || errStr.toLowerCase().includes("too many requests") || errStr.toLowerCase().includes("rate limit")) {
    return {
      message: "⏳ Rate limit or quota exhausted (429 Too Many Requests). Please verify your personal Gemini API Key in BYOK Settings or wait a moment.",
      status: 429
    };
  }

  if (status === 401 || status === 403 || errStr.toLowerCase().includes("api key") || errStr.toLowerCase().includes("authentication") || errStr.toLowerCase().includes("permission") || errStr.toLowerCase().includes("api_key_invalid")) {
    return {
      message: "🔑 Authentication failed. Please check or re-enter your personal Gemini API Key in BYOK Settings.",
      status: status === 401 || status === 403 ? status : 401
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
    const rawModel = typeof model === "string" && model.trim().length > 0 ? model.trim() : "gemini-3.7-flash";
    
    // Map legacy / deprecated models to the active Gemini 3 series
    let mappedModel = rawModel;
    if (rawModel.includes("2.5-pro") || rawModel.includes("1.5-pro") || rawModel.includes("3.5-pro")) {
      mappedModel = "gemini-3.1-pro-preview";
    } else if (rawModel.includes("3.5-flash-lite") || rawModel.includes("flash-lite")) {
      mappedModel = "gemini-3.1-flash-lite";
    } else if (
      rawModel.includes("2.5-flash") ||
      rawModel.includes("2.0-flash") ||
      rawModel.includes("1.5-flash") ||
      rawModel.includes("1.0-pro") ||
      rawModel === "gemini-pro"
    ) {
      mappedModel = "gemini-3.7-flash";
    }

    const modelsToTry = [
      mappedModel,
      "gemini-3.7-flash",
      "gemini-3.1-pro-preview",
      "gemini-3.1-flash-lite"
    ].filter((m, i, arr) => m && arr.indexOf(m) === i);

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "messages array is required" }, { status: 400 });
    }

    // Extract user-provided custom key from headers or request body (Unified BYOK)
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

    // Prioritize user's custom key, fall back to server env if configured
    const finalApiKey = userKey || process.env.GEMINI_API_KEY?.trim() || "";

    if (!finalApiKey) {
      return NextResponse.json(
        { error: "🔑 Gemini API Key required. Please configure your personal Gemini API Key in BYOK Settings." },
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

    const systemInstruction = `You are Nexa-AI, an elite Autonomous Architect and Senior Application Coder.
You build, modify, and refine applications in a modern virtual workspace.

Strictest Guidelines:
1. NEVER output emojis anywhere.
2. Focus strictly on executing the exact instructions with clean layouts, beautiful styling, and thorough code.
3. Your output MUST be valid JSON (do not include trailing commas or markdown outside of the JSON block unless it is inside a markdown-escaped JSON container).
4. The JSON must follow this exact schema:
{
  "explanation": "Brief, professional, design-focused, non-technical overview of the changes made. Max 3-4 sentences. Do not use emojis, self-praising adjectives, or marketing jargon.",
  "files": [
    {
      "file": "file-path-to-write-or-update",
      "code": "complete contents of the file with your additions or modifications"
    }
  ]
}

Ensure all files modified or created have complete, fully working implementations (no comments like // TODO, no truncated blocks).
Make sure to preserve other existing code in the files unless explicitly told to rewrite it.

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
      try {
        response = await ai.models.generateContent({
          model: modelToCall,
          contents,
          config
        });
        if (response) break;
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${modelToCall} failed, trying next fallback:`, err.message);
      }
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
