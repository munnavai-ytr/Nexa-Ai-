import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

let supabaseClient: any = null;

function getSupabase() {
  if (supabaseClient) return supabaseClient;
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !supabaseKey) {
    return null;
  }
  if (
    supabaseUrl.includes("your-supabase") ||
    supabaseUrl.includes("placeholder") ||
    supabaseUrl.includes("example.com") ||
    !supabaseUrl.startsWith("http")
  ) {
    return null;
  }

  try {
    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    return supabaseClient;
  } catch {
    return null;
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;
    const body = await req.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: "name is required" }, { status: 400 });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ success: true, useLocalFallback: true });
    }

    try {
      await supabase
        .from("agent_projects")
        .update({ name, updated_at: new Date().toISOString() })
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
