import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const body = await req.json();
    const { title } = body;

    if (!title || typeof title !== "string") {
      return NextResponse.json({ success: false, error: "Title is required" }, { status: 400 });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ success: true, useLocalFallback: true });
    }

    try {
      const { error } = await supabase
        .from("chat_sessions")
        .update({
          title: title.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      if (error) {
        console.warn("Supabase rename chat error:", error.message);
        return NextResponse.json({ success: true, useLocalFallback: true, error: error.message });
      }

      return NextResponse.json({ success: true });
    } catch (err: any) {
      return NextResponse.json({ success: true, useLocalFallback: true, error: err?.message });
    }
  } catch (err: any) {
    return NextResponse.json({ success: true, useLocalFallback: true, error: err?.message });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const supabase = getSupabase();

    if (!supabase) {
      return NextResponse.json({ success: true, useLocalFallback: true });
    }

    try {
      // Delete associated messages first if foreign key cascade not set
      try {
        await supabase
          .from("chat_messages")
          .delete()
          .eq("session_id", sessionId);
      } catch {
        // ignore
      }

      const { error } = await supabase
        .from("chat_sessions")
        .delete()
        .eq("id", sessionId);

      if (error) {
        console.warn("Supabase delete chat error:", error.message);
        return NextResponse.json({ success: true, useLocalFallback: true, error: error.message });
      }

      return NextResponse.json({ success: true });
    } catch (err: any) {
      return NextResponse.json({ success: true, useLocalFallback: true, error: err?.message });
    }
  } catch (err: any) {
    return NextResponse.json({ success: true, useLocalFallback: true, error: err?.message });
  }
}
