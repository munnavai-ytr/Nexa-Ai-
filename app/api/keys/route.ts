import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSupabase, SUPABASE_SQL_SCHEMA } from "@/lib/supabase";

/**
 * Generates a cryptographically secure, unique API key.
 * Format: nexa_live_[random_hex]
 */
function generateSecureApiKey(): string {
  const bytes = crypto.randomBytes(32);
  return `nexa_live_${bytes.toString('hex')}`;
}

export async function GET() {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({
        status: "needs_config",
        message: "Supabase configuration is not set. Using local mode.",
        data: []
      }, { status: 200 });
    }
    
    // Use select instead of cache to ensure fresh data
    const { data, error } = await supabase
      .from("api_keys")
      .select("*")
      .order("created", { ascending: false });
      
    if (error) {
      return NextResponse.json({
        status: "needs_table",
        message: "The 'api_keys' table does not exist in your Supabase database yet.",
        sql: SUPABASE_SQL_SCHEMA
      }, { status: 200 });
    }
    
    // Set headers to prevent caching
    const response = NextResponse.json({ status: "success", data: data || [] });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (error: any) {
    const msg = error?.message || String(error);
    const isTableError = msg.includes("api_keys") || msg.includes("does not exist") || msg.includes("schema cache") || msg.includes("Could not find");
    const isConfigError = msg.includes("configuration is missing") || msg.includes("missing") || msg.includes("fetch failed");
    
    if (isTableError) {
      return NextResponse.json({
        status: "needs_table",
        message: "The 'api_keys' table does not exist in your Supabase database yet.",
        sql: SUPABASE_SQL_SCHEMA
      }, { status: 200 });
    }
    
    return NextResponse.json(
      { 
        status: isConfigError ? "needs_config" : "error",
        error: msg,
        data: []
      },
      { status: 200 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await req.json();
    const { name } = body;
    
    if (!name) {
      return NextResponse.json(
        { error: "Invalid parameters. 'name' is required." },
        { status: 400 }
      );
    }
    
    // Generate absolute unique key and ID on the server side
    const uniqueId = crypto.randomUUID();
    const secureKey = generateSecureApiKey();
    
    const newKey = {
      id: uniqueId,
      name,
      key: secureKey,
      created: new Date().toLocaleDateString(),
      status: "active"
    };

    if (!supabase) {
      return NextResponse.json({
        status: "needs_config",
        message: "Supabase is not configured.",
        data: newKey
      }, { status: 200 });
    }
    
    const { data, error } = await supabase
      .from("api_keys")
      .insert([newKey])
      .select();
      
    if (error) {
      if (error.message?.includes("does not exist") || error.message?.includes("schema cache") || error.message?.includes("Could not find")) {
        return NextResponse.json({
          status: "needs_table",
          message: "The 'api_keys' table does not exist in your Supabase database yet.",
          sql: SUPABASE_SQL_SCHEMA
        }, { status: 200 });
      }
      throw error;
    }
    
    return NextResponse.json({ status: "success", data: data?.[0] || newKey });
  } catch (error: any) {
    const msg = error?.message || String(error);
    const isTableError = msg.includes("api_keys") || msg.includes("does not exist") || msg.includes("schema cache") || msg.includes("Could not find");
    const isConfigError = msg.includes("configuration is missing") || msg.includes("missing") || msg.includes("fetch failed");
    
    if (isTableError) {
      return NextResponse.json({
        status: "needs_table",
        message: "The 'api_keys' table does not exist in your Supabase database yet.",
        sql: SUPABASE_SQL_SCHEMA
      }, { status: 200 });
    }
    
    return NextResponse.json(
      { 
        status: isConfigError ? "needs_config" : "error",
        error: msg 
      },
      { status: isConfigError ? 200 : 500 }
    );
  }
}

