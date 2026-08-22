import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

let supabaseClient: any = null;

function getSupabase() {
  if (supabaseClient) return supabaseClient;
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase configuration is missing.");
  }
  
  supabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });
  return supabaseClient;
}

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
    
    // Use select instead of cache to ensure fresh data
    const { data, error } = await supabase
      .from("api_keys")
      .select("*")
      .order("created", { ascending: false });
      
    if (error) {
      if (error.code === "P0001" || error.message.includes("does not exist")) {
        return NextResponse.json({
          status: "needs_table",
          message: "The 'api_keys' table does not exist in your Supabase database yet.",
          sql: `CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  key TEXT NOT NULL,
  created TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
);`
        }, { status: 200 });
      }
      throw error;
    }
    
    // Set headers to prevent caching
    const response = NextResponse.json({ status: "success", data });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (error: any) {
    const isConfigError = error.message?.includes("configuration is missing") || error.message?.includes("missing");
    console.warn("Supabase GET keys connection warning:", error.message || error);
    return NextResponse.json(
      { 
        status: isConfigError ? "needs_config" : "error",
        error: error.message || "Failed to fetch keys from database." 
      },
      { status: isConfigError ? 200 : 500 }
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
    
    const { data, error } = await supabase
      .from("api_keys")
      .insert([newKey])
      .select();
      
    if (error) {
      if (error.message.includes("does not exist")) {
        return NextResponse.json({
          status: "needs_table",
          message: "The 'api_keys' table does not exist in your Supabase database yet.",
          sql: `CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  key TEXT NOT NULL,
  created TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
);`
        }, { status: 200 });
      }
      throw error;
    }
    
    return NextResponse.json({ status: "success", data: data[0] });
  } catch (error: any) {
    const isConfigError = error.message?.includes("configuration is missing") || error.message?.includes("missing");
    console.warn("Supabase POST key connection warning:", error.message || error);
    return NextResponse.json(
      { 
        status: isConfigError ? "needs_config" : "error",
        error: error.message || "Failed to save key to database." 
      },
      { status: isConfigError ? 200 : 500 }
    );
  }
}

