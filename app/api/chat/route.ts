import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { Pinecone } from "@pinecone-database/pinecone";
import { NextRequest, NextResponse } from "next/server";
import { getKnowledgeItems } from "@/lib/knowledgeStore";
import { getSupabase } from "@/lib/supabase";
import { sanitizeModelName, STABLE_FALLBACK_MODEL } from "@/lib/gemini-utils";

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
  // Enforce a strict 25-second backend timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const body = await req.json();
    const { messages, isThinking, isDeepResearch, model, apiKey, userApiKey: bodyApiKey, images, image, attachedImage } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Invalid request. 'messages' array is required." },
        { status: 400 }
      );
    }

    // Extract user-provided custom key from headers or request body (BYOK with Server Fallback)
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

    // Use user-supplied key or fallback to server GEMINI_API_KEY environment variable
    const serverApiKey = process.env.GEMINI_API_KEY?.trim() || "";
    const finalApiKey = (userKey && userKey.length >= 10) ? userKey : serverApiKey;

    if (!finalApiKey || finalApiKey.length < 10) {
      return NextResponse.json(
        { error: "🔑 Missing or Invalid Gemini API Key. Please configure your personal Gemini API Key in BYOK Settings to use Play Nexa AI." },
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

      // 2. Fetch from Supabase Global Library Knowledge Base
      if (retrievedSources.length === 0 && lastUserMessage.trim() && !isDeepResearch) {
        let globalDocs: { filename: string; content: string; title?: string }[] = [];
        const supabase = getSupabase();

        if (supabase) {
          try {
            const { data, error } = await supabase
              .from("global_library")
              .select("*");

            if (!error && data && data.length > 0) {
              globalDocs = data.map((row: any) => ({
                filename: row.file_name || row.title || "document.txt",
                title: row.title || row.file_name || "Document",
                content: row.content || ""
              }));
            }
          } catch (supabaseErr) {
            console.warn("[RAG] Supabase fetch error, fallback to local store:", supabaseErr);
          }
        }

        // Fallback to local memory if Supabase has no records or is unconfigured
        if (globalDocs.length === 0) {
          const items = getKnowledgeItems();
          globalDocs = items.map(item => ({
            filename: item.filename,
            title: item.filename,
            content: item.content
          }));
        }

        // Run Semantic Context Scanner & Calculate % Match
        const lowercaseQuery = lastUserMessage.toLowerCase();
        const queryTerms = lowercaseQuery
          .replace(/[^a-zA-Z0-9_\s]/g, " ")
          .split(/\s+/)
          .filter((t: string) => t.length >= 2);

        const matches = globalDocs.map(doc => {
          const content = doc.content;
          const lowercaseContent = content.toLowerCase();
          const docName = (doc.filename || doc.title || "").toLowerCase();

          let rawScore = 0;
          let bestIndex = -1;

          if (docName.includes(lowercaseQuery)) {
            rawScore += 45;
          }

          let matchedTermsCount = 0;
          queryTerms.forEach((term: string) => {
            if (docName.includes(term)) {
              matchedTermsCount++;
              rawScore += 20;
            } else if (lowercaseContent.includes(term)) {
              matchedTermsCount++;
              rawScore += 12;
              if (bestIndex === -1) {
                bestIndex = lowercaseContent.indexOf(term);
              }
            }
          });

          if (queryTerms.length > 0) {
            const ratio = matchedTermsCount / queryTerms.length;
            rawScore += Math.round(ratio * 35);
          }

          let percentMatch = 0;
          if (rawScore > 0) {
            percentMatch = Math.min(98, Math.max(25, Math.round(rawScore)));
          }

          let snippet = content.substring(0, 300);
          if (bestIndex !== -1) {
            const start = Math.max(0, bestIndex - 60);
            const end = Math.min(content.length, bestIndex + 240);
            snippet = (start > 0 ? "..." : "") + content.substring(start, end).trim() + (end < content.length ? "..." : "");
          }

          return { doc, score: percentMatch, snippet };
        }).filter(m => m.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);

        if (matches.length > 0) {
          retrievedSources = matches.map(m => ({
            filename: m.doc.filename,
            score: m.score,
            snippet: m.snippet
          }));
          contextText = matches.map(m => `[Source File: ${m.doc.filename}]\n${m.doc.content}`).join("\n\n---\n\n");
          sourceType = "Global Library (Supabase)";
        }
      }
    }

    const targetRootImages: any[] = [];
    if (Array.isArray(images) && images.length > 0) {
      targetRootImages.push(...images);
    } else if (image || attachedImage) {
      targetRootImages.push(image || attachedImage);
    }

    const contents = messages.map((msg: any, idx: number) => {
      const role = (msg.role === "assistant" || msg.role === "model") ? "model" : "user";
      const parts: any[] = [];
      const isLastMessage = idx === messages.length - 1;

      // Extract all image items for this message
      const messageRawImages: any[] = [];
      if (Array.isArray(msg.images) && msg.images.length > 0) {
        messageRawImages.push(...msg.images);
      } else if (Array.isArray(msg.attachedImages) && msg.attachedImages.length > 0) {
        messageRawImages.push(...msg.attachedImages);
      } else if (msg.image) {
        messageRawImages.push(msg.image);
      } else if (msg.attachedImage) {
        messageRawImages.push(msg.attachedImage);
      } else if (isLastMessage && targetRootImages.length > 0) {
        messageRawImages.push(...targetRootImages);
      }

      // Process each image into an inlineData part
      for (const item of messageRawImages) {
        let imgData = "";
        let imgMime = "image/jpeg";

        if (typeof item === "string") {
          imgData = item;
        } else if (item && typeof item === "object") {
          imgData = item.base64 || item.dataUrl || item.data || "";
          if (item.mimeType) imgMime = item.mimeType;
        }

        if (imgData) {
          // Strip data:image/...;base64, prefix if present
          if (imgData.includes(",")) {
            const split = imgData.split(",");
            imgData = split[1];
            if (split[0].includes(":") && split[0].includes(";")) {
              const mimeMatch = split[0].match(/:(.*?);/);
              if (mimeMatch && mimeMatch[1]) {
                imgMime = mimeMatch[1];
              }
            }
          }

          parts.push({
            inlineData: {
              data: imgData.trim(),
              mimeType: imgMime
            }
          });
        }
      }

      const hasImages = parts.length > 0;
      parts.push({ text: msg.content || (hasImages ? "Analyze these images and describe or extract details in depth." : "") });

      return {
        role: role,
        parts: parts,
      };
    });

    const requestedModel = typeof model === "string" && model.trim().length > 0 ? model.trim() : "gemini-3.5-flash";
    const sanitizedModel = sanitizeModelName(requestedModel);
    
    const modelsToTry = [
      sanitizedModel,
      "gemini-3.7-flash",
      "gemini-3.5-flash",
      "gemini-3.1-pro-preview",
      "gemini-3.1-flash-lite",
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash-latest",
      "gemini-1.5-flash",
      "gemini-1.5-flash-8b",
      "gemini-1.5-pro-latest",
      STABLE_FALLBACK_MODEL
    ].filter((m, i, arr) => m && arr.indexOf(m) === i);

    let systemInstruction = `You are the core intelligence of 'Nexa Ai'—an elite, world-class Senior Software Engineer, Systems Architect, and UI/UX Designer. You are designed to be the ultimate coding assistant, performing at the level of top-tier models like Claude 3.5 Sonnet.

COMMUNICATION RULES (STRICTLY ENFORCED):
1. Zero Fluff & No Preamble: NEVER use conversational fillers, robotic greetings, or closing remarks. Do not say 'As an AI...', 'Here is the code you requested...', 'Certainly!', or 'Let me know if you need more help!'.
2. Direct to Action: Answer immediately. If the user asks for code, start outputting the explanation or the code block directly in the very first sentence.
3. Code-First Mentality: Explain complex logic using comments INSIDE the code block rather than writing long paragraphs outside of it. Keep external prose highly concise and punchy.
4. Professional & Authoritative Tone: Speak developer-to-developer. Be highly analytical, precise, objective, and authoritative.
5. Proactive Debugging: If you spot a security flaw, edge case, memory leak, race condition, or bad practice in the user's prompt or code, point it out instantly and provide the modern, production-grade alternative.
6. Tech Stack Mastery: You are an absolute expert in modern web/mobile development (Next.js 15+, React 19, TypeScript, Tailwind CSS, Node.js, Supabase, Capacitor, Android, GitHub Actions, Drizzle/Prisma, etc.). Always recommend industry standard best practices.
7. Format code blocks cleanly with precise language identifiers (e.g. tsx, typescript, python, json, bash, rust, cpp, sql).

UI/UX WIREFRAMING & ASCII SKETCHING EXPERTISE:
You are a master UI/UX designer and software architect. You have the unique ability to visualize app ideas and automatically generate detailed, realistic ASCII/Unicode wireframes.

WIRE FRAME TRIGGERS:
- AUTOMATIC: When a user shares a new app idea, asks for design planning, layout structuring, or feature placement, you MUST automatically include a conceptual wireframe sketch.
- MANUAL: When the user explicitly asks for a sketch or mockup.

WIREFRAME QUALITY & DESIGN RULES:
1. Mobile-First Width Constraint (MANDATORY): When generating ASCII wireframes or UI mockups, strictly enforce a MAX WIDTH of 32 to 35 characters. This ensures the wireframe renders natively on mobile screen viewports without requiring horizontal scrolling or clipping on standard smartphone displays.
2. Realism & Depth: Go beyond basic lines. Use advanced Unicode shading (░, ▒, ▓, █) to represent images, progress bars, or active states.
3. Crisp Borders: Use precision box-drawing characters for clean UI elements (┌, ─, ┐, │, └, ┘, ├, ┤, ┬, ┴, ┼, ═, ║).
4. Modern Iconography: Seamlessly integrate emojis (🏠, 🔍, ⚙️, 🍔, 🛒, ▶️, 👤, 🔔, ⬇️) to represent icons, making it feel like a modern app interface.
5. Structure: Clearly define standard app components: Status bars, Headers, Navigation Drawers, Modals, Cards, Floating Action Buttons (FAB), and Bottom Tabs.
6. Monospace Formatting: **CRITICAL** - You MUST always wrap your sketches inside a Markdown code block (\`\`\`text ... \`\`\`) so the spacing and alignment render perfectly on the user's screen.
7. Contextual Explanation: After the sketch, briefly explain the UX logic behind your layout choices.

Example Style for Inspiration (Mobile-First 33-35 chars max width):
\`\`\`text
📱 App Screen: Video Downloader
┌─────────────────────────────────┐
│ 9:41 AM                [🔋] LTE │
├─────────────────────────────────┤
│ ☰  Play Nexa          🔍 ⚙️  🔔 │
├─────────────────────────────────┤
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ ▓▒▒▒  Paste URL / Code  ▒▒▒▒▒▓ │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│         [ ⚡ Download ]         │
├─────────────────────────────────┤
│ ⚡ QUEUE (1 Active)             │
│ ┌─────────────────────────────┐ │
│ │ █▒ Title: React Hook Guide  │ │
│ │ │████████░░░░░░░░│ 50%   ⏸ │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
\`\`\`

You are not limited to this style. Be creative, create multi-screen workflows, side-by-side comparisons, or deeply detailed components based on what the user needs.`;

    if (isThinking) {
      systemInstruction += `\n\nCRITICAL: Think step-by-step and output your detailed internal reasoning inside <thought> tags before providing the final answer.`;
    }

    if (contextText) {
      systemInstruction += `\n\nHere is matching reference context retrieved from the ${sourceType}:\n${contextText}\n\nStrictly prioritize, reference, and cite this context if it is relevant to answering the user's question.`;
    }

    let responseStream: any = null;
    let lastParsedError = { message: "All fallback models are currently unavailable.", status: 503 };

    for (const modelName of modelsToTry) {
      let attempts = 0;
      const maxAttempts = 2; // Increased retry attempts for 429/503
      
      while (attempts < maxAttempts) {
        try {
          responseStream = await ai.models.generateContentStream({
            model: modelName,
            contents: contents,
            config: {
              systemInstruction,
              temperature: 0.7,
              safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
              ]
            },
          });
          if (responseStream) break;
        } catch (err: any) {
          const parsed = parseGeminiError(err);
          lastParsedError = parsed;
          attempts++;
          
          if ((parsed.status === 503 || parsed.status === 429) && attempts < maxAttempts) {
            console.warn(`[AI Chat] Model ${modelName} hit ${parsed.status}. Retrying (Attempt ${attempts}/${maxAttempts})...`);
            await new Promise(res => setTimeout(res, 2000 * attempts)); // Increased backoff
            continue;
          }
          break;
        }
      }
      if (responseStream) break;
    }

    if (!responseStream) {
      const detailedMessage = `${lastParsedError.message}\n\n💡 Troubleshooting: Since all attempted models (including fallbacks like gemini-2.0-flash and gemini-1.5-flash) failed, please verify that your personal Gemini API Key in BYOK Settings is valid, active, has not expired, and has access to Gemini model endpoints.`;
      return NextResponse.json(
        { error: detailedMessage },
        { status: lastParsedError.status }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let usage = { promptTokens: 0, candidatesTokens: 0, totalTokens: 0 };
        try {
          for await (const chunk of responseStream) {
            if (chunk.text) {
              controller.enqueue(encoder.encode(JSON.stringify({ text: chunk.text }) + "\n"));
            }
            if (chunk.usageMetadata) {
              usage = {
                promptTokens: chunk.usageMetadata.promptTokenCount || 0,
                candidatesTokens: chunk.usageMetadata.candidatesTokenCount || 0,
                totalTokens: chunk.usageMetadata.totalTokenCount || 0
              };
            }
          }
          controller.enqueue(encoder.encode(JSON.stringify({ 
            done: true, 
            sources: retrievedSources, 
            sourceType: sourceType,
            usage
          }) + "\n"));
          controller.close();
        } catch (e: any) {
           controller.enqueue(encoder.encode(JSON.stringify({ error: e.message || "Streaming error" }) + "\n"));
           controller.close();
        }
      }
    });

    return new Response(stream, { 
      headers: { 
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache, no-transform'
      } 
    });
  } catch (error: any) {
    let message = "Internal Server Error";
    let status = 500;
    if (error && error.name === 'AbortError') {
      message = "⏱️ Request timed out. The operation took longer than 20 seconds.";
      status = 504;
    } else {
      try {
        const parsed = parseGeminiError(error);
        message = parsed.message || "Internal Server Error";
        status = (typeof parsed.status === 'number' && parsed.status >= 200 && parsed.status <= 599) ? parsed.status : 500;
      } catch (parseErr) {
        // ignore
      }
    }
    return NextResponse.json(
      { error: message },
      { status }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
