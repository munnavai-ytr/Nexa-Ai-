import { NextRequest, NextResponse } from "next/server";
import { getSupabase, SUPABASE_SQL_SCHEMA } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({
        success: true,
        useLocalFallback: true,
        sessions: [],
        status: "needs_config",
      });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (sessionId) {
      try {
        const { data: session, error } = await supabase
          .from("chat_sessions")
          .select("*")
          .eq("id", sessionId)
          .single();

        if (error || !session) {
          return NextResponse.json({
            success: true,
            useLocalFallback: true,
            session: null,
          });
        }

        // Also fetch individual messages if chat_messages table is used
        let messages = session.messages || [];
        try {
          const { data: msgRows, error: msgErr } = await supabase
            .from("chat_messages")
            .select("*")
            .eq("session_id", sessionId)
            .order("created_at", { ascending: true });

          if (!msgErr && msgRows && msgRows.length > 0) {
            messages = msgRows.map((m: any) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              timestamp: m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "",
              sources: m.sources,
              sourceType: m.source_type,
            }));
          }
        } catch {
          // Fallback to session.messages JSONB
        }

        return NextResponse.json({
          success: true,
          session: {
            ...session,
            messages,
          },
        });
      } catch {
        return NextResponse.json({ success: true, useLocalFallback: true, session: null });
      }
    }

    // List all sessions
    try {
      const { data: sessions, error } = await supabase
        .from("chat_sessions")
        .select("id, user_id, title, created_at, updated_at, messages")
        .order("updated_at", { ascending: false });

      if (error) {
        return NextResponse.json({
          success: true,
          useLocalFallback: true,
          sessions: [],
          status: "needs_table",
          sql: SUPABASE_SQL_SCHEMA,
        });
      }

      return NextResponse.json({
        success: true,
        status: "connected",
        sessions: sessions || [],
      });
    } catch {
      return NextResponse.json({
        success: true,
        useLocalFallback: true,
        sessions: [],
        status: "needs_table",
        sql: SUPABASE_SQL_SCHEMA,
      });
    }
  } catch (err: any) {
    return NextResponse.json({
      success: true,
      useLocalFallback: true,
      sessions: [],
      error: err?.message,
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await req.json();
    const { id, title, messages, user_id = "default_user" } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Session ID is required" }, { status: 400 });
    }

    if (!supabase) {
      return NextResponse.json({ success: true, useLocalFallback: true, sessionId: id });
    }

    try {
      const now = new Date().toISOString();
      const sessionPayload = {
        id,
        user_id,
        title: title || "New Chat Session",
        messages: messages || [],
        updated_at: now,
      };

      const { error } = await supabase
        .from("chat_sessions")
        .upsert(sessionPayload);

      if (error) {
        console.warn("Supabase upsert chat_sessions error:", error.message);
        return NextResponse.json({ success: true, useLocalFallback: true, sessionId: id, error: error.message });
      }

      // Optionally sync messages into chat_messages table
      if (messages && Array.isArray(messages)) {
        try {
          for (const msg of messages) {
            if (msg && msg.id) {
              await supabase
                .from("chat_messages")
                .upsert({
                  id: msg.id,
                  session_id: id,
                  role: msg.role || "user",
                  content: msg.content || "",
                  sources: msg.sources || [],
                  source_type: msg.sourceType || null,
                  created_at: msg.timestamp ? new Date().toISOString() : now,
                });
            }
          }
        } catch (msgSyncErr) {
          console.warn("Notice: chat_messages table sync skipped", msgSyncErr);
        }
      }

      return NextResponse.json({ success: true, sessionId: id });
    } catch (dbErr: any) {
      console.warn("Supabase session save fallback triggered:", dbErr?.message);
      return NextResponse.json({ success: true, useLocalFallback: true, sessionId: id });
    }
  } catch (err: any) {
    return NextResponse.json({ success: true, useLocalFallback: true, error: err?.message });
  }
}
