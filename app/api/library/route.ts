import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getKnowledgeItems, addKnowledgeItem } from "@/lib/knowledgeStore";

let supabaseClient: any = null;

function getSupabase() {
  if (supabaseClient) return supabaseClient;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase configuration is missing.");
  }
  supabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return supabaseClient;
}

export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("global_library")
      .select("*")
      .order("uploaded_at", { ascending: false });

    if (error) {
      if (error.code === "P0001" || error.message.includes("does not exist") || error.code === "42P01") {
        const localItems = getKnowledgeItems().map(item => ({
          id: item.id,
          file_name: item.filename,
          file_hash: crypto.createHash("sha256").update(item.content).digest("hex"),
          content: item.content,
          tags: item.category,
          uploaded_at: item.dateAdded
        }));
        return NextResponse.json({
          status: "needs_table",
          message: "The 'global_library' table does not exist in your Supabase database yet.",
          sql: `CREATE TABLE global_library (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT,
  uploaded_at TEXT NOT NULL
);`,
          items: localItems.map(i => ({
            id: i.id,
            filename: i.file_name,
            category: i.tags,
            dateAdded: i.uploaded_at,
            usageCount: 1,
            content: i.content
          }))
        });
      }
      throw error;
    }

    const items = (data || []).map((row: any) => ({
      id: row.id,
      filename: row.file_name,
      category: row.tags || "General Snippet",
      dateAdded: row.uploaded_at ? new Date(row.uploaded_at).toLocaleDateString() : new Date().toLocaleDateString(),
      usageCount: 1,
      content: row.content
    }));

    return NextResponse.json({ success: true, items });
  } catch (err: any) {
    console.warn("Library list warning:", err.message || err);
    const localItems = getKnowledgeItems().map(item => ({
      id: item.id,
      filename: item.filename,
      category: item.category,
      dateAdded: item.dateAdded,
      usageCount: item.usageCount,
      content: item.content
    }));
    return NextResponse.json({ success: true, items: localItems, fallback: true });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, filename, category, content } = body;

    if (action === "add_snippet") {
      if (!filename || !content) {
        return NextResponse.json({ success: false, error: "Filename and content are required." }, { status: 400 });
      }

      const safeFilename = filename.replace(/[^a-zA-Z0-9_\-\.]/g, "_").endsWith(".txt") 
        ? filename.replace(/[^a-zA-Z0-9_\-\.]/g, "_") 
        : `${filename.replace(/[^a-zA-Z0-9_\-\.]/g, "_")}.txt`;

      const fileHash = crypto.createHash("sha256").update(content).digest("hex");

      try {
        const supabase = getSupabase();
        
        // Check for duplicate by file_name or file_hash in Supabase global_library
        const { data: existing, error: checkError } = await supabase
          .from("global_library")
          .select("id, file_name, file_hash")
          .or(`file_name.eq.${safeFilename},file_hash.eq.${fileHash}`);

        if (checkError && (checkError.code === "P0001" || checkError.message.includes("does not exist") || checkError.code === "42P01")) {
          // Table doesn't exist yet, check local store
          const localItems = getKnowledgeItems();
          const isDuplicate = localItems.some(i => i.filename === safeFilename || crypto.createHash("sha256").update(i.content).digest("hex") === fileHash);
          if (isDuplicate) {
            return NextResponse.json({
              success: false,
              duplicate: true,
              error: "This file has already been uploaded to the global library."
            }, { status: 400 });
          }

          addKnowledgeItem({
            id: `lib-${Math.random().toString(36).substring(2, 9)}`,
            filename: safeFilename,
            category: category || "General Snippet",
            dateAdded: new Date().toLocaleDateString(),
            usageCount: 0,
            content: content
          });

          return NextResponse.json({
            status: "needs_table",
            message: "The 'global_library' table does not exist. Saved to local memory.",
            sql: `CREATE TABLE global_library (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT,
  uploaded_at TEXT NOT NULL
);`,
            success: true,
            filename: safeFilename
          });
        }

        if (existing && existing.length > 0) {
          return NextResponse.json({
            success: false,
            duplicate: true,
            error: "This file has already been uploaded to the global library."
          }, { status: 400 });
        }

        // Insert new record into global_library
        const newRecord = {
          id: `lib-${crypto.randomUUID()}`,
          file_name: safeFilename,
          file_hash: fileHash,
          content: content,
          tags: category || "General Snippet",
          uploaded_at: new Date().toISOString()
        };

        const { error: insertError } = await supabase
          .from("global_library")
          .insert([newRecord]);

        if (insertError) {
          throw insertError;
        }

        return NextResponse.json({ success: true, filename: safeFilename });
      } catch (dbErr: any) {
        console.warn("Supabase library insert fallback:", dbErr.message || dbErr);
        // Fallback check on local items
        const localItems = getKnowledgeItems();
        const isDuplicate = localItems.some(i => i.filename === safeFilename || crypto.createHash("sha256").update(i.content).digest("hex") === fileHash);
        if (isDuplicate) {
          return NextResponse.json({
            success: false,
            duplicate: true,
            error: "This file has already been uploaded to the global library."
          }, { status: 400 });
        }

        addKnowledgeItem({
          id: `lib-${Math.random().toString(36).substring(2, 9)}`,
          filename: safeFilename,
          category: category || "General Snippet",
          dateAdded: new Date().toLocaleDateString(),
          usageCount: 0,
          content: content
        });

        return NextResponse.json({ success: true, filename: safeFilename });
      }
    }

    return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
  } catch (err: any) {
    console.warn("Library mutation error:", err.message || err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
