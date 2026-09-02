import { GoogleGenAI } from "@google/genai";
import { Pinecone } from "@pinecone-database/pinecone";
import { NextRequest, NextResponse } from "next/server";
import { getKnowledgeItems } from "@/lib/knowledgeStore";
import { getSupabase } from "@/lib/supabase";

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

    // 1. Try Pinecone Vector Search if available
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
                score: Math.min(100, Math.round((m.score || 0) * 100)),
                snippet: metadata?.text || "",
                source: "Semantic Match (Pinecone)"
              };
            });
            return NextResponse.json({ success: true, matches, method: "semantic" });
          }
        }
      } catch (err: any) {
        console.warn("[Library Search] Pinecone search error, falling back to Supabase/local:", err.message || err);
      }
    }

    // 2. Fetch Global Documents from Supabase (Persistent Global Library)
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
        console.warn("[Library Search] Supabase fetch error, using local fallback:", supabaseErr);
      }
    }

    // If no docs from Supabase, fallback to in-memory knowledge store
    if (globalDocs.length === 0) {
      const localItems = getKnowledgeItems();
      globalDocs = localItems.map(item => ({
        filename: item.filename,
        title: item.filename,
        content: item.content
      }));
    }

    // 3. Dynamic Context Scanner to calculate % Match (e.g. 66% Match)
    const lowercaseQuery = query.toLowerCase();
    const queryTerms = lowercaseQuery
      .replace(/[^a-zA-Z0-9_\s]/g, " ")
      .split(/\s+/)
      .filter((t: string) => t.length >= 2);

    const matches = globalDocs
      .map(doc => {
        const content = doc.content;
        const lowercaseContent = content.toLowerCase();
        const docName = (doc.filename || doc.title || "").toLowerCase();

        let rawScore = 0;
        let snippet = content.substring(0, 300);

        // Filename exact/partial match
        if (docName.includes(lowercaseQuery)) {
          rawScore += 45;
        }

        // Check matched terms ratio
        let matchedTermsCount = 0;
        let bestIndex = -1;

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

        // Term ratio match bonus
        if (queryTerms.length > 0) {
          const ratio = matchedTermsCount / queryTerms.length;
          rawScore += Math.round(ratio * 35);
        }

        // Bound percentage score cleanly between 10% and 98%
        let percentMatch = 0;
        if (rawScore > 0) {
          percentMatch = Math.min(98, Math.max(25, Math.round(rawScore)));
        }

        // Pull snippet centered around matching query term
        if (bestIndex !== -1) {
          const start = Math.max(0, bestIndex - 60);
          const end = Math.min(content.length, bestIndex + 240);
          snippet = (start > 0 ? "..." : "") + content.substring(start, end).trim() + (end < content.length ? "..." : "");
        }

        return {
          filename: doc.filename,
          title: doc.title,
          score: percentMatch,
          snippet,
          source: "Global Library (Supabase)"
        };
      })
      .filter(m => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return NextResponse.json({ success: true, matches, method: "semantic_scanner" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Search failed." }, { status: 500 });
  }
}
