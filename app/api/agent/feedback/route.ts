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

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ success: true, useLocalFallback: true, items: [] });
    }

    const { searchParams } = new URL(req.url);
    const errorQuery = searchParams.get("error");

    try {
      let queryBuilder = supabase.from("agent_corrections").select("*");
      if (errorQuery) {
        queryBuilder = queryBuilder.ilike("error_message", `%${errorQuery}%`);
      }

      const { data, error } = await queryBuilder.limit(10);
      if (error) {
        return NextResponse.json({ success: true, useLocalFallback: true, items: [] });
      }

      return NextResponse.json({ success: true, items: data || [] });
    } catch {
      return NextResponse.json({ success: true, useLocalFallback: true, items: [] });
    }
  } catch (err: any) {
    return NextResponse.json({ success: true, useLocalFallback: true, items: [], error: err?.message });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await req.json();
    const { errorMessage, fileContext, resolution } = body;

    if (!errorMessage) {
      return NextResponse.json({ success: false, error: "errorMessage is required" }, { status: 400 });
    }

    if (!supabase) {
      return NextResponse.json({ success: true, useLocalFallback: true });
    }

    try {
      const { error } = await supabase
        .from("agent_corrections")
        .insert([
          {
            id: `corr-${Math.random().toString(36).substring(2, 9)}`,
            error_message: errorMessage,
            file_context: fileContext || "",
            resolution: resolution || "",
            created_at: new Date().toISOString()
          }
        ]);

      if (error) {
        return NextResponse.json({
          success: true,
          useLocalFallback: true,
          sql: `CREATE TABLE IF NOT EXISTS agent_corrections (
  id TEXT PRIMARY KEY,
  error_message TEXT NOT NULL,
  file_context TEXT,
  resolution TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);`
        });
      }

      return NextResponse.json({ success: true });
    } catch {
      return NextResponse.json({ success: true, useLocalFallback: true });
    }
  } catch (err: any) {
    return NextResponse.json({ success: true, useLocalFallback: true, error: err?.message });
  }
}
