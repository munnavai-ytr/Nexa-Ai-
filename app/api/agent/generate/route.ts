import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { getKnowledgeItems } from "@/lib/knowledgeStore";

export async function POST(req: NextRequest) {
  try {
    const { messages, files, projectId, activeFilePath, model, useSearch = true } = await req.json();
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

    // Extract the User's Personal Gemini API Key from the Authorization header (BYOK model)
    const authHeader = req.headers.get("Authorization");
    let userApiKey = "";
    if (authHeader && authHeader.startsWith("Bearer ")) {
      userApiKey = authHeader.substring(7).trim();
    }

    if (!userApiKey) {
      return NextResponse.json(
        { error: "Your personal Gemini API Key is missing. Please configure it in Settings." },
        { status: 401 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey: userApiKey,
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
      throw lastError || new Error("Failed to generate content with available Gemini models.");
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
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
