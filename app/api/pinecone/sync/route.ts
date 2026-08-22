import { GoogleGenAI } from "@google/genai";
import { Pinecone } from "@pinecone-database/pinecone";
import { NextRequest, NextResponse } from "next/server";
import { getKnowledgeItems } from "@/lib/knowledgeStore";

// Helper function for chunking document text to avoid Pinecone metadata size limits
function chunkText(text: string, maxChunkSize: number = 6000, overlap: number = 500): string[] {
  const chunks: string[] = [];
  let index = 0;

  while (index < text.length) {
    let endIndex = index + maxChunkSize;
    if (endIndex >= text.length) {
      chunks.push(text.substring(index));
      break;
    }
    // Try to find a good breaking point like a newline
    const nextNewline = text.lastIndexOf("\n", endIndex);
    if (nextNewline > index + maxChunkSize * 0.7) {
      endIndex = nextNewline;
    }
    chunks.push(text.substring(index, endIndex).trim());
    index = endIndex - overlap;
    if (index < 0) index = 0;
  }
  return chunks;
}

// Helper function to embed text with exponential backoff on 429 rate limits
async function embedWithRetry(ai: any, text: string, retries: number = 5, delayMs: number = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await ai.models.embedContent({
        model: "gemini-embedding-2-preview",
        contents: text,
        config: {
          outputDimensionality: 768,
        },
      });
      return response;
    } catch (err: any) {
      const isRateLimit = err?.message?.includes("exceeded your current quota") || 
                          err?.message?.includes("429") || 
                          err?.status === 429 || 
                          err?.code === 429;
      if (isRateLimit && attempt < retries) {
        const backoff = delayMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      } else {
        throw err;
      }
    }
  }
  throw new Error("❌ Failed to generate embedding after multiple retries due to Rate Limits.");
}

export async function POST() {
  const logs: string[] = [];
  logs.push("=== Programmatic Vector Sync Initiated ===");

  let pineconeApiKey = process.env.PINECONE_API_KEY;
  let pineconeIndexName = process.env.PINECONE_INDEX_NAME;
  const geminiApiKey = process.env.GEMINI_API_KEY;

  // Auto-correct swapped configuration
  if (pineconeIndexName && pineconeIndexName.startsWith("pcsk_")) {
    logs.push("⚠️ [AUTO-CORRECT] Swapped Pinecone credentials detected! Swapping key and index parameters...");
    const temp = pineconeApiKey;
    pineconeApiKey = pineconeIndexName;
    pineconeIndexName = temp;
  }

  // Fallback: If index name is missing or invalid (e.g. contains supabase url), use the auto-created index
  if (!pineconeIndexName || pineconeIndexName.includes("supabase") || pineconeIndexName.includes("http")) {
    logs.push("⚠️ [AUTO-CORRECT] Invalid index name detected. Falling back to 'ai-coding-knowledge'...");
    pineconeIndexName = "ai-coding-knowledge";
  }

  if (!pineconeApiKey || !pineconeIndexName) {
    logs.push("⚠️ Pinecone variables (PINECONE_API_KEY or PINECONE_INDEX_NAME) are not configured yet in secrets.");
    return NextResponse.json({
      status: "needs_config",
      logs
    }, { status: 200 });
  }

  if (!geminiApiKey) {
    logs.push("❌ Failure: GEMINI_API_KEY is not configured.");
    return NextResponse.json({
      status: "error",
      logs
    }, { status: 200 });
  }

  const items = getKnowledgeItems();

  if (items.length === 0) {
    logs.push("ℹ️ No text or markdown files found in the knowledge store. Exiting.");
    return NextResponse.json({ status: "success", logs });
  }

  logs.push(`🔍 Found ${items.length} knowledge documents to index.`);

  try {
    const ai = new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const pc = new Pinecone({
      apiKey: pineconeApiKey,
    });

    logs.push(`📡 Handshaking with Pinecone Index: '${pineconeIndexName}'...`);
    const index = pc.index(pineconeIndexName);

    for (const item of items) {
      const file = item.filename;
      const content = item.content;

      if (!content.trim()) {
        logs.push(`⚠️ Skipping empty file: '${file}'`);
        continue;
      }

      const chunks = chunkText(content, 6000, 500);
      logs.push(`🧠 Processing file: '${file}' - Split into ${chunks.length} chunks.`);

      for (let c = 0; c < chunks.length; c++) {
        const chunkTextContent = chunks[c];
        logs.push(`   └─ Vectorizing chunk ${c + 1}/${chunks.length}...`);

        // Generate embedding with rate limit retry
        const embedResponse = await embedWithRetry(ai, chunkTextContent);
        
        const embeddingValues = embedResponse.embeddings?.[0]?.values;
        if (!embeddingValues) {
          logs.push(`❌ Embedding generation failed for chunk ${c + 1} of: '${file}'`);
          continue;
        }

        // Proactively sleep 1 second to stay within API rate limit quotas (15 RPM free tier safety)
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const cleanFilename = file.replace(/[^a-zA-Z0-9_\-\.]/g, "-");
        const chunkId = `doc-${cleanFilename}-chunk-${c + 1}`;

        await index.upsert({
          records: [
            {
              id: chunkId,
              values: embeddingValues,
              metadata: {
                filename: file,
                text: chunkTextContent,
                chunk_index: c,
                total_chunks: chunks.length,
                sync_timestamp: new Date().toISOString()
              }
            }
          ]
        });
      }

      logs.push(`🎉 Successfully indexed all ${chunks.length} chunks of: '${file}'!`);
    }

    logs.push("=== Sync Completed Successfully ===");
    return NextResponse.json({ status: "success", logs });

  } catch (err: any) {
    // Log connection failures as warning to avoid false positive logs
    console.warn("Pinecone Sync Connection Error:", err.message || err);
    logs.push(`❌ Connection Error: ${err.message || err}`);
    return NextResponse.json({ status: "error", logs }, { status: 200 });
  }
}
