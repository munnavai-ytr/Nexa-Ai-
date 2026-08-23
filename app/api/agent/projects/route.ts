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

const SQL_INIT_SCHEMA = `CREATE TABLE IF NOT EXISTS agent_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  secrets JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_files (
  project_id TEXT REFERENCES agent_projects(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  content TEXT NOT NULL,
  PRIMARY KEY (project_id, file_path)
);`;

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ success: true, useLocalFallback: true, projects: [] });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (projectId) {
      // Get single project files and secrets
      try {
        const { data: project, error: pError } = await supabase
          .from("agent_projects")
          .select("*")
          .eq("id", projectId)
          .single();

        if (pError || !project) {
          return NextResponse.json({ success: true, useLocalFallback: true, project: null, files: [] });
        }

        const { data: files, error: fError } = await supabase
          .from("agent_files")
          .select("*")
          .eq("project_id", projectId);

        if (fError) {
          return NextResponse.json({ success: true, useLocalFallback: true, project, files: [] });
        }

        return NextResponse.json({
          success: true,
          project,
          files: files || []
        });
      } catch {
        return NextResponse.json({ success: true, useLocalFallback: true, project: null, files: [] });
      }
    }

    // List all projects (history)
    try {
      const { data: projects, error } = await supabase
        .from("agent_projects")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) {
        return NextResponse.json({
          success: true,
          useLocalFallback: true,
          projects: [],
          sql: SQL_INIT_SCHEMA
        });
      }

      return NextResponse.json({ success: true, projects: projects || [] });
    } catch {
      return NextResponse.json({
        success: true,
        useLocalFallback: true,
        projects: [],
        sql: SQL_INIT_SCHEMA
      });
    }
  } catch (err: any) {
    return NextResponse.json({
      success: true,
      useLocalFallback: true,
      projects: [],
      error: err?.message || "Fallback to local storage"
    });
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

    try {
      const { error } = await supabase
        .from("agent_projects")
        .upsert({
          id: projectId,
          name: name || "Untitled Project",
          secrets: secrets || {},
          updated_at: new Date().toISOString()
        });

      if (error) {
        return NextResponse.json({ success: true, useLocalFallback: true, projectId });
      }

      if (files && Array.isArray(files)) {
        for (const file of files) {
          await supabase
            .from("agent_files")
            .upsert({
              project_id: projectId,
              file_path: file.file_path,
              content: file.content
            });
        }
      }

      return NextResponse.json({ success: true, projectId });
    } catch {
      return NextResponse.json({ success: true, useLocalFallback: true, projectId });
    }
  } catch (err: any) {
    return NextResponse.json({ success: true, useLocalFallback: true, error: err?.message });
  }
}
