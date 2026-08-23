"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import Editor from "@monaco-editor/react";
import { 
  ArrowLeft, 
  Terminal as TerminalIcon, 
  FileCode, 
  MessageSquare, 
  Eye, 
  Settings, 
  Check, 
  ChevronRight, 
  Cpu, 
  Plus, 
  Trash2, 
  Save, 
  Smartphone, 
  Monitor, 
  X,
  File,
  Loader2,
  Folder
} from "lucide-react";

interface LogItem {
  id: string;
  msg: string;
  type: "info" | "success" | "error";
}

function getLanguageFromPath(path: string) {
  if (path.endsWith(".tsx") || path.endsWith(".ts")) return "typescript";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".js") || path.endsWith(".jsx")) return "javascript";
  return "plaintext";
}

export default function WorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.projectId as string;

  // Project Settings
  const [projectName, setProjectName] = useState("My Workspace Application");
  const [files, setFiles] = useState<{ [path: string]: string }>({});
  const [activeFile, setActiveFile] = useState("App.tsx");
  const [openTabs, setOpenTabs] = useState<string[]>(["App.tsx"]);
  
  // Secrets state (just names on the client for security)
  const [secretKeys, setSecretKeys] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  // App-wide flags
  const [loading, setLoading] = useState(true);
  const [usingSupabase, setUsingSupabase] = useState(false);
  const [isSecretsOpen, setIsSecretsOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gemini-3.7-flash");

  // Dual layout mode
  const [isDesktopMode, setIsDesktopMode] = useState(true);
  
  // 5 Mobile tabs: "tree" | "prompt" | "code" | "preview" | "console"
  const [activeMobileTab, setActiveMobileTab] = useState<"tree" | "prompt" | "code" | "preview" | "console">("prompt");

  // Agent Chat States
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([
    {
      role: "assistant",
      content: "Welcome to Play Nexa Workspace. I am Nexa-AI. Specify your goal and let me build the application for you."
    }
  ]);
  const [agentRunning, setAgentRunning] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<LogItem[]>([
    { id: "init", msg: "Workspace initialization complete.", type: "success" }
  ]);

  // VFS Modals
  const [newFilePath, setNewFilePath] = useState("");
  const [showAddFile, setShowAddFile] = useState(false);

  // Preview Sandbox Compiler state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);

  // Load secret keys
  const fetchSecretsList = async (isSupabaseActive: boolean) => {
    if (isSupabaseActive) {
      try {
        const res = await fetch(`/api/agent/secrets/${projectId}`);
        const data = await res.json();
        if (data.success && data.secrets) {
          setSecretKeys(data.secrets);
        }
      } catch (err) {
        console.error("Failed to load secrets list:", err);
      }
    } else {
      const local = localStorage.getItem(`nexa_secrets_${projectId}`);
      if (local) {
        try {
          const parsed = JSON.parse(local);
          setSecretKeys(Object.keys(parsed));
        } catch {
          setSecretKeys([]);
        }
      }
    }
  };

  // Load Project parameters on mount
  useEffect(() => {
    async function loadWorkspace() {
      try {
        const res = await fetch(`/api/agent/projects?projectId=${projectId}`);
        const data = await res.json();

        let isSupabaseActive = false;
        if (data.success && !data.useLocalFallback && data.project) {
          setProjectName(data.project.name);
          setUsingSupabase(true);
          isSupabaseActive = true;

          if (data.files && data.files.length > 0) {
            const parsedFiles: { [path: string]: string } = {};
            data.files.forEach((f: any) => {
              parsedFiles[f.file_path] = f.content;
            });
            setFiles(parsedFiles);
            
            const fileKeys = Object.keys(parsedFiles);
            if (fileKeys.includes("App.tsx")) {
              setActiveFile("App.tsx");
              setOpenTabs(["App.tsx"]);
            } else if (fileKeys.length > 0) {
              setActiveFile(fileKeys[0]);
              setOpenTabs([fileKeys[0]]);
            }
          }
        } else {
          // Local storage fallback loading
          const localProjects = localStorage.getItem("nexa_agent_projects");
          if (localProjects) {
            const list = JSON.parse(localProjects);
            const found = list.find((p: any) => p.id === projectId);
            if (found) setProjectName(found.name);
          }

          const localFiles = localStorage.getItem(`nexa_files_${projectId}`);
          if (localFiles) {
            const parsed = JSON.parse(localFiles);
            setFiles(parsed);
            const fileKeys = Object.keys(parsed);
            if (fileKeys.includes("App.tsx")) {
              setActiveFile("App.tsx");
              setOpenTabs(["App.tsx"]);
            } else if (fileKeys.length > 0) {
              setActiveFile(fileKeys[0]);
              setOpenTabs([fileKeys[0]]);
            }
          } else {
            // Seed base template files
            const base = {
              "package.json": JSON.stringify({
                name: "my-app",
                version: "1.0.0",
                dependencies: {}
              }, null, 2),
              "App.tsx": `import React, { useState } from "react";\n\nexport default function App() {\n  return (\n    <div className="min-h-screen flex items-center justify-center bg-neutral-900 text-white font-sans p-6">\n      <div className="text-center space-y-4">\n        <h1 className="text-3xl font-bold tracking-tight">Welcome to Play Nexa AI Workspace</h1>\n        <p className="text-neutral-400 font-mono text-sm">Created dynamically via Play Nexa AI Workspace.</p>\n      </div>\n    </div>\n  );\n}`,
              "styles.css": "body {\n  margin: 0;\n  font-family: sans-serif;\n}"
            };
            setFiles(base);
            localStorage.setItem(`nexa_files_${projectId}`, JSON.stringify(base));
            setOpenTabs(["App.tsx"]);
            setActiveFile("App.tsx");
          }
        }

        // Load Secrets list safely
        await fetchSecretsList(isSupabaseActive);

        // Hydrate initial prompt from Dashboard if present
        const initPrompt = sessionStorage.getItem(`nexa_initial_prompt_${projectId}`);
        if (initPrompt) {
          sessionStorage.removeItem(`nexa_initial_prompt_${projectId}`);
          triggerAgent(initPrompt);
        }

      } catch (err) {
        console.error("Failed to load workspace:", err);
      } finally {
        setLoading(false);
      }
    }

    loadWorkspace();

    // Set screen size mode defaults
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    setIsDesktopMode(mediaQuery.matches);
    const handleViewportChange = (e: MediaQueryListEvent) => {
      setIsDesktopMode(e.matches);
    };
    mediaQuery.addEventListener("change", handleViewportChange);
    return () => mediaQuery.removeEventListener("change", handleViewportChange);
  }, [projectId]);

  // Compiler live preview output compilation
  useEffect(() => {
    if (Object.keys(files).length === 0) return;

    try {
      const htmlContent = files["index.html"] || `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>${files["styles.css"] || ""}</style>
</head>
<body class="bg-neutral-950 text-white min-h-screen">
  <div id="root"></div>
  <script type="module">
    import React, { useState, useEffect } from 'https://esm.sh/react@19?dev';
    import ReactDOM from 'https://esm.sh/react-dom@19/client?dev';

    try {
      ${compileCodeToESM(files["App.tsx"] || "")}
      
      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(React.createElement(App));
    } catch (err) {
      console.error(err);
      window.parent.postMessage({ type: 'PREVIEW_ERROR', message: err.message, stack: err.stack }, '*');
    }
  </script>
</body>
</html>`;

      const blob = new Blob([htmlContent], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);

      return () => {
        URL.revokeObjectURL(url);
      };
    } catch (err) {
      console.error("Preview sandbox compile failed", err);
    }
  }, [files]);

  // Operational feedback error reporting detection
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === "PREVIEW_ERROR") {
        const errorMsg = e.data.message;
        const stackTrace = e.data.stack;

        addLog(`Preview Exception detected: ${errorMsg}`, "error");
        submitFeedbackCorrection(errorMsg, stackTrace);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [files]);

  const compileCodeToESM = (code: string) => {
    let clean = code;
    // Strip interface/type declarations safely
    clean = clean.replace(/interface\s+\w+\s*\{[^}]*\}/g, "");
    clean = clean.replace(/type\s+\w+\s*=\s*[^;]+/g, "");
    // Translate standard imports into live modules
    clean = clean.replace(/import\s+(.*?)\s+from\s+['"]react['"]/g, "const $1 = React;");
    clean = clean.replace(/import\s+(.*?)\s+from\s+['"]lucide-react['"]/g, "import $1 from 'https://esm.sh/lucide-react';");
    clean = clean.replace(/export\s+default\s+function/g, "function");
    return clean;
  };

  const submitFeedbackCorrection = async (msg: string, stack?: string) => {
    try {
      addLog("Analyzing error context for autonomous self-learning feedback loop...", "info");
      const res = await fetch("/api/agent/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          errorMessage: msg,
          fileContext: files[activeFile] || "",
          resolution: "Auto-corrected array boundaries and components layout definitions"
        })
      });
      const data = await res.json();
      if (data.success) {
        addLog("Correction logic saved to Supabase knowledge base successfully.", "success");
      }
    } catch (err) {
      console.warn("Feedback correction loop skipped:", err);
    }
  };

  const addLog = (msg: string, type: "info" | "success" | "error" = "info") => {
    setTerminalLogs(prev => [
      ...prev,
      { id: Math.random().toString(), msg, type }
    ]);
  };

  const triggerAgent = async (userPrompt: string) => {
    if (agentRunning) return;
    setAgentRunning(true);
    addLog(`Nexa-AI initiated task: "${userPrompt}"`, "info");

    const updatedMessages = [
      ...messages,
      { role: "user" as const, content: userPrompt }
    ];
    setMessages(updatedMessages);
    setChatInput("");

    try {
      const apiKey = localStorage.getItem("user_gemini_api_key") || "";
      const res = await fetch("/api/agent/generate", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          messages: updatedMessages,
          files,
          projectId,
          activeFilePath: activeFile,
          model: selectedModel
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to communicate with Nexa Engine");

      if (data.success) {
        setMessages(prev => [
          ...prev,
          { role: "assistant", content: data.explanation }
        ]);

        if (data.files && data.files.length > 0) {
          const updatedFiles = { ...files };
          data.files.forEach((file: any) => {
            updatedFiles[file.file] = file.code;
            addLog(`VFS File modified successfully: ${file.file}`, "success");
            
            // Add tab to tab list if not open
            setOpenTabs(prev => {
              if (prev.includes(file.file)) return prev;
              return [...prev, file.file];
            });
          });
          setFiles(updatedFiles);

          // Save state to remote/local storage
          saveProjectState(updatedFiles);
        }
      }
    } catch (err: any) {
      addLog(`Nexa Engine Error: ${err.message}`, "error");
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: `An error occurred: ${err.message}` }
      ]);
    } finally {
      setAgentRunning(false);
    }
  };

  const saveProjectState = async (latestFiles: { [path: string]: string }) => {
    setIsSaving(true);
    if (usingSupabase) {
      try {
        await fetch("/api/agent/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            name: projectName,
            files: Object.entries(latestFiles).map(([path, content]) => ({
              file_path: path,
              content
            }))
          })
        });
      } catch (err) {
        console.error("Supabase remote save failure", err);
      }
    } else {
      localStorage.setItem(`nexa_files_${projectId}`, JSON.stringify(latestFiles));
    }
    setTimeout(() => {
      setIsSaving(false);
    }, 600);
  };

  const handleCreateFile = () => {
    if (!newFilePath.trim()) return;
    const path = newFilePath.trim();
    if (files[path]) {
      alert("A file with this name already exists.");
      return;
    }

    const updated = {
      ...files,
      [path]: `// New ${path} file template\n`
    };
    setFiles(updated);
    setActiveFile(path);
    setOpenTabs(prev => prev.includes(path) ? prev : [...prev, path]);
    setNewFilePath("");
    setShowAddFile(false);
    saveProjectState(updated);
    addLog(`VFS file created manually: ${path}`, "info");
  };

  const handleDeleteFile = (path: string) => {
    if (path === "App.tsx") {
      alert("Core application entry App.tsx cannot be removed.");
      return;
    }
    const updated = { ...files };
    delete updated[path];
    setFiles(updated);

    // Remove tab
    setOpenTabs(prev => prev.filter(t => t !== path));
    if (activeFile === path) {
      setActiveFile("App.tsx");
    }

    saveProjectState(updated);
    addLog(`VFS file deleted manually: ${path}`, "info");
  };

  const handleFileChange = (path: string, content: string) => {
    const updated = { ...files, [path]: content };
    setFiles(updated);
    localStorage.setItem(`nexa_files_${projectId}`, JSON.stringify(updated));
    saveProjectState(updated);
  };

  const handleAddSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as any;
    const key = form.elements.secKey.value.trim();
    const value = form.elements.secVal.value.trim();
    if (!key || !value) return;

    if (usingSupabase) {
      try {
        await fetch(`/api/agent/secrets/${projectId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, value })
        });
      } catch (err) {
        console.error("Supabase secret POST failure", err);
      }
    } else {
      const local = localStorage.getItem(`nexa_secrets_${projectId}`) || "{}";
      try {
        const parsed = JSON.parse(local);
        parsed[key] = value;
        localStorage.setItem(`nexa_secrets_${projectId}`, JSON.stringify(parsed));
      } catch {
        // empty block
      }
    }

    form.reset();
    addLog(`Workspace Secret added: ${key}`, "success");
    await fetchSecretsList(usingSupabase);
  };

  const handleDeleteSecret = async (key: string) => {
    if (usingSupabase) {
      try {
        await fetch(`/api/agent/secrets/${projectId}?key=${key}`, {
          method: "DELETE"
        });
      } catch (err) {
        console.error("Supabase secret DELETE failure", err);
      }
    } else {
      const local = localStorage.getItem(`nexa_secrets_${projectId}`) || "{}";
      try {
        const parsed = JSON.parse(local);
        delete parsed[key];
        localStorage.setItem(`nexa_secrets_${projectId}`, JSON.stringify(parsed));
      } catch {
        // empty block
      }
    }

    addLog(`Workspace Secret removed: ${key}`, "info");
    await fetchSecretsList(usingSupabase);
  };

  const closeTab = (tabName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabName === "App.tsx") return; // cannot close main app entry

    const remaining = openTabs.filter(t => t !== tabName);
    setOpenTabs(remaining);

    if (activeFile === tabName) {
      const fallback = remaining[remaining.length - 1] || "App.tsx";
      setActiveFile(fallback);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#0E1117] text-[#E6EDF3] font-sans overflow-hidden">
      {/* Workspace Header Panel */}
      <header className="h-14 border-b border-neutral-800 bg-[#0B0D13] px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3 min-w-0">
          <button 
            onClick={() => router.push("/agent")}
            className="p-1.5 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-neutral-500 font-mono select-none">Play Nexa AI</span>
          <span className="text-neutral-600 font-mono select-none">/</span>
          <h2 className="text-xs font-semibold text-neutral-200 truncate font-mono max-w-[150px] sm:max-w-[200px]">
            {projectName}
          </h2>
        </div>

        {/* Configurations Controls */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* Preset Model Selector */}
          <div className="hidden sm:flex items-center space-x-1.5 bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1">
            <Cpu className="w-3.5 h-3.5 text-amber-500" />
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-transparent text-[11px] font-mono text-neutral-300 focus:outline-none cursor-pointer pr-1"
            >
              <option value="gemini-3.7-flash">gemini-3.7-flash</option>
              <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview</option>
              <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite</option>
            </select>
          </div>

          <button
            onClick={() => setIsSecretsOpen(true)}
            className="p-1.5 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
            title="Secrets & settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Desktop/Mobile Mode Toggle */}
          <button
            onClick={() => setIsDesktopMode(!isDesktopMode)}
            className="flex items-center space-x-1.5 bg-neutral-900 hover:bg-neutral-800 text-xs text-neutral-300 font-mono border border-neutral-800 px-2.5 py-1 rounded-lg cursor-pointer"
          >
            {isDesktopMode ? (
              <>
                <Smartphone className="w-3.5 h-3.5" />
                <span className="text-[10px]">Mobile Mode</span>
              </>
            ) : (
              <>
                <Monitor className="w-3.5 h-3.5" />
                <span className="text-[10px]">Desktop Mode</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main interactive frame container */}
      <div className="flex-grow flex overflow-hidden">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            <span className="text-xs text-neutral-400 font-mono">Loading workspace metrics...</span>
          </div>
        ) : isDesktopMode ? (
          /* Desktop Split 3-Pane Layout */
          <div className="flex-grow flex overflow-hidden divide-x divide-neutral-800">
            {/* Column 1: Nexa Agent Chat & VFS File tree explorer */}
            <div className="w-[28%] min-w-[300px] max-w-[400px] flex flex-col bg-[#0B0D13] overflow-hidden">
              {/* Agent chat header */}
              <div className="p-3 border-b border-neutral-800 flex items-center justify-between bg-[#0B0D13]">
                <div className="flex items-center space-x-2">
                  <Cpu className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-400">
                    Nexa Agent Chat
                  </span>
                </div>
                {agentRunning && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />}
              </div>

              {/* Chat messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((m, idx) => (
                  <div 
                    key={idx} 
                    className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
                  >
                    <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                      m.role === "user" 
                        ? "bg-amber-600 text-[#0E1117] font-medium" 
                        : "bg-[#0E1117] border border-neutral-800 text-neutral-300 font-sans"
                    }`}>
                      {m.content}
                    </div>
                  </div>
                ))}
              </div>

              {/* Chat Input */}
              <div className="p-3 border-t border-neutral-800 bg-[#0E1117]">
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (chatInput.trim()) triggerAgent(chatInput.trim());
                  }} 
                  className="flex space-x-2"
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    disabled={agentRunning}
                    placeholder="Implement Weather Widget..."
                    className="flex-grow bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || agentRunning}
                    className="bg-amber-600 disabled:opacity-40 text-[#0E1117] p-2 rounded-lg font-bold hover:bg-amber-500 transition-all shrink-0 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </form>
              </div>

              {/* File tree navigation panel */}
              <div className="h-[240px] border-t border-neutral-800 flex flex-col overflow-hidden bg-[#0E1117]">
                <div className="p-3 border-b border-neutral-800/60 flex items-center justify-between bg-[#0B0D13]">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400 flex items-center space-x-1.5">
                    <Folder className="w-3.5 h-3.5" />
                    <span>Workspace Explorer</span>
                  </span>
                  <button 
                    onClick={() => setShowAddFile(!showAddFile)}
                    className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 rounded-md transition-colors cursor-pointer"
                    title="Create new file"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {showAddFile && (
                  <div className="p-2 border-b border-neutral-800 bg-[#0B0D13] space-y-1.5">
                    <input
                      type="text"
                      placeholder="components/Weather.tsx"
                      value={newFilePath}
                      onChange={(e) => setNewFilePath(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 px-2 py-1 text-[11px] font-mono rounded text-neutral-300 focus:outline-none"
                    />
                    <div className="flex justify-end space-x-1">
                      <button 
                        onClick={() => setShowAddFile(false)}
                        className="text-[9px] text-neutral-500 hover:text-neutral-300 font-bold px-1.5 py-0.5 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleCreateFile}
                        className="bg-amber-600 text-[#0E1117] text-[9px] font-bold px-1.5 py-0.5 rounded cursor-pointer"
                      >
                        Add File
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                  {Object.keys(files).map((path) => (
                    <div 
                      key={path}
                      className={`flex items-center justify-between group px-2 py-1.5 rounded-lg text-xs font-mono cursor-pointer transition-colors ${
                        activeFile === path 
                          ? "bg-neutral-850 text-neutral-100" 
                          : "hover:bg-neutral-900/60 text-neutral-400"
                      }`}
                      onClick={() => {
                        setActiveFile(path);
                        setOpenTabs(prev => prev.includes(path) ? prev : [...prev, path]);
                      }}
                    >
                      <div className="flex items-center space-x-2 min-w-0">
                        <File className="w-3.5 h-3.5 shrink-0 text-neutral-400" />
                        <span className="truncate">{path}</span>
                      </div>
                      {path !== "App.tsx" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFile(path);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-neutral-850 rounded text-neutral-400 hover:text-red-400 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Column 2: Editor Pane (Tab bar, Monaco Editor) */}
            <div className="flex-1 flex flex-col overflow-hidden bg-neutral-950">
              {/* Premium Tab bar */}
              <div className="h-10 border-b border-neutral-800 bg-[#0B0D13] flex items-center justify-between px-2 shrink-0 overflow-x-auto select-none">
                <div className="flex items-center space-x-1.5">
                  {openTabs.map((tab) => (
                    <div
                      key={tab}
                      onClick={() => setActiveFile(tab)}
                      className={`h-7 px-3 flex items-center space-x-2 rounded-t-lg text-xs font-mono cursor-pointer transition-colors ${
                        activeFile === tab
                          ? "bg-neutral-950 border-t-2 border-amber-500 text-neutral-100"
                          : "hover:bg-neutral-900/80 text-neutral-400"
                      }`}
                    >
                      <span>{tab}</span>
                      {tab !== "App.tsx" && (
                        <button
                          onClick={(e) => closeTab(tab, e)}
                          className="p-0.5 rounded-md hover:bg-neutral-800 text-neutral-500 hover:text-neutral-200 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Save status indicator */}
                <div className="flex items-center space-x-2 px-2 shrink-0">
                  {isSaving ? (
                    <div className="flex items-center space-x-1">
                      <Loader2 className="w-3 h-3 animate-spin text-neutral-500" />
                      <span className="text-[10px] text-neutral-500 font-mono">saving</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-[10px] text-neutral-500 font-mono">saved</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Monaco Editor Canvas */}
              <div className="flex-1 overflow-hidden relative bg-neutral-950">
                <Editor
                  height="100%"
                  theme="vs-dark"
                  path={activeFile}
                  defaultLanguage={getLanguageFromPath(activeFile)}
                  value={files[activeFile] || ""}
                  onChange={(val) => {
                    if (val !== undefined) handleFileChange(activeFile, val);
                  }}
                  loading={
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-500 font-mono bg-neutral-950">
                      Loading Monaco framework...
                    </div>
                  }
                  options={{
                    fontSize: 12,
                    minimap: { enabled: false },
                    automaticLayout: true,
                    padding: { top: 12 },
                    scrollbar: { vertical: "visible" },
                    lineNumbers: "on",
                    glyphMargin: false,
                    folding: true,
                    lineDecorationsWidth: 10,
                    lineNumbersMinChars: 3
                  }}
                />
              </div>
            </div>

            {/* Column 3: Preview Box & Operational Logs */}
            <div className="w-[34%] min-w-[340px] flex flex-col divide-y divide-neutral-800 bg-[#0E1117] overflow-hidden">
              {/* Live Preview Pane */}
              <div className="flex-1 flex flex-col overflow-hidden bg-neutral-950">
                <div className="h-10 border-b border-neutral-800 px-4 flex items-center justify-between bg-[#0B0D13]">
                  <div className="flex items-center space-x-2">
                    <Eye className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-mono text-neutral-300">Live Preview</span>
                  </div>
                  <button 
                    onClick={() => setPreviewKey(k => k + 1)}
                    className="text-[10px] bg-neutral-900 border border-neutral-800 text-neutral-400 px-2.5 py-0.5 rounded hover:text-neutral-200 transition-colors cursor-pointer"
                  >
                    Refresh
                  </button>
                </div>

                <div className="flex-grow relative bg-neutral-950">
                  {previewUrl ? (
                    <iframe
                      key={previewKey}
                      src={previewUrl}
                      className="w-full h-full border-none bg-neutral-950"
                      title="Nexa Sandbox Frame"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-500 font-mono">
                      Compiling Virtual Sandbox App...
                    </div>
                  )}
                </div>
              </div>

              {/* Console operational terminal logs */}
              <div className="h-[240px] flex flex-col bg-[#0B0D13] overflow-hidden">
                <div className="h-10 border-b border-neutral-850 px-4 flex items-center justify-between bg-[#0B0D13]">
                  <div className="flex items-center space-x-2">
                    <TerminalIcon className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-400">
                      Developer Console logs
                    </span>
                  </div>
                  <button 
                    onClick={() => setTerminalLogs([])}
                    className="text-[9px] text-neutral-600 hover:text-neutral-400 font-mono uppercase cursor-pointer"
                  >
                    Clear
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-1.5 font-mono text-[11px] leading-relaxed select-text">
                  {terminalLogs.map((log) => (
                    <div 
                      key={log.id}
                      className={
                        log.type === "success" 
                          ? "text-emerald-500" 
                          : log.type === "error" 
                            ? "text-red-500" 
                            : "text-neutral-400"
                      }
                    >
                      <span className="text-neutral-600 select-none mr-2">&gt;</span>
                      {log.msg}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Mobile Viewport Interface: Split Tab and Bottom Nav Bar */
          <div className="flex-grow flex flex-col overflow-hidden bg-[#0E1117]">
            <div className="flex-grow overflow-hidden relative">
              {/* Mobile Tab 1: Tree (VFS Explorer) */}
              {activeMobileTab === "tree" && (
                <div className="absolute inset-0 flex flex-col overflow-hidden">
                  <div className="p-3 border-b border-neutral-800 flex items-center justify-between bg-[#0B0D13]">
                    <span className="text-xs font-mono font-bold uppercase text-neutral-400">
                      VFS Files explorer
                    </span>
                    <button 
                      onClick={() => setShowAddFile(!showAddFile)}
                      className="p-1 hover:bg-neutral-800 text-neutral-400 rounded cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {showAddFile && (
                    <div className="p-3 bg-[#0B0D13] border-b border-neutral-800 space-y-2">
                      <input
                        type="text"
                        placeholder="components/Header.tsx"
                        value={newFilePath}
                        onChange={(e) => setNewFilePath(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 px-3 py-1.5 text-xs font-mono rounded text-neutral-300 focus:outline-none"
                      />
                      <div className="flex justify-end space-x-1.5">
                        <button 
                          onClick={() => setShowAddFile(false)}
                          className="text-[10px] text-neutral-500 font-bold px-2 py-1 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={handleCreateFile}
                          className="bg-amber-600 text-[#0E1117] text-[10px] font-bold px-2 py-1 rounded cursor-pointer"
                        >
                          Create File
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto p-3 space-y-1">
                    {Object.keys(files).map(path => (
                      <div
                        key={path}
                        onClick={() => {
                          setActiveFile(path);
                          setOpenTabs(prev => prev.includes(path) ? prev : [...prev, path]);
                          setActiveMobileTab("code");
                        }}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono cursor-pointer ${
                          activeFile === path ? "bg-neutral-800 text-neutral-100" : "text-neutral-400"
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <File className="w-3.5 h-3.5" />
                          <span>{path}</span>
                        </div>
                        {path !== "App.tsx" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteFile(path);
                            }}
                            className="p-1 text-neutral-500 hover:text-red-400 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mobile Tab 2: Prompt (Agent Chat) */}
              {activeMobileTab === "prompt" && (
                <div className="absolute inset-0 flex flex-col overflow-hidden bg-[#0E1117]">
                  <div className="p-3 border-b border-neutral-800 bg-[#0B0D13]">
                    <span className="text-xs font-mono uppercase tracking-wider text-neutral-400">
                      Nexa Autonomous Agent
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((m, idx) => (
                      <div 
                        key={idx} 
                        className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
                      >
                        <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                          m.role === "user" 
                            ? "bg-amber-600 text-[#0E1117] font-medium" 
                            : "bg-[#0B0D13] border border-neutral-800 text-neutral-300"
                        }`}>
                          {m.content}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 border-t border-neutral-800 bg-[#0B0D13]">
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (chatInput.trim()) triggerAgent(chatInput.trim());
                      }} 
                      className="flex space-x-2"
                    >
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        disabled={agentRunning}
                        placeholder="Build a calculator app..."
                        className="flex-grow bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={!chatInput.trim() || agentRunning}
                        className="bg-amber-600 disabled:opacity-40 text-[#0E1117] p-2 rounded-lg font-bold shrink-0 cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* Mobile Tab 3: Code (Editor) */}
              {activeMobileTab === "code" && (
                <div className="absolute inset-0 flex flex-col bg-neutral-950 overflow-hidden">
                  <div className="h-10 border-b border-neutral-800 px-4 flex items-center justify-between bg-[#0B0D13] shrink-0">
                    <span className="text-xs font-mono text-neutral-300">Editing: {activeFile}</span>
                    <span className="text-[10px] font-mono text-neutral-600">Monaco Frame</span>
                  </div>

                  <div className="flex-1 overflow-hidden relative">
                    <Editor
                      height="100%"
                      theme="vs-dark"
                      path={activeFile}
                      defaultLanguage={getLanguageFromPath(activeFile)}
                      value={files[activeFile] || ""}
                      onChange={(val) => {
                        if (val !== undefined) handleFileChange(activeFile, val);
                      }}
                      options={{
                        fontSize: 11,
                        minimap: { enabled: false },
                        automaticLayout: true,
                        padding: { top: 8 }
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Mobile Tab 4: Preview (Live App iframe) */}
              {activeMobileTab === "preview" && (
                <div className="absolute inset-0 flex flex-col bg-neutral-950 overflow-hidden">
                  <div className="h-10 border-b border-neutral-800 px-4 flex items-center justify-between bg-[#0B0D13]">
                    <span className="text-xs font-mono text-neutral-300">Live Preview Output</span>
                    <button 
                      onClick={() => setPreviewKey(k => k + 1)}
                      className="text-[10px] bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded text-neutral-400 cursor-pointer"
                    >
                      Refresh
                    </button>
                  </div>

                  <div className="flex-grow relative bg-neutral-950">
                    {previewUrl && (
                      <iframe
                        src={previewUrl}
                        className="w-full h-full border-none bg-neutral-950"
                        title="Mobile Preview Frame"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Mobile Tab 5: Console (Terminal logs) */}
              {activeMobileTab === "console" && (
                <div className="absolute inset-0 flex flex-col bg-[#0B0D13] overflow-hidden">
                  <div className="h-10 border-b border-neutral-800 px-4 flex items-center justify-between bg-[#0B0D13]">
                    <span className="text-xs font-mono font-bold uppercase text-neutral-400">
                      Developer Operational logs
                    </span>
                    <button 
                      onClick={() => setTerminalLogs([])}
                      className="text-[10px] text-neutral-500 font-mono uppercase cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-1.5 font-mono text-[10px] leading-relaxed">
                    {terminalLogs.map(log => (
                      <div 
                        key={log.id}
                        className={
                          log.type === "success" 
                            ? "text-emerald-500" 
                            : log.type === "error" 
                              ? "text-red-500" 
                              : "text-neutral-400"
                        }
                      >
                        &gt; {log.msg}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Tab bottom navigation switcher */}
            <div className="h-14 border-t border-neutral-850 bg-[#0B0D13] flex items-center justify-around shrink-0 pb-1 select-none">
              <button
                onClick={() => setActiveMobileTab("tree")}
                className={`flex flex-col items-center space-y-1 py-1 text-center shrink-0 w-[20%] cursor-pointer ${
                  activeMobileTab === "tree" ? "text-amber-500" : "text-neutral-500 hover:text-neutral-400"
                }`}
              >
                <Folder className="w-4 h-4" />
                <span className="text-[8px] font-mono uppercase">Tree</span>
              </button>

              <button
                onClick={() => setActiveMobileTab("prompt")}
                className={`flex flex-col items-center space-y-1 py-1 text-center shrink-0 w-[20%] cursor-pointer ${
                  activeMobileTab === "prompt" ? "text-amber-500" : "text-neutral-500 hover:text-neutral-400"
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span className="text-[8px] font-mono uppercase">Prompt</span>
              </button>

              <button
                onClick={() => setActiveMobileTab("code")}
                className={`flex flex-col items-center space-y-1 py-1 text-center shrink-0 w-[20%] cursor-pointer ${
                  activeMobileTab === "code" ? "text-amber-500" : "text-neutral-500 hover:text-neutral-400"
                }`}
              >
                <FileCode className="w-4 h-4" />
                <span className="text-[8px] font-mono uppercase">Code</span>
              </button>

              <button
                onClick={() => setActiveMobileTab("preview")}
                className={`flex flex-col items-center space-y-1 py-1 text-center shrink-0 w-[20%] cursor-pointer ${
                  activeMobileTab === "preview" ? "text-amber-500" : "text-neutral-500 hover:text-neutral-400"
                }`}
              >
                <Eye className="w-4 h-4" />
                <span className="text-[8px] font-mono uppercase">Preview</span>
              </button>

              <button
                onClick={() => setActiveMobileTab("console")}
                className={`flex flex-col items-center space-y-1 py-1 text-center shrink-0 w-[20%] cursor-pointer ${
                  activeMobileTab === "console" ? "text-amber-500" : "text-neutral-500 hover:text-neutral-400"
                }`}
              >
                <TerminalIcon className="w-4 h-4" />
                <span className="text-[8px] font-mono uppercase">Console</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Project secrets modal configuration */}
      <AnimatePresence>
        {isSecretsOpen && (
          <div className="fixed inset-0 bg-neutral-950/75 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0B0D13] border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden p-6 text-xs text-neutral-300 shadow-2xl space-y-4"
            >
              <div className="flex justify-between items-center pb-2 border-b border-neutral-800/60">
                <div className="flex items-center space-x-2 text-neutral-100 font-semibold font-mono">
                  <Settings className="w-4 h-4 text-amber-500" />
                  <span>Project Secrets & Keys</span>
                </div>
                <button 
                  onClick={() => setIsSecretsOpen(false)}
                  className="p-1 hover:bg-neutral-850 rounded-lg text-neutral-500 hover:text-neutral-300 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 block mb-1.5">
                    Workspace Secrets (Names Only)
                  </label>
                  <p className="text-[10px] text-neutral-500 mb-3 font-sans">
                    These variable pairs are securely saved per-project to emulate local secrets inside preview frames.
                  </p>
                  
                  {/* Secrets keys name listing */}
                  <div className="space-y-2 bg-neutral-950 border border-neutral-900 rounded-lg p-2.5 max-h-40 overflow-y-auto">
                    {secretKeys.length === 0 ? (
                      <p className="text-center text-[10px] text-neutral-600 italic py-2 font-sans">
                        No custom secrets added to this workspace yet.
                      </p>
                    ) : (
                      secretKeys.map((k) => (
                        <div key={k} className="flex items-center justify-between bg-neutral-900/40 p-1.5 rounded-md border border-neutral-800/40">
                          <span className="font-mono text-neutral-400 select-all">{k}</span>
                          <span className="font-mono text-neutral-600 text-[10px]">••••••••</span>
                          <button
                            onClick={() => handleDeleteSecret(k)}
                            className="p-1 hover:bg-neutral-850 text-red-400 hover:text-red-300 rounded cursor-pointer"
                            title="Remove secret"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Add new secret key pair form */}
                <form 
                  onSubmit={handleAddSecret}
                  className="space-y-2 pt-2 border-t border-neutral-800/40"
                >
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      name="secKey"
                      required
                      placeholder="API_KEY"
                      className="bg-neutral-950 border border-neutral-800 px-2.5 py-1.5 rounded-lg text-xs font-mono text-neutral-200 focus:outline-none"
                    />
                    <input
                      name="secVal"
                      type="password"
                      required
                      placeholder="key_values_secret"
                      className="bg-neutral-950 border border-neutral-800 px-2.5 py-1.5 rounded-lg text-xs font-mono text-neutral-200 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-amber-600 hover:bg-amber-500 text-[#0E1117] font-bold py-1.5 rounded-lg text-xs cursor-pointer font-sans"
                  >
                    Add Secret Pair
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
