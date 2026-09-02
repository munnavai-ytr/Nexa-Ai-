import { GoogleGenAI } from "@google/genai";
import { Pinecone } from "@pinecone-database/pinecone";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load local env variables if running standalone
dotenv.config();

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");

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
        console.warn(`⚠️ [RATE-LIMIT] 429 Resource Exhausted. Retrying in ${backoff}ms (Attempt ${attempt}/${retries})...`);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      } else {
        throw err;
      }
    }
  }
  throw new Error("❌ Failed to generate embedding after multiple retries due to Rate Limits.");
}

async function main() {
  console.log("=== Start Pinecone Knowledge Base Sync ===");

  let pineconeApiKey = process.env.PINECONE_API_KEY;
  let pineconeIndexName = process.env.PINECONE_INDEX_NAME;
  const geminiApiKey = process.env.GEMINI_API_KEY;

  // Auto-correct swapped configuration
  if (pineconeIndexName && pineconeIndexName.startsWith("pcsk_")) {
    console.warn("⚠️ [AUTO-CORRECT] Swapped Pinecone credentials detected! Swapping key and index parameters...");
    const temp = pineconeApiKey;
    pineconeApiKey = pineconeIndexName;
    pineconeIndexName = temp;
  }

  // Fallback: If index name is missing or invalid (e.g. contains supabase url), use the auto-created index
  if (!pineconeIndexName || pineconeIndexName.includes("supabase") || pineconeIndexName.includes("http")) {
    console.warn("⚠️ [AUTO-CORRECT] Invalid index name detected. Falling back to 'ai-coding-knowledge'...");
    pineconeIndexName = "ai-coding-knowledge";
  }

  if (!pineconeApiKey) {
    console.error("❌ Error: PINECONE_API_KEY environment variable is not defined.");
    process.exit(1);
  }

  if (!pineconeIndexName) {
    console.error("❌ Error: PINECONE_INDEX_NAME environment variable is not defined.");
    process.exit(1);
  }

  if (!geminiApiKey) {
    console.error("❌ Error: GEMINI_API_KEY environment variable is not defined.");
    process.exit(1);
  }

  // Ensure knowledge directory exists
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    console.log(`📁 Directory '${KNOWLEDGE_DIR}' not found. Creating empty folder.`);
    fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
    
    // Seed standard knowledge items
    fs.writeFileSync(
      path.join(KNOWLEDGE_DIR, "typescript_best_practices.txt"),
      "TypeScript Best Practices:\nAlways enable strict mode. Use standard interfaces for model contracts. Prioritize static analysis and keep utility functions pure."
    );
    fs.writeFileSync(
      path.join(KNOWLEDGE_DIR, "tailwind_styling.txt"),
      "Tailwind CSS Styling:\nPrefer utility classes over custom css. Style container padding matching or exceeding inner gap. Minimize border-radii values to a maximum of 16px."
    );
    console.log("🌱 Seeded initial knowledge files into /knowledge");
  }

  const files = fs.readdirSync(KNOWLEDGE_DIR).filter(file => file.endsWith(".txt") || file.endsWith(".md"));

  if (files.length === 0) {
    console.log("ℹ️ No text or markdown files found in the knowledge directory. Exiting sync.");
    return;
  }

  console.log(`🔍 Found ${files.length} knowledge files to synchronize.`);

  // Initialize clients
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

  try {
    console.log(`📡 Connecting to Pinecone index: '${pineconeIndexName}'...`);
    const index = pc.index(pineconeIndexName);

    for (const file of files) {
      const filePath = path.join(KNOWLEDGE_DIR, file);
      const content = fs.readFileSync(filePath, "utf-8");
      
      if (!content.trim()) {
        console.log(`⚠️ Skipping empty file: ${file}`);
        continue;
      }

      const chunks = chunkText(content, 6000, 500);
      console.log(`🧠 Processing file: '${file}' - Split into ${chunks.length} chunks.`);

      for (let c = 0; c < chunks.length; c++) {
        const chunkTextContent = chunks[c];
        console.log(`   └─ Vectorizing chunk ${c + 1}/${chunks.length}...`);

        // Generate embedding with rate limit retry
        const embedResponse = await embedWithRetry(ai, chunkTextContent);

        const embeddingValues = embedResponse.embeddings?.[0]?.values;

        if (!embeddingValues) {
          console.error(`❌ Failed to get embedding values for chunk ${c + 1} of file: ${file}`);
          continue;
        }

        // Proactively sleep 1 second to stay within API rate limit quotas (15 RPM free tier safety)
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Upsert to Pinecone
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
      console.log(`🎉 Successfully synchronized all ${chunks.length} chunks of '${file}' with Pinecone!\n`);
    }

    console.log("=== Sync Finished Successfully! ===");
  } catch (err: any) {
    console.error("❌ Operational failure during synchronization:", err.message || err);
    process.exit(1);
  }
}

main();
