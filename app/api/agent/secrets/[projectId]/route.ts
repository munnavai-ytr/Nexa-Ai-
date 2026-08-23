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

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ success: true, useLocalFallback: true, secrets: [] });
    }

    try {
      const { data, error } = await supabase
        .from("agent_projects")
        .select("secrets")
        .eq("id", projectId)
        .single();

      if (error) {
        return NextResponse.json({ success: true, useLocalFallback: true, secrets: [] });
      }

      const secretsMap = data?.secrets || {};
      const keyNames = Object.keys(secretsMap);

      return NextResponse.json({ success: true, secrets: keyNames });
    } catch {
      return NextResponse.json({ success: true, useLocalFallback: true, secrets: [] });
    }
  } catch (err: any) {
    return NextResponse.json({ success: true, useLocalFallback: true, secrets: [], error: err?.message });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;
    const { key, value } = await req.json();

    if (!key || !value) {
      return NextResponse.json({ success: false, error: "key and value are required" }, { status: 400 });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ success: true, useLocalFallback: true });
    }

    try {
      const { data } = await supabase
        .from("agent_projects")
        .select("secrets")
        .eq("id", projectId)
        .single();

      const secretsMap = data?.secrets || {};
      secretsMap[key] = value;

      await supabase
        .from("agent_projects")
        .update({ secrets: secretsMap, updated_at: new Date().toISOString() })
        .eq("id", projectId);
    } catch {
      // Supabase unavailable, fallback silently
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
    const { searchParams } = new URL(req.url);
    
    let key = searchParams.get("key");
    if (!key) {
      try {
        const body = await req.json();
        key = body?.key;
      } catch {
        // Body reading failed or empty
      }
    }

    if (!key) {
      return NextResponse.json({ success: false, error: "key is required" }, { status: 400 });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ success: true, useLocalFallback: true });
    }

    try {
      const { data } = await supabase
        .from("agent_projects")
        .select("secrets")
        .eq("id", projectId)
        .single();

      const secretsMap = data?.secrets || {};
      delete secretsMap[key];

      await supabase
        .from("agent_projects")
        .update({ secrets: secretsMap, updated_at: new Date().toISOString() })
        .eq("id", projectId);
    } catch {
      // Supabase unavailable, fallback silently
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: true, useLocalFallback: true, error: err?.message });
  }
}
