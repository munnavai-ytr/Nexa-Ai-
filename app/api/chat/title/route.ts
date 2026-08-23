import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

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

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: `Generate a concise, engaging, 3-to-5-word summary title for this user message. DO NOT use quotation marks, punctuation, or conversational intros. Return ONLY the title text:\n\n"${message.substring(0, 300)}"`,
        config: {
          temperature: 0.3,
        }
      });

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
