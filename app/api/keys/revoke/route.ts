import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

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

    if (!supabase) {
      return NextResponse.json({ status: "success", data: [{ id, status: "revoked" }] });
    }
    
    const { data, error } = await supabase
      .from("api_keys")
      .update({ status: "revoked" })
      .eq("id", id)
      .select();
      
    if (error) throw error;
    
    return NextResponse.json({ status: "success", data });
  } catch (error: any) {
    const isConfigError = error?.message?.includes("configuration is missing") || error?.message?.includes("missing") || error?.message?.includes("fetch failed");
    return NextResponse.json(
      { 
        status: isConfigError ? "needs_config" : "error",
        error: error?.message || "Failed to revoke key." 
      },
      { status: isConfigError ? 200 : 500 }
    );
  }
}
