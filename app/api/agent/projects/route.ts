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

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ success: true, useLocalFallback: true });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (projectId) {
      // Get single project files and secrets
      const { data: project, error: pError } = await supabase
        .from("agent_projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (pError) {
        if (pError.code === "P0001" || pError.message.includes("does not exist") || pError.code === "42P01") {
          return NextResponse.json({ success: true, useLocalFallback: true });
        }
        throw pError;
      }

      const { data: files, error: fError } = await supabase
        .from("agent_files")
        .select("*")
        .eq("project_id", projectId);

      if (fError) throw fError;

      return NextResponse.json({
        success: true,
        project,
        files: files || []
      });
    }

    // List all projects (history)
    const { data: projects, error } = await supabase
      .from("agent_projects")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      if (error.code === "P0001" || error.message.includes("does not exist") || error.code === "42P01") {
        return NextResponse.json({
          success: true,
          useLocalFallback: true,
          sql: `CREATE TABLE agent_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  secrets JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE agent_files (
  project_id TEXT REFERENCES agent_projects(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  content TEXT NOT NULL,
  PRIMARY KEY (project_id, file_path)
);`
        });
      }
      throw error;
    }

    return NextResponse.json({ success: true, projects: projects || [] });
  } catch (err: any) {
    console.error("Agent projects GET error:", err);
    return NextResponse.json({ success: true, useLocalFallback: true, error: err.message });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await req.json();
    const { projectId: customProjectId, name, secrets, files } = body;

    // Generate a secure project id
    const projectId = customProjectId || "proj-" + Math.random().toString(36).substring(2, 9);

    if (!supabase) {
      return NextResponse.json({ success: true, useLocalFallback: true, projectId });
    }

    const { error } = await supabase
      .from("agent_projects")
      .upsert({
        id: projectId,
        name: name || "Untitled Project",
        secrets: secrets || {},
        updated_at: new Date().toISOString()
      });

    if (error) {
      if (error.code === "P0001" || error.message.includes("does not exist") || error.code === "42P01") {
        return NextResponse.json({ success: true, useLocalFallback: true, projectId });
      }
      throw error;
    }

    if (files && Array.isArray(files)) {
      // Upsert files
      for (const file of files) {
        const { error: fileErr } = await supabase
          .from("agent_files")
          .upsert({
            project_id: projectId,
            file_path: file.file_path,
            content: file.content
          });
        if (fileErr) throw fileErr;
      }
    }

    return NextResponse.json({ success: true, projectId });
  } catch (err: any) {
    console.error("Agent projects POST error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
