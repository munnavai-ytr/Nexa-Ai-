"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { 
  Plus, 
  Folder, 
  ChevronRight, 
  User, 
  Trash2, 
  Edit3, 
  MoreVertical,
  Layers,
  Database,
  ExternalLink,
  MessageSquare
} from "lucide-react";

interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export default function AgentDashboard() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [usingSupabase, setUsingSupabase] = useState(false);
  const [sqlSchema, setSqlSchema] = useState<string | null>(null);

  // Load projects from either Supabase or LocalStorage
  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await fetch("/api/agent/projects");
        const data = await res.json();
        
        if (data.success && !data.useLocalFallback) {
          // Convert database fields if needed or load directly
          const formatted = (data.projects || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            createdAt: p.created_at || new Date().toISOString(),
            updatedAt: p.updated_at || new Date().toISOString()
          }));
          setProjects(formatted);
          setUsingSupabase(true);
        } else {
          // Fallback to LocalStorage
          const local = localStorage.getItem("nexa_agent_projects");
          if (local) {
            setProjects(JSON.parse(local));
          }
          if (data.sql) {
            setSqlSchema(data.sql);
          }
        }
      } catch (err) {
        console.warn("Failed to query API, using local storage", err);
        const local = localStorage.getItem("nexa_agent_projects");
        if (local) {
          setProjects(JSON.parse(local));
        }
      } finally {
        setLoading(false);
      }
    }
    loadProjects();
  }, []);

  const handleCreateProject = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim()) return;

    const initialFiles = {
      "package.json": JSON.stringify({
        name: "my-app",
        version: "1.0.0",
        dependencies: {
          "react": "^19.0.0",
          "react-dom": "^19.0.0"
        }
      }, null, 2),
      "App.tsx": `import React, { useState } from "react";\n\nexport default function App() {\n  return (\n    <div className="min-h-screen flex items-center justify-center bg-neutral-900 text-white font-sans p-6">\n      <div className="text-center space-y-4">\n        <h1 className="text-3xl font-bold tracking-tight">Welcome to Nexa Built App</h1>\n        <p className="text-neutral-400">Created dynamically via Play Nexa AI Workspace.</p>\n      </div>\n    </div>\n  );\n}`,
      "styles.css": "body {\n  margin: 0;\n  font-family: sans-serif;\n}"
    };

    let targetProjectId = "proj-" + Math.random().toString(36).substring(2, 9);

    if (usingSupabase) {
      try {
        const res = await fetch("/api/agent/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: prompt.trim().substring(0, 30) || "Untitled Application",
            files: Object.entries(initialFiles).map(([path, content]) => ({
              file_path: path,
              content
            }))
          })
        });
        const resData = await res.json();
        if (resData.success && resData.projectId) {
          targetProjectId = resData.projectId;
        }
      } catch (err) {
        console.error("Failed to save project to Supabase", err);
      }
    } else {
      // LocalStorage Sync
      const newProject: Project = {
        id: targetProjectId,
        name: prompt.trim().substring(0, 30) || "Untitled Application",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const updated = [newProject, ...projects];
      localStorage.setItem("nexa_agent_projects", JSON.stringify(updated));
      localStorage.setItem(`nexa_files_${targetProjectId}`, JSON.stringify(initialFiles));
    }

    // Save initial prompt to sessionStorage to pass to workspace
    sessionStorage.setItem(`nexa_initial_prompt_${targetProjectId}`, prompt.trim());
    router.push(`/agent/workspace/${targetProjectId}`);
  };

  const handleDeleteProject = async (id: string) => {
    if (usingSupabase) {
      try {
        await fetch(`/api/agent/projects/${id}`, {
          method: "DELETE"
        });
      } catch (err) {
        console.error("Supabase DELETE error:", err);
      }
    }

    const updated = projects.filter(p => p.id !== id);
    setProjects(updated);
    if (!usingSupabase) {
      localStorage.setItem("nexa_agent_projects", JSON.stringify(updated));
      localStorage.removeItem(`nexa_files_${id}`);
      localStorage.removeItem(`nexa_secrets_${id}`);
    }
    setActiveMenuId(null);
  };

  const handleRenameProject = async (id: string) => {
    if (!editName.trim()) return;

    const updated = projects.map(p => {
      if (p.id === id) {
        return { ...p, name: editName.trim(), updatedAt: new Date().toISOString() };
      }
      return p;
    });

    setProjects(updated);

    if (usingSupabase) {
      try {
        await fetch(`/api/agent/projects/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editName.trim()
          })
        });
      } catch (err) {
        console.error("Supabase PATCH error:", err);
      }
    } else {
      localStorage.setItem("nexa_agent_projects", JSON.stringify(updated));
    }

    setEditingId(null);
    setEditName("");
    setActiveMenuId(null);
  };

  const handleDeleteAccount = () => {
    if (confirm("Are you sure you want to delete your Play Nexa AI developer account? This action is permanent and will wipe all local caches.")) {
      localStorage.clear();
      setProjects([]);
      setIsProfileOpen(false);
      router.push("/agent");
    }
  };

  return (
    <div className="min-h-screen bg-[#0E1117] text-[#E6EDF3] flex flex-col font-sans">
      {/* Top Navigation / Play Nexa Branded Header */}
      <header className="border-b border-neutral-800 px-6 py-4 flex justify-between items-center bg-[#0B0D13]">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => router.push("/agent")}>
            <div className="h-8 w-8 bg-amber-600 rounded-lg flex items-center justify-center font-bold text-[#0E1117]">
              N
            </div>
            <span className="font-semibold tracking-tight text-lg text-neutral-100">Play Nexa AI</span>
            <span className="text-[10px] bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded-full uppercase tracking-wider font-mono font-bold">
              Agent Workspace
            </span>
          </div>

          <button
            id="agent-dashboard-ask-btn"
            onClick={() => router.push("/")}
            className="flex items-center space-x-1.5 bg-neutral-900 hover:bg-neutral-800 text-xs text-neutral-300 hover:text-white font-mono border border-neutral-800 hover:border-neutral-700 px-3 py-1.5 rounded-lg transition-all cursor-pointer shadow-xs ml-3"
            title="Return to Main Chat"
          >
            <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
            <span className="font-medium">Ask</span>
          </button>
        </div>

        <div className="relative">
          <button 
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center space-x-2 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-lg px-3.5 py-1.5 text-xs text-neutral-300 font-medium transition-all cursor-pointer"
          >
            <User className="w-3.5 h-3.5 text-neutral-400" />
            <span>Developer Account</span>
          </button>

          <AnimatePresence>
            {isProfileOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute right-0 mt-2 w-56 rounded-xl border border-neutral-800 bg-[#0B0D13] p-2 shadow-2xl z-50 text-xs"
              >
                <div className="px-3 py-2 border-b border-neutral-800/60 mb-1">
                  <p className="font-semibold text-neutral-200">Play Nexa Developer</p>
                  <p className="text-[10px] text-neutral-500 font-mono">drdarkfactshindi@gmail.com</p>
                </div>
                <button
                  onClick={handleDeleteAccount}
                  className="w-full text-left flex items-center space-x-2.5 px-3 py-2 rounded-lg text-red-400 hover:bg-neutral-900/60 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Account</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Main Content Dashboard */}
      <main className="flex-1 flex flex-col items-center justify-center max-w-4xl w-full mx-auto px-6 py-16">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12 space-y-3"
        >
          <div className="inline-flex items-center space-x-2 bg-neutral-900 border border-neutral-800 px-3 py-1 rounded-full text-xs text-amber-500 font-mono">
            <Layers className="w-3.5 h-3.5" />
            <span>Autonomous Code Generation Engine</span>
          </div>
          <h2 className="text-4xl font-bold tracking-tight text-neutral-100">
            Build applications autonomously with Play Nexa
          </h2>
          <p className="text-sm text-neutral-400 max-w-lg mx-auto">
            Design and generate complete modular workspaces dynamically. Specify your application goal to generate a full-bleed interactive preview instantly.
          </p>
        </motion.div>

        {/* Chatbox Entry Panel */}
        <div className="w-full max-w-2xl bg-[#0B0D13] border border-neutral-800 rounded-2xl p-4 shadow-xl mb-12">
          <form onSubmit={handleCreateProject} className="flex items-center space-x-3">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Build a real-time weather application with dark theme..."
              className="flex-1 bg-neutral-950 border border-neutral-800 focus:border-neutral-700 rounded-xl px-4 py-3.5 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none transition-all font-sans"
            />
            <button
              type="submit"
              disabled={!prompt.trim()}
              className="bg-amber-600 disabled:opacity-40 disabled:hover:bg-amber-600 hover:bg-amber-500 text-[#0E1117] h-[46px] px-5 rounded-xl font-semibold text-xs flex items-center space-x-2 transition-all shrink-0 cursor-pointer"
            >
              <span>Build App</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Database Connection Status Block */}
        {!usingSupabase && sqlSchema && (
          <div className="w-full max-w-2xl bg-neutral-900/40 border border-neutral-800 rounded-xl p-4 mb-10 text-xs text-neutral-400">
            <div className="flex items-center space-x-2 text-amber-500 font-medium mb-1.5">
              <Database className="w-3.5 h-3.5" />
              <span>Supabase Remote Database Connection</span>
            </div>
            <p className="mb-3">
              Application is running in browser local storage fallback mode because the matching table schemas were not detected in your remote Supabase instance. To enable durable persistence across different devices, run this SQL script in your Supabase SQL editor:
            </p>
            <pre className="bg-neutral-950 border border-neutral-800/80 p-3 rounded-lg overflow-x-auto text-[11px] text-neutral-300 font-mono leading-relaxed max-h-40 overflow-y-auto select-all">
              {sqlSchema}
            </pre>
          </div>
        )}

        {/* Projects History Section */}
        <div className="w-full max-w-2xl">
          <div className="flex items-center justify-between border-b border-neutral-800/60 pb-3 mb-4">
            <h3 className="text-sm font-semibold tracking-wide text-neutral-400 uppercase font-mono">
              Workspace History
            </h3>
            <span className="text-xs text-neutral-500 font-mono">
              {projects.length} Workspace Projects
            </span>
          </div>

          {loading ? (
            <div className="text-center py-12 text-sm text-neutral-500">
              Loading workspaces...
            </div>
          ) : projects.length === 0 ? (
            <div className="border border-dashed border-neutral-800/80 rounded-xl py-12 px-4 text-center text-sm text-neutral-500">
              No previous workspaces found. Create your first project above.
            </div>
          ) : (
            <div className="space-y-2.5">
              {projects.map((proj) => (
                <div 
                  key={proj.id}
                  className="bg-[#0B0D13] border border-neutral-800 hover:border-neutral-700 rounded-xl p-4 flex items-center justify-between transition-all group"
                >
                  <div className="flex items-center space-x-3.5 flex-1 min-w-0 cursor-pointer" onClick={() => router.push(`/agent/workspace/${proj.id}`)}>
                    <div className="h-9 w-9 bg-neutral-900 border border-neutral-800 group-hover:border-neutral-700 rounded-lg flex items-center justify-center text-amber-500 shrink-0">
                      <Folder className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {editingId === proj.id ? (
                        <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="bg-neutral-950 border border-neutral-800 px-2.5 py-1 text-xs text-neutral-200 rounded-lg focus:outline-none font-sans"
                            autoFocus
                          />
                          <button
                            onClick={() => handleRenameProject(proj.id)}
                            className="bg-amber-600 hover:bg-amber-500 text-[#0E1117] text-[10px] font-bold px-2.5 py-1 rounded-md cursor-pointer"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-neutral-500 hover:text-neutral-300 text-[10px] font-bold px-2.5 py-1 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <h4 className="text-sm font-semibold text-neutral-200 truncate font-sans">
                            {proj.name}
                          </h4>
                          <p className="text-[10px] text-neutral-500 font-mono mt-0.5">
                            {new Date(proj.updatedAt).toLocaleDateString()}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setActiveMenuId(activeMenuId === proj.id ? null : proj.id)}
                      className="p-1.5 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    <AnimatePresence>
                      {activeMenuId === proj.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="absolute right-0 mt-1 w-36 bg-[#0E1117] border border-neutral-800 rounded-xl shadow-2xl p-1 z-30 text-xs"
                        >
                          <button
                            onClick={() => router.push(`/agent/workspace/${proj.id}`)}
                            className="w-full text-left flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-neutral-900 text-neutral-300 transition-colors cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Open</span>
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(proj.id);
                              setEditName(proj.name);
                              setActiveMenuId(null);
                            }}
                            className="w-full text-left flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-neutral-900 text-neutral-300 transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Rename</span>
                          </button>
                          <button
                            onClick={() => handleDeleteProject(proj.id)}
                            className="w-full text-left flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-neutral-900/60 text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
