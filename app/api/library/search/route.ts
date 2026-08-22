import { GoogleGenAI } from "@google/genai";
import { Pinecone } from "@pinecone-database/pinecone";
import { NextRequest, NextResponse } from "next/server";
import { getKnowledgeItems } from "@/lib/knowledgeStore";

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();

    if (!query || !query.trim()) {
      return NextResponse.json({ success: true, matches: [] });
    }

    let pineconeApiKey = process.env.PINECONE_API_KEY;
    let pineconeIndexName = process.env.PINECONE_INDEX_NAME;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    // Auto-correct swapped configuration
    if (pineconeIndexName && pineconeIndexName.startsWith("pcsk_")) {
      const temp = pineconeApiKey;
      pineconeApiKey = pineconeIndexName;
      pineconeIndexName = temp;
    }

    // Fallback: If index name is missing or invalid (e.g. contains supabase url), use the auto-created index
    if (pineconeIndexName && (pineconeIndexName.includes("supabase") || pineconeIndexName.includes("http"))) {
      pineconeIndexName = "ai-coding-knowledge";
    }

    // Try semantic vector search if configured
    if (pineconeApiKey && pineconeIndexName && geminiApiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey: geminiApiKey });
        const pc = new Pinecone({ apiKey: pineconeApiKey });
        const index = pc.index(pineconeIndexName);

        const embedResponse = await ai.models.embedContent({
          model: "gemini-embedding-2-preview",
          contents: query,
          config: {
            outputDimensionality: 768,
          },
        });

        const queryVector = embedResponse.embeddings?.[0]?.values;

        if (queryVector) {
          const queryResponse = await index.query({
            vector: queryVector,
            topK: 5,
            includeMetadata: true,
          });

          if (queryResponse.matches && queryResponse.matches.length > 0) {
            const matches = queryResponse.matches.map(m => {
              const metadata = m.metadata as any;
              return {
                filename: metadata?.filename || "Unknown File",
                score: Math.round((m.score || 0) * 100),
                snippet: metadata?.text || "",
                source: "Semantic Match (Pinecone)"
              };
            });
            return NextResponse.json({ success: true, matches, method: "semantic" });
          }
        }
      } catch (err: any) {
        console.warn("[Library Search] Pinecone search error, falling back to local:", err.message || err);
      }
    }

    // Fallback: Local Keyword Matching Search (Robust & client-ready)
    const items = getKnowledgeItems();
    const lowercaseQuery = query.toLowerCase();

    const matches = items
      .map(item => {
        const content = item.content;
        const lowercaseContent = content.toLowerCase();

        let score = 0;
        let snippet = content.substring(0, 300);

        // Filename matches
        if (item.filename.toLowerCase().includes(lowercaseQuery)) {
          score += 50;
        }

        // Substring term match score
        const terms = lowercaseQuery.split(/\s+/);
        let termMatches = 0;
        terms.forEach((term: string) => {
          if (term.length > 2 && lowercaseContent.includes(term)) {
            termMatches++;
            score += 15;
          }
        });

        // Pull dynamic snippet centering around matching query term
        if (termMatches > 0) {
          const index = lowercaseContent.indexOf(terms[0]);
          if (index !== -1) {
            const start = Math.max(0, index - 50);
            const end = Math.min(content.length, index + 250);
            snippet = (start > 0 ? "..." : "") + content.substring(start, end) + (end < content.length ? "..." : "");
          }
        }

        return {
          filename: item.filename,
          score: Math.min(100, score),
          snippet: snippet,
          source: "Local Keyword Search (Fallback)"
        };
      })
      .filter(m => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return NextResponse.json({ success: true, matches, method: "keyword" });
  } catch (err: any) {
    console.warn("Library search execution error:", err.message || err);
    return NextResponse.json({ success: false, matches: [], error: err.message }, { status: 500 });
  }
}
