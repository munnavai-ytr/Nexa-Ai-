import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { STABLE_FALLBACK_MODEL } from "@/lib/gemini-utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, apiKey, userApiKey: bodyApiKey } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ title: "New Conversation" });
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

    const finalApiKey = userKey || process.env.GEMINI_API_KEY?.trim() || "";
    if (!finalApiKey) {
      // Fallback to simple extraction
      const fallbackTitle = message.trim().split("\n")[0].substring(0, 30);
      return NextResponse.json({ title: fallbackTitle || "New Conversation" });
    }

    const ai = new GoogleGenAI({
      apiKey: finalApiKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' }
      }
    });

    const modelsToTry = ["gemini-2.0-flash", "gemini-1.5-flash-latest", "gemini-1.5-flash", "gemini-1.5-flash-8b", STABLE_FALLBACK_MODEL];
    let response;
    let lastErr;

    for (const modelName of modelsToTry) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: `Generate a concise, engaging, 3-to-5-word summary title for this user message. DO NOT use quotation marks, punctuation, or conversational intros. Return ONLY the title text:\n\n"${message.substring(0, 300)}"`,
          config: {
            temperature: 0.3,
            safetySettings: [
              { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
              { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
              { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
              { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
            ]
          }
        });
        if (response) break;
      } catch (err) {
        lastErr = err;
      }
    }

    try {
      let rawTitle = response?.text?.trim() || "";
      rawTitle = rawTitle.replace(/^["']|["']$/g, "").replace(/^Title:\s*/i, "").trim();
      if (!rawTitle || rawTitle.length > 50) {
        rawTitle = message.trim().split("\n")[0].substring(0, 30);
      }
      return NextResponse.json({ title: rawTitle });
    } catch (modelErr) {
      const fallback = message.trim().split("\n")[0].substring(0, 30);
      return NextResponse.json({ title: fallback || "New Conversation" });
    }
  } catch (err: any) {
    return NextResponse.json({ title: "New Conversation" });
  }
}
