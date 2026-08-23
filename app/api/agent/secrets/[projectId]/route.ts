import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

let supabaseClient: any = null;

function getSupabase() {
  if (supabaseClient) return supabaseClient;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return null;
  }
  supabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return supabaseClient;
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

    const { data, error } = await supabase
      .from("agent_projects")
      .select("secrets")
      .eq("id", projectId)
      .single();

    if (error) {
      return NextResponse.json({ success: true, useLocalFallback: true, secrets: [] });
    }

    const secretsMap = data?.secrets || {};
    // Return key names only, never values
    const keyNames = Object.keys(secretsMap);

    return NextResponse.json({ success: true, secrets: keyNames });
  } catch (err: any) {
    console.error("GET secrets error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
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

    // Select existing secrets
    const { data, error: fetchErr } = await supabase
      .from("agent_projects")
      .select("secrets")
      .eq("id", projectId)
      .single();

    if (fetchErr) throw fetchErr;

    const secretsMap = data?.secrets || {};
    secretsMap[key] = value;

    const { error: updateErr } = await supabase
      .from("agent_projects")
      .update({ secrets: secretsMap, updated_at: new Date().toISOString() })
      .eq("id", projectId);

    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("POST secret error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;
    const { searchParams } = new URL(req.url);
    
    // Support key from either body or query parameter for extra flexibility
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

    // Select existing secrets
    const { data, error: fetchErr } = await supabase
      .from("agent_projects")
      .select("secrets")
      .eq("id", projectId)
      .single();

    if (fetchErr) throw fetchErr;

    const secretsMap = data?.secrets || {};
    delete secretsMap[key];

    const { error: updateErr } = await supabase
      .from("agent_projects")
      .update({ secrets: secretsMap, updated_at: new Date().toISOString() })
      .eq("id", projectId);

    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE secret error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
