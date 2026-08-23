import { GoogleGenAI } from "@google/genai";
import { Pinecone } from "@pinecone-database/pinecone";
import { NextRequest, NextResponse } from "next/server";
import { getKnowledgeItems } from "@/lib/knowledgeStore";

// Helper to parse and format Gemini errors
function parseGeminiError(err: any): { message: string; status: number } {
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
      message: "🧠 The AI servers are currently handling heavy traffic (503 Service Unavailable). Please wait a moment and try again.",
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
  // Enforce a strict 25-second backend timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const body = await req.json();
    const { messages, isThinking, isDeepResearch, model, apiKey, userApiKey: bodyApiKey } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Invalid request. 'messages' array is required." },
        { status: 400 }
      );
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
        { error: "🔑 Gemini API Key required. Please configure your personal Gemini API Key in BYOK Settings (top navigation bar)." },
        { status: 401 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey: finalApiKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' }
      }
    });

    const lastUserMessage = messages[messages.length - 1]?.content || "";
    let contextText = "";
    let retrievedSources: { filename: string; score: number; snippet: string }[] = [];
    let sourceType = "Nexa Brain";

    // 1. Smart Intent Routing (Speed Optimization)
    const words = lastUserMessage.trim().split(/\s+/);
    const isGreeting = /^(hi|hello|hey|greetings|yo|morning|afternoon|evening)(\s+.*)?$/i.test(lastUserMessage.trim());
    const isSimpleConversational = words.length <= 5 && !/(code|error|bug|fix|implement|how to|function|class|api|database|react|nextjs)/i.test(lastUserMessage);
    
    // Bypass RAG/Search for greetings or very short conversational text
    const shouldBypassRAG = (isGreeting || isSimpleConversational) && !isDeepResearch;

    if (!shouldBypassRAG) {
      let pineconeApiKey = process.env.PINECONE_API_KEY;
      let pineconeIndexName = process.env.PINECONE_INDEX_NAME;

      if (pineconeIndexName && pineconeIndexName.startsWith("pcsk_")) {
        const temp = pineconeApiKey;
        pineconeApiKey = pineconeIndexName;
        pineconeIndexName = temp;
      }

      if (pineconeIndexName && (pineconeIndexName.includes("supabase") || pineconeIndexName.includes("http"))) {
        pineconeIndexName = "ai-coding-knowledge";
      }

      // Try Pinecone first (only if deep research is on OR not simple prompt)
      if (pineconeApiKey && pineconeIndexName && lastUserMessage.trim()) {
        try {
          const embedResponse = await ai.models.embedContent({
            model: "gemini-embedding-2-preview",
            contents: lastUserMessage,
            config: { outputDimensionality: 768 },
          });

          const queryVector = embedResponse.embeddings?.[0]?.values;

          if (queryVector) {
            const pc = new Pinecone({ apiKey: pineconeApiKey });
            const index = pc.index(pineconeIndexName);
            const queryResponse = await index.query({
              vector: queryVector,
              topK: 3,
              includeMetadata: true,
            });

            if (queryResponse.matches && queryResponse.matches.length > 0) {
              const matchesWithScores = queryResponse.matches.filter(match => match.score && match.score > 0.4);
              retrievedSources = matchesWithScores.map(match => {
                const metadata = match.metadata as any;
                return {
                  filename: metadata?.filename || "Unknown File",
                  score: Math.round((match.score || 0) * 100),
                  snippet: metadata?.text || "",
                };
              });
              const contexts = matchesWithScores.map(match => {
                const metadata = match.metadata as any;
                return `[Source File: ${metadata?.filename || "Unknown"}]\n${metadata?.text || ""}`;
              });
              if (contexts.length > 0) {
                contextText = contexts.join("\n\n---\n\n");
                sourceType = isDeepResearch ? "Deep Research" : "Global Library";
              }
            }
          }
        } catch (pineconeErr: any) {
          console.warn("[RAG] Pinecone query failed:", pineconeErr.message || pineconeErr);
        }
      }

      // Fallback: Global Knowledge Store Keyword matching
      if (retrievedSources.length === 0 && lastUserMessage.trim() && !isDeepResearch) {
        const items = getKnowledgeItems();
        const lowercaseQuery = lastUserMessage.toLowerCase();
        const terms = lowercaseQuery.split(/\s+/).filter((t: string) => t.length > 3);
        
        const matches = items.map(item => {
          const content = item.content.toLowerCase();
          let score = 0;
          
          if (item.filename.toLowerCase().includes(lowercaseQuery)) score += 50;
          
          let termMatches = 0;
          terms.forEach((term: string) => {
            if (content.includes(term)) {
              termMatches++;
              score += 15;
            }
          });

          return { item, score, termMatches };
        }).filter(m => m.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);

        if (matches.length > 0) {
          retrievedSources = matches.map(m => ({
            filename: m.item.filename,
            score: m.score,
            snippet: m.item.content.substring(0, 300)
          }));
          contextText = matches.map(m => `[Source File: ${m.item.filename}]\n${m.item.content}`).join("\n\n---\n\n");
          sourceType = "Global Library";
        }
      }
    }

    const contents = messages.map((msg: { role: string; content: string }) => {
      const role = msg.role === "assistant" ? "model" : "user";
      return {
        role: role,
        parts: [{ text: msg.content }],
      };
    });

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

    let systemInstruction = `You are Play Nexa AI, a friendly, versatile, and highly intelligent AI coding mentor and software architect.

CORE CONVERSATIONAL GUIDELINES:
1. GREETINGS & GENERAL QUESTIONS: When the user sends greetings (e.g., "Hi", "Hello", "Hey", "How are you?"), casual conversation, or asks broad non-coding questions, respond warmly, conversationally, and concisely in natural text. DO NOT generate code blocks, dummy programming boilerplate, or unsolicited script snippets for greetings or general chit-chat.
2. TECHNICAL & CODING QUERIES: ONLY output markdown code blocks when the user explicitly requests code, programming assistance, script writing, bug fixes, architecture implementation, or algorithmic solutions.
3. CONVERSATIONAL TONE: Keep conversational answers engaging, clear, helpful, and direct. When code IS requested, structure your answers with clear explanations and clean, production-grade syntax.`;

    if (isThinking) {
      systemInstruction += `\n\nCRITICAL: Think step-by-step and output your detailed internal reasoning inside <thought> tags before providing the final answer.`;
    }

    if (contextText) {
      systemInstruction += `\n\nHere is matching reference context retrieved from the ${sourceType}:\n${contextText}\n\nStrictly prioritize, reference, and cite this context if it is relevant to answering the user's question.`;
    }

    let response;
    let lastParsedError = { message: "All fallback models are currently unavailable.", status: 503 };

    for (const modelName of modelsToTry) {
      let attempts = 0;
      const maxAttempts = 1; // Reduce attempts for speed
      
      while (attempts < maxAttempts) {
        try {
          response = await ai.models.generateContent({
            model: modelName,
            contents: contents,
            config: {
              systemInstruction,
              temperature: 0.7,
            },
          });
          if (response) break;
        } catch (err: any) {
          const parsed = parseGeminiError(err);
          lastParsedError = parsed;
          attempts++;
          
          if ((parsed.status === 503 || parsed.status === 429) && attempts < maxAttempts) {
            await new Promise(res => setTimeout(res, 1000 * attempts));
            continue;
          }
          break;
        }
      }
      if (response) break;
    }

    if (!response) {
      return NextResponse.json(
        { error: lastParsedError.message },
        { status: lastParsedError.status }
      );
    }

    let text = "I apologize, but I could not generate a response.";
    try {
      if (response.text) {
        text = response.text;
      } else if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
        text = response.candidates[0].content.parts[0].text;
      }
    } catch (e) {
      // ignore
    }
    return NextResponse.json({ content: text, sources: retrievedSources, sourceType: sourceType });
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return NextResponse.json({ error: "⏱️ Request timed out. The operation took longer than 20 seconds." }, { status: 504 });
    }
    const parsed = parseGeminiError(error);
    return NextResponse.json(
      { error: parsed.message },
      { status: parsed.status }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
