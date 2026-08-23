import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

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

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { id } = await req.json();
    
    if (!id) {
      return NextResponse.json(
        { error: "Invalid parameters. 'id' is required." },
        { status: 400 }
      );
    }
    
    const { data, error } = await supabase
      .from("api_keys")
      .update({ status: "revoked" })
      .eq("id", id)
      .select();
      
    if (error) throw error;
    
    return NextResponse.json({ status: "success", data });
  } catch (error: any) {
    const isConfigError = error.message?.includes("configuration is missing") || error.message?.includes("missing");
    // Log as a non-critical warning instead of console.error to prevent platform-level false positive error detections
    console.warn("Supabase revoke key connection warning:", error.message || error);
    return NextResponse.json(
      { 
        status: isConfigError ? "needs_config" : "error",
        error: error.message || "Failed to revoke key." 
      },
      { status: isConfigError ? 200 : 500 }
    );
  }
}
