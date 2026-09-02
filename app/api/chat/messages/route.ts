import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import crypto from "crypto";

// Helper to validate UUID
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// GET: Fetch all messages from chat_messages for the session ordered by created_at ASC
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ success: false, error: "sessionId is required" }, { status: 400 });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({
        success: true,
        useLocalFallback: true,
        messages: [],
        status: "needs_config",
      });
    }

    const { data: rows, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("[Supabase] Failed to fetch chat_messages:", error.message);
      return NextResponse.json({
        success: true,
        useLocalFallback: true,
        messages: [],
        error: error.message,
      });
    }

    // Format rows into consistent client representation
    const formattedMessages = (rows || []).map((row: any) => ({
      id: row.id,
      role: row.role === "model" ? "assistant" : "user", // Support both for UI compatibility
      dbRole: row.role, // 'user' or 'model'
      content: row.content || "",
      timestamp: row.created_at
        ? new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "",
      created_at: row.created_at,
    }));

    return NextResponse.json({
      success: true,
      messages: formattedMessages,
    });
  } catch (err: any) {
    console.error("[Supabase] chat_messages GET exception:", err);
    return NextResponse.json({
      success: true,
      useLocalFallback: true,
      messages: [],
      error: err?.message || "Unknown error",
    });
  }
}

// POST: Insert a single message (user or model) into chat_messages
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, role, content, id } = body;

    if (!sessionId || !content) {
      return NextResponse.json(
        { success: false, error: "sessionId and content are required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({
        success: true,
        useLocalFallback: true,
        id: id || crypto.randomUUID(),
      });
    }

    // Ensure role matches schema: 'user' or 'model'
    const normalizedRole = role === "assistant" || role === "model" ? "model" : "user";
    const messageId = id && isValidUUID(id) ? id : crypto.randomUUID();
    const createdAt = new Date().toISOString();

    const insertPayload = {
      id: messageId,
      session_id: sessionId,
      role: normalizedRole,
      content: content,
      created_at: createdAt,
    };

    const { data, error } = await supabase
      .from("chat_messages")
      .upsert(insertPayload)
      .select()
      .single();

    if (error) {
      console.warn("[Supabase] Failed to insert into chat_messages:", error.message);
      return NextResponse.json({
        success: true,
        useLocalFallback: true,
        id: messageId,
        error: error.message,
      });
    }

    return NextResponse.json({
      success: true,
      message: data || insertPayload,
    });
  } catch (err: any) {
    console.error("[Supabase] chat_messages POST exception:", err);
    return NextResponse.json({
      success: true,
      useLocalFallback: true,
      error: err?.message || "Unknown error",
    });
  }
}
