import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getKnowledgeItems, addKnowledgeItem } from "@/lib/knowledgeStore";
import { getSupabase, SUPABASE_SQL_SCHEMA } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      const localItems = getKnowledgeItems().map(item => ({
        id: item.id,
        title: item.filename,
        filename: item.filename,
        category: item.category,
        file_type: "text/plain",
        dateAdded: item.dateAdded,
        usageCount: item.usageCount,
        content: item.content
      }));
      return NextResponse.json({ success: true, items: localItems, status: "local" });
    }

    try {
      const { data, error } = await supabase
        .from("global_library")
        .select("*")
        .order("uploaded_at", { ascending: false });

      if (error) {
        const isTableError = error.code === "P0001" || error.message?.includes("does not exist") || error.code === "42P01";
        const localItems = getKnowledgeItems().map(item => ({
          id: item.id,
          title: item.filename,
          filename: item.filename,
          category: item.category,
          file_type: "text/plain",
          dateAdded: item.dateAdded,
          usageCount: 1,
          content: item.content
        }));

        if (isTableError) {
          return NextResponse.json({
            status: "needs_table",
            message: "The 'global_library' table does not exist in your Supabase database yet.",
            sql: SUPABASE_SQL_SCHEMA,
            items: localItems
          });
        }

        return NextResponse.json({ success: true, items: localItems, fallback: true });
      }

      const items = (data || []).map((row: any) => ({
        id: row.id || `lib-${Math.random().toString(36).substring(2, 9)}`,
        title: row.title || row.file_name || "Document",
        filename: row.file_name || row.title || "document.txt",
        file_type: row.file_type || "text/plain",
        category: row.tags || "General Snippet",
        dateAdded: row.uploaded_at ? new Date(row.uploaded_at).toLocaleDateString() : new Date().toLocaleDateString(),
        usageCount: 1,
        content: row.content
      }));

      return NextResponse.json({ success: true, items });
    } catch {
      const localItems = getKnowledgeItems().map(item => ({
        id: item.id,
        title: item.filename,
        filename: item.filename,
        category: item.category,
        file_type: "text/plain",
        dateAdded: item.dateAdded,
        usageCount: item.usageCount,
        content: item.content
      }));
      return NextResponse.json({ success: true, items: localItems, fallback: true });
    }
  } catch {
    const localItems = getKnowledgeItems().map(item => ({
      id: item.id,
      title: item.filename,
      filename: item.filename,
      category: item.category,
      file_type: "text/plain",
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
    const { action, filename, title, category, content, file_type } = body;

    const docTitle = title || filename || "Untitled Document";
    const docFilename = filename || title || "document.txt";
    const docCategory = category || "General Snippet";
    const docFileType = file_type || (docFilename.endsWith(".json") ? "application/json" : docFilename.endsWith(".md") ? "text/markdown" : "text/plain");

    if (action === "add_snippet" || !action) {
      if (!content || !content.trim()) {
        return NextResponse.json({ success: false, error: "Content is required." }, { status: 400 });
      }

      const safeFilename = docFilename.replace(/[^a-zA-Z0-9_\-\.]/g, "_");
      const fileHash = crypto.createHash("sha256").update(content).digest("hex");

      const supabase = getSupabase();
      if (!supabase) {
        // Safe local storage fallback
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
          category: docCategory,
          dateAdded: new Date().toLocaleDateString(),
          usageCount: 0,
          content: content
        });

        return NextResponse.json({ success: true, filename: safeFilename, title: docTitle });
      }

      try {
        // Check for duplicate by file_name or file_hash or title in Supabase global_library
        const { data: existing, error: checkError } = await supabase
          .from("global_library")
          .select("id, file_name, file_hash, title")
          .or(`file_name.eq.${safeFilename},file_hash.eq.${fileHash},title.eq.${docTitle}`);

        if (checkError && (checkError.code === "P0001" || checkError.message?.includes("does not exist") || checkError.code === "42P01")) {
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
            category: docCategory,
            dateAdded: new Date().toLocaleDateString(),
            usageCount: 0,
            content: content
          });

          return NextResponse.json({
            status: "needs_table",
            message: "The 'global_library' table does not exist. Saved to local memory.",
            sql: SUPABASE_SQL_SCHEMA,
            success: true,
            filename: safeFilename,
            title: docTitle
          });
        }

        if (existing && existing.length > 0) {
          return NextResponse.json({
            success: false,
            duplicate: true,
            error: "This file has already been uploaded to the global library."
          }, { status: 400 });
        }

        // Insert new record into global_library: { title, content, file_type }
        const newRecord = {
          id: `lib-${crypto.randomUUID()}`,
          title: docTitle,
          file_name: safeFilename,
          file_hash: fileHash,
          content: content,
          file_type: docFileType,
          tags: docCategory,
          uploaded_at: new Date().toISOString()
        };

        const { error: insertError } = await supabase
          .from("global_library")
          .insert([newRecord]);

        if (insertError) {
          // If inserting with extra columns failed, try minimalist columns: { title, content, file_type }
          const minimalRecord = {
            id: `lib-${crypto.randomUUID()}`,
            title: docTitle,
            content: content,
            file_type: docFileType
          };
          const { error: minInsertError } = await supabase
            .from("global_library")
            .insert([minimalRecord]);

          if (minInsertError) {
            throw minInsertError;
          }
        }

        return NextResponse.json({ success: true, filename: safeFilename, title: docTitle, file_type: docFileType });
      } catch (dbErr: any) {
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
          category: docCategory,
          dateAdded: new Date().toLocaleDateString(),
          usageCount: 0,
          content: content
        });

        return NextResponse.json({ success: true, filename: safeFilename, title: docTitle, warning: dbErr?.message });
      }
    }

    return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Failed to process library request." }, { status: 500 });
  }
}
