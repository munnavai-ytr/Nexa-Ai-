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
        if (error.message.includes("chat_sessions") || error.message.includes("schema cache") || error.message.includes("does not exist")) {
          return NextResponse.json({ success: true, useLocalFallback: true, status: "needs_table" });
        }
        console.log("Notice: Supabase chat update skipped (database table missing):", error.message);
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
        if (error.message.includes("chat_sessions") || error.message.includes("schema cache") || error.message.includes("does not exist")) {
          return NextResponse.json({ success: true, useLocalFallback: true, status: "needs_table" });
        }
        console.log("Notice: Supabase chat delete skipped (database table missing):", error.message);
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
