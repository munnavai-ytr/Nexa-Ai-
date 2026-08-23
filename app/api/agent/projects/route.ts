import { NextRequest, NextResponse } from "next/server";
import { getSupabase, SUPABASE_SQL_SCHEMA } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ success: true, useLocalFallback: true, projects: [] });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (projectId) {
      // Get single project files, secrets, and chat logs
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

        // Fetch messages if separate table exists or use JSONB
        let messages = project.messages || [];
        try {
          const { data: msgRows, error: msgErr } = await supabase
            .from("agent_messages")
            .select("*")
            .eq("project_id", projectId)
            .order("created_at", { ascending: true });

          if (!msgErr && msgRows && msgRows.length > 0) {
            messages = msgRows.map((m: any) => ({
              id: m.id,
              role: m.role,
              content: m.content,
            }));
          }
        } catch {
          // fallback to project.messages JSONB
        }

        return NextResponse.json({
          success: true,
          project: {
            ...project,
            messages,
          },
          files: files || [],
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
          sql: SUPABASE_SQL_SCHEMA,
        });
      }

      return NextResponse.json({ success: true, projects: projects || [] });
    } catch {
      return NextResponse.json({
        success: true,
        useLocalFallback: true,
        projects: [],
        sql: SUPABASE_SQL_SCHEMA,
      });
    }
  } catch (err: any) {
    return NextResponse.json({
      success: true,
      useLocalFallback: true,
      projects: [],
      error: err?.message || "Fallback to local storage",
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await req.json();
    const { projectId: customProjectId, name, secrets, files, messages, user_id = "default_user" } = body;

    const projectId = customProjectId || "proj-" + Math.random().toString(36).substring(2, 9);

    if (!supabase) {
      return NextResponse.json({ success: true, useLocalFallback: true, projectId });
    }

    try {
      const now = new Date().toISOString();
      const updateData: any = {
        id: projectId,
        user_id,
        name: name || "Untitled Project",
        updated_at: now,
      };

      if (secrets !== undefined) {
        updateData.secrets = secrets;
      }
      if (messages !== undefined && Array.isArray(messages)) {
        updateData.messages = messages;
      }

      const { error } = await supabase
        .from("agent_projects")
        .upsert(updateData);

      if (error) {
        console.warn("Supabase upsert agent_projects error:", error.message);
        return NextResponse.json({ success: true, useLocalFallback: true, projectId, error: error.message });
      }

      // Upsert files
      if (files && Array.isArray(files)) {
        for (const file of files) {
          if (file && file.file_path) {
            await supabase
              .from("agent_files")
              .upsert({
                project_id: projectId,
                file_path: file.file_path,
                content: file.content || "",
                updated_at: now,
              });
          }
        }
      }

      // Upsert messages if provided
      if (messages && Array.isArray(messages)) {
        try {
          for (let i = 0; i < messages.length; i++) {
            const m = messages[i];
            if (m && m.content) {
              const msgId = m.id || `${projectId}-msg-${i}`;
              await supabase
                .from("agent_messages")
                .upsert({
                  id: msgId,
                  project_id: projectId,
                  role: m.role || "user",
                  content: m.content,
                  created_at: now,
                });
            }
          }
        } catch (msgErr) {
          console.warn("Notice: agent_messages table sync skipped", msgErr);
        }
      }

      return NextResponse.json({ success: true, projectId });
    } catch (dbErr: any) {
      console.warn("Supabase project remote save error:", dbErr?.message);
      return NextResponse.json({ success: true, useLocalFallback: true, projectId });
    }
  } catch (err: any) {
    return NextResponse.json({ success: true, useLocalFallback: true, error: err?.message });
  }
}
