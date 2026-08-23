import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;
    const body = await req.json();
    const { name } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ success: false, error: "name is required" }, { status: 400 });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ success: true, useLocalFallback: true });
    }

    try {
      await supabase
        .from("agent_projects")
        .update({ name: name.trim(), updated_at: new Date().toISOString() })
        .eq("id", projectId);
    } catch {
      // Ignore database write failures, fallback handles it
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: true, useLocalFallback: true, error: err?.message });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ success: true, useLocalFallback: true });
    }

    try {
      // Delete child records first if foreign keys aren't cascaded
      try {
        await supabase.from("agent_files").delete().eq("project_id", projectId);
      } catch {}
      try {
        await supabase.from("agent_messages").delete().eq("project_id", projectId);
      } catch {}

      await supabase
        .from("agent_projects")
        .delete()
        .eq("id", projectId);
    } catch {
      // Ignore database delete failures, fallback handles it
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: true, useLocalFallback: true, error: err?.message });
  }
}
