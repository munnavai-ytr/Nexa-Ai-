"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  MessageSquare, 
  KeyRound, 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  Menu, 
  X, 
  Sun, 
  Moon, 
  Zap, 
  Sparkles, 
  Terminal, 
  ArrowUp, 
  Shield, 
  AlertCircle, 
  MoreHorizontal, 
  Key, 
  RefreshCw,
  ExternalLink,
  BookOpen,
  FileText,
  UploadCloud,
  ChevronDown,
  ChevronUp,
  Search,
  FolderOpen,
  Settings,
  Download,
  Code2,
  Pencil,
  FolderArchive,
  Paperclip,
  FileCode,
  Layers,
  FileCheck,
  Smartphone,
  SlidersHorizontal,
  Code,
  Image as ImageIcon
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import Markdown from "react-markdown";
import LoadingAnimation from "@/components/LoadingAnimation";
import ClaudeThinkingIndicator from "@/components/ClaudeThinkingIndicator";
import { usePWA } from "@/components/PWAProvider";
import { 
  processZipFile, 
  processSingleFile, 
  ExtractedCodebase, 
  ExtractedCodeFile 
} from "@/lib/codebaseProcessor";

// Types
interface SourceAttribution {
  filename: string;
  score: number;
  snippet: string;
}

interface AttachedImage {
  dataUrl: string;
  base64: string;
  mimeType: string;
  fileName: string;
  sizeKb: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  attachedZip?: {
    fileName: string;
    totalFiles: number;
    totalSizeKb: number;
  };
  attachedImages?: Array<{
    dataUrl: string;
    fileName: string;
    mimeType?: string;
    sizeKb?: number;
  }>;
  attachedImage?: {
    dataUrl: string;
    fileName: string;
    mimeType?: string;
  };
  sources?: SourceAttribution[];
  sourceType?: string;
  usage?: {
    promptTokens?: number;
    candidatesTokens?: number;
    totalTokens?: number;
  };
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  created: string;
  lastUsage?: {
    promptTokens?: number;
    candidatesTokens?: number;
    totalTokens?: number;
  };
}

interface ApiKey {
  id: string;
  name: string;
  key: string;
  created: string;
  status: "active" | "revoked";
}

// Pure helper functions outside component scope for strict React 19 rules
let idCounter = 0;
function generateUniqueId(prefix: string): string {
  idCounter++;
  return `${prefix}-${idCounter}-${Math.random().toString(36).substring(2, 9)}`;
}

function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      // fallback
    }
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getFormattedTime(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString();
}

export default function Home() {
  // Theme & App State (Initialized after mounting to avoid hydration mismatch)
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [activeTab, setActiveTab] = useState<"chat" | "api-keys" | "library">("chat");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Chat States
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingChatTitle, setEditingChatTitle] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [isDeepResearch, setIsDeepResearch] = useState(false);

  // BYOK (Bring Your Own Key) States
  const [userGeminiApiKey, setUserGeminiApiKey] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobileSettingsFabOpen, setIsMobileSettingsFabOpen] = useState(false);
  const [showApiKeyInSettings, setShowApiKeyInSettings] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gemini-3.5-flash");
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [codeViewModes, setCodeViewModes] = useState<Record<string, "code" | "diff">>({});
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const [sessionTokenUsage, setSessionTokenUsage] = useState<{
    promptTokens: number;
    candidatesTokens: number;
    totalTokens: number;
  } | null>(null);

  // API Key States
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [generatedKeyDetails, setGeneratedKeyDetails] = useState<ApiKey | null>(null);
  const [visibleKeyIds, setVisibleKeyIds] = useState<Record<string, boolean>>({});
  const [copySuccessId, setCopySuccessId] = useState<string | null>(null);

  // Supabase Database Sync States
  const [supabaseStatus, setSupabaseStatus] = useState<"loading" | "connected" | "needs_config" | "needs_table" | "error">("loading");
  const [supabaseSql, setSupabaseSql] = useState<string>("");
  const [supabaseErrorMsg, setSupabaseErrorMsg] = useState<string>("");

  // Copy SQL helper state
  const [copySqlSuccess, setCopySqlSuccess] = useState(false);

  // Pinecone Integration States
  const [pineconeSyncing, setPineconeSyncing] = useState(false);
  const [pineconeLogs, setPineconeLogs] = useState<string[]>([]);
  const [pineconeStatus, setPineconeStatus] = useState<"idle" | "success" | "error" | "needs_config">("idle");

  // Library & Knowledge Base States
  const [libraryItems, setLibraryItems] = useState<any[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [librarySearchQuery, setLibrarySearchQuery] = useState("");
  const [librarySearchResults, setLibrarySearchResults] = useState<any[]>([]);
  const [librarySearchLoading, setLibrarySearchLoading] = useState(false);
  const [newSnippetFilename, setNewSnippetFilename] = useState("");
  const [newSnippetCategory, setNewSnippetCategory] = useState("TypeScript");
  const [newSnippetContent, setNewSnippetContent] = useState("");
  const [isAddingSnippet, setIsAddingSnippet] = useState(false);
  const [activeLibraryPreviewItem, setActiveLibraryPreviewItem] = useState<any | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});

  // Codebase / Zip Extraction State
  const [attachedZip, setAttachedZip] = useState<ExtractedCodebase | null>(null);
  const [isExtractingZip, setIsExtractingZip] = useState(false);
  const [zipExtractionProgress, setZipExtractionProgress] = useState("");
  const [isZipFilesModalOpen, setIsZipFilesModalOpen] = useState(false);
  const [selectedModalFile, setSelectedModalFile] = useState<ExtractedCodeFile | null>(null);
  const zipFileInputRef = useRef<HTMLInputElement>(null);

  // Multimodal Vision / Multi-Image Upload State (Up to 10 images)
  const [selectedImages, setSelectedImages] = useState<AttachedImage[]>([]);
  const [previewModalImage, setPreviewModalImage] = useState<AttachedImage | { dataUrl: string; fileName: string } | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Dynamic AI Action Status Indicator (Google AI Studio style)
  const [aiActionStatus, setAiActionStatus] = useState<string | null>(null);

  // Progressive Web App (PWA) Install Context Hook
  const { isInstallable, isInstalled, promptInstall } = usePWA();

  // Auto scroll ref for messages
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Prompt templates for developers
  const promptStarters = [
    { text: "Create a TypeScript debounce utility", label: "TypeScript" },
    { text: "Explain JavaScript closure with clean code", label: "Closure" },
    { text: "Write a responsive bento grid in Tailwind", label: "CSS Layout" },
    { text: "Draft an Express JS authorization middleware", label: "Express" }
  ];

  // Handle Multimodal Image Upload (supports multiple images, max 10)
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const filesList = e.target.files;
    if (!filesList || filesList.length === 0) return;
    const rawFiles = Array.from(filesList);

    // Capacity validation (Max 10 images)
    const currentCount = selectedImages.length;
    const availableSlots = 10 - currentCount;

    if (availableSlots <= 0) {
      alert("You can upload a maximum of 10 images at once.");
      if (imageInputRef.current) imageInputRef.current.value = "";
      return;
    }

    let filesToProcess = rawFiles;
    if (rawFiles.length > availableSlots) {
      alert(`You can upload a maximum of 10 images at once. Only the first ${availableSlots} images will be added.`);
      filesToProcess = rawFiles.slice(0, availableSlots);
    }

    // Filter valid image extensions and sizes
    const validExtensions = [".png", ".jpg", ".jpeg", ".webp"];
    const validFiles: File[] = [];

    for (const file of filesToProcess) {
      const isExtensionValid = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
      const isMimeValid = ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type.toLowerCase());

      if (!isExtensionValid && !isMimeValid) {
        alert(`Skipped "${file.name}": Unsupported format. Please upload .png, .jpg, .jpeg, or .webp.`);
        continue;
      }

      if (file.size > 10 * 1024 * 1024) {
        alert(`Skipped "${file.name}": File size exceeds 10MB limit.`);
        continue;
      }

      validFiles.push(file);
    }

    if (validFiles.length === 0) {
      if (imageInputRef.current) imageInputRef.current.value = "";
      return;
    }

    setAiActionStatus("🖼️ Processing images...");

    try {
      const processed = await Promise.all(
        validFiles.map((file) => {
          return new Promise<AttachedImage>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const dataUrl = reader.result as string;
              const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
              const mimeType = file.type || (file.name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");

              resolve({
                dataUrl,
                base64,
                mimeType,
                fileName: file.name,
                sizeKb: Math.round(file.size / 1024)
              });
            };
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(file);
          });
        })
      );

      setSelectedImages(prev => {
        const combined = [...prev, ...processed];
        return combined.slice(0, 10);
      });
    } catch (err) {
      console.error("Error reading image files:", err);
      alert("Failed to process some image files. Please try again.");
    } finally {
      setAiActionStatus(null);
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
    }
  };

  // Remove individual image from selection
  const handleRemoveImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  // Clear all selected images
  const handleClearImages = () => {
    setSelectedImages([]);
  };

  // Handle Zip / Code file upload
  const handleZipFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    try {
      setIsExtractingZip(true);
      setZipExtractionProgress("Preparing file...");
      
      if (file.name.toLowerCase().endsWith(".zip")) {
        setAiActionStatus("📦 Processing ZIP file...");
        const extracted = await processZipFile(file, (totalCount) => {
          setZipExtractionProgress(`Processed ${totalCount} files`);
          setAiActionStatus(`📦 Processed ${totalCount} files...`);
        });
        setAttachedZip(extracted);
        setAiActionStatus(`📦 Processed ${extracted.totalFiles} files...`);
        setTimeout(() => {
          setAiActionStatus(null);
        }, 4000);
        if (extracted.files.length > 0) {
          setSelectedModalFile(extracted.files[0]);
        }
      } else {
        setAiActionStatus("📂 Reading file...");
        const single = await processSingleFile(file);
        setAttachedZip(single);
        setAiActionStatus(`📦 Processed ${single.totalFiles} files...`);
        setTimeout(() => {
          setAiActionStatus(null);
        }, 3000);
        if (single.files.length > 0) {
          setSelectedModalFile(single.files[0]);
        }
      }
    } catch (err: any) {
      console.error("Codebase extraction error:", err);
      setAiActionStatus(null);
      alert("Failed to process code file or zip archive: " + (err?.message || "Unknown error"));
    } finally {
      setIsExtractingZip(false);
      setZipExtractionProgress("");
      if (zipFileInputRef.current) {
        zipFileInputRef.current.value = "";
      }
    }
  };

  // Save a single chat message to Supabase chat_messages table
  const saveChatMessageToSupabase = async (
    sessionId: string,
    role: "user" | "model",
    content: string,
    msgId?: string
  ) => {
    try {
      await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          role,
          content,
          id: msgId,
        }),
      });
    } catch (err) {
      console.warn("Notice: Failed to insert message to Supabase chat_messages", err);
    }
  };

  // Fetch individual messages for a session from Supabase chat_messages table (ordered by created_at ASC)
  const fetchSessionMessagesFromSupabase = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/chat/messages?sessionId=${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.messages) && data.messages.length > 0) {
          setChats((prev) =>
            prev.map((c) => {
              if (c.id === sessionId) {
                return {
                  ...c,
                  messages: data.messages,
                };
              }
              return c;
            })
          );
          return;
        }
      }
      // Fallback to sessions endpoint if messages table doesn't have rows
      const sessionRes = await fetch(`/api/chat/sessions?sessionId=${sessionId}`);
      if (sessionRes.ok) {
        const sData = await sessionRes.json();
        if (sData.success && sData.session && Array.isArray(sData.session.messages) && sData.session.messages.length > 0) {
          setChats((prev) =>
            prev.map((c) => {
              if (c.id === sessionId) {
                return {
                  ...c,
                  title: sData.session.title || c.title,
                  messages: sData.session.messages,
                };
              }
              return c;
            })
          );
        }
      }
    } catch (err) {
      console.warn("Notice: Loaded chat from local cache", err);
    }
  };

  // Select Chat Session with Full Infinite Memory Fetch from Supabase
  const handleSelectChatSession = async (chatId: string) => {
    setActiveChatId(chatId);
    setActiveTab("chat");
    setSidebarOpen(false);
    await fetchSessionMessagesFromSupabase(chatId);
  };

  // Fetch API Keys from Supabase or load from local storage if connection not ready
  const fetchSupabaseKeys = async () => {
    try {
      setSupabaseStatus("loading");
      const res = await fetch("/api/keys");
      
      let result: any = {};
      try {
        result = await res.json();
      } catch (jsonErr) {
        throw new Error(`Invalid server response (Status ${res.status})`);
      }
      
      if (result.status === "needs_config") {
        setSupabaseStatus("needs_config");
        const savedKeys = localStorage.getItem("ai_platform_api_keys");
        if (savedKeys) {
          setApiKeys(JSON.parse(savedKeys));
        } else {
          // Seed an example key
          const initialKey: ApiKey = {
            id: "key-init-1",
            name: "Development Workspace",
            key: "sys_ai_5f7e8a9bc0d1e2f3a4b5c6d7e8f9",
            created: getFormattedDate(),
            status: "active"
          };
          setApiKeys([initialKey]);
        }
      } else if (result.status === "needs_table") {
        setSupabaseStatus("needs_table");
        setSupabaseSql(result.sql);
        const savedKeys = localStorage.getItem("ai_platform_api_keys");
        if (savedKeys) {
          setApiKeys(JSON.parse(savedKeys));
        } else {
          // Seed an example key
          const initialKey: ApiKey = {
            id: "key-init-1",
            name: "Development Workspace",
            key: "sys_ai_5f7e8a9bc0d1e2f3a4b5c6d7e8f9",
            created: getFormattedDate(),
            status: "active"
          };
          setApiKeys([initialKey]);
        }
      } else if (result.status === "success") {
        setSupabaseStatus("connected");
        setApiKeys(result.data || []);
      } else {
        setSupabaseStatus("error");
        setSupabaseErrorMsg(result.error || "Failed to load keys from Supabase.");
        const savedKeys = localStorage.getItem("ai_platform_api_keys");
        if (savedKeys) {
          setApiKeys(JSON.parse(savedKeys));
        } else {
          // Seed an example key
          const initialKey: ApiKey = {
            id: "key-init-1",
            name: "Development Workspace",
            key: "sys_ai_5f7e8a9bc0d1e2f3a4b5c6d7e8f9",
            created: getFormattedDate(),
            status: "active"
          };
          setApiKeys([initialKey]);
        }
      }
    } catch (err: any) {
      console.error(err);
      setSupabaseStatus("error");
      setSupabaseErrorMsg(err.message || "An error occurred.");
      const savedKeys = localStorage.getItem("ai_platform_api_keys");
      if (savedKeys) {
        setApiKeys(JSON.parse(savedKeys));
      } else {
        // Seed an example key
        const initialKey: ApiKey = {
          id: "key-init-1",
          name: "Development Workspace",
          key: "sys_ai_5f7e8a9bc0d1e2f3a4b5c6d7e8f9",
          created: getFormattedDate(),
          status: "active"
        };
        setApiKeys([initialKey]);
      }
    }
  };

  // Save chat to Supabase background helper
  const saveChatToSupabase = async (chatSession: ChatSession) => {
    try {
      await fetch("/api/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: chatSession.id,
          title: chatSession.title,
          messages: chatSession.messages
        })
      });
    } catch (err) {
      console.warn("Notice: Failed to sync chat session to Supabase, local cache retained", err);
    }
  };

  // Fetch Chat Sessions from Supabase
  const fetchSupabaseChats = async () => {
    try {
      const res = await fetch("/api/chat/sessions");
      const data = await res.json();
      if (data.success && !data.useLocalFallback && data.sessions && data.sessions.length > 0) {
        const formatted: ChatSession[] = data.sessions.map((s: any) => ({
          id: s.id,
          title: s.title,
          created: s.created_at ? new Date(s.created_at).toLocaleDateString() : getFormattedDate(),
          messages: s.messages || []
        }));
        setChats(formatted);
        const savedActiveChatId = localStorage.getItem("ai_platform_active_chat_id");
        const activeToLoad = (savedActiveChatId && formatted.some(c => c.id === savedActiveChatId))
          ? savedActiveChatId
          : formatted[0].id;
        setActiveChatId(activeToLoad);
        fetchSessionMessagesFromSupabase(activeToLoad);
      }
    } catch (err) {
      console.warn("Could not fetch remote chats, keeping local cache", err);
    }
  };

  // Hydration & Initial State Load
  useEffect(() => {
    // Defer setting initial states and mounted flag to prevent React 19 synchronous effect render warning
    const rId = requestAnimationFrame(() => {
      // Fetch keys, chats, and library from Supabase
      fetchSupabaseKeys();
      fetchSupabaseChats();
      fetchLibraryItems();

      // Load user Gemini API key for BYOK & selected model
      const savedUserKey = localStorage.getItem("user_gemini_api_key");
      if (savedUserKey) {
        setUserGeminiApiKey(savedUserKey);
      }

      const savedModel = localStorage.getItem("user_gemini_model");
      if (savedModel) {
        setSelectedModel(savedModel);
      }

      // Load state from localStorage
      const savedTheme = localStorage.getItem("ai_platform_theme") as "light" | "dark" | null;
      if (savedTheme) {
        setTheme(savedTheme);
      } else {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        setTheme(prefersDark ? "dark" : "light");
      }

      const savedChats = localStorage.getItem("ai_platform_chats");
      const savedActiveChatId = localStorage.getItem("ai_platform_active_chat_id");

      if (savedChats) {
        const parsedChats = JSON.parse(savedChats);
        setChats(parsedChats);
        const activeId = (savedActiveChatId && parsedChats.some((c: ChatSession) => c.id === savedActiveChatId))
          ? savedActiveChatId
          : (parsedChats.length > 0 ? parsedChats[0].id : null);
        if (activeId) {
          setActiveChatId(activeId);
          fetchSessionMessagesFromSupabase(activeId);
        }
      } else {
        // Seed default welcome chat
        const defaultChatId = "welcome-chat";
        const welcomeChat: ChatSession = {
          id: defaultChatId,
          title: "Welcome to AI Coding Assistant",
          created: getFormattedDate(),
          messages: [
            {
              id: generateUUID(),
              role: "assistant",
              content: `Hello! I am your AI Coding Assistant platform companion. I can help you draft algorithms, explain complex programming paradigms, and refactor existing code bases with precision.

You can interact with me through this chat interface or navigate to the **API Keys** section to generate developer tokens for your services. 

What are we coding today?`,
              timestamp: getFormattedTime()
            }
          ]
        };
        setChats([welcomeChat]);
        setActiveChatId(defaultChatId);
      }

      setMounted(true);
    });

    // Global Keyboard Shortcuts (Cmd/Ctrl+K, Cmd/Ctrl+N, Escape)
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setActiveTab("chat");
        const textarea = document.getElementById("chat-input-textarea") as HTMLTextAreaElement;
        if (textarea) textarea.focus();
      }
      if (isCmdOrCtrl && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        // Trigger new chat
        const newId = generateUniqueId("chat");
        const newChatObj: ChatSession = {
          id: newId,
          title: "New Chat Session",
          created: getFormattedDate(),
          messages: []
        };
        setChats(prev => [newChatObj, ...prev]);
        setActiveChatId(newId);
        setActiveTab("chat");
      }
      if (e.key === 'Escape') {
        setIsSettingsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);

    return () => {
      cancelAnimationFrame(rId);
    };
  }, []);

  // Save changes to localStorage when state updates
  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem("ai_platform_theme", theme);
  }, [theme, mounted]);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem("ai_platform_chats", JSON.stringify(chats));
  }, [chats, mounted]);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem("ai_platform_active_chat_id", activeChatId || "");
  }, [activeChatId, mounted]);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem("ai_platform_api_keys", JSON.stringify(apiKeys));
  }, [apiKeys, mounted]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChatId, chats]);

  // Trigger copy success indicator
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccessId(id);
    setTimeout(() => {
      setCopySuccessId(null);
    }, 2000);
  };

  // Toggle single key visibility
  const toggleKeyVisibility = (keyId: string) => {
    setVisibleKeyIds(prev => ({
      ...prev,
      [keyId]: !prev[keyId]
    }));
  };

  // Mask Key Generator helper
  const maskKey = (key: string, isVisible: boolean) => {
    if (isVisible) return key;
    const prefix = key.substring(0, 10);
    const suffix = key.substring(key.length - 4);
    return `${prefix}••••••••••••••••••••${suffix}`;
  };

  // Handle New Chat Generation
  const handleNewChat = () => {
    const newId = generateUniqueId("chat");
    const newChat: ChatSession = {
      id: newId,
      title: "New Chat Session",
      created: getFormattedDate(),
      messages: []
    };
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(newId);
    setActiveTab("chat");
    setSidebarOpen(false);
    saveChatToSupabase(newChat);
  };

  // Handle Rename Chat
  const handleRenameChat = async (chatId: string, newTitle: string) => {
    if (!newTitle.trim()) {
      setEditingChatId(null);
      return;
    }
    const trimmed = newTitle.trim();
    const updated = chats.map(c => c.id === chatId ? { ...c, title: trimmed } : c);
    setChats(updated);
    setEditingChatId(null);
    try {
      await fetch(`/api/chat/sessions/${chatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed })
      });
    } catch (err) {
      console.error("Supabase rename chat error:", err);
    }
  };

  // Handle Export Chat to JSON or Markdown
  const handleExportChat = (format: "json" | "md" = "md") => {
    setIsExportDropdownOpen(false);
    if (!activeChat || activeChat.messages.length === 0) return;

    let content = "";
    let mimeType = "text/plain;charset=utf-8";
    let extension = format;

    if (format === "json") {
      mimeType = "application/json;charset=utf-8";
      const exportData = {
        title: activeChat.title,
        id: activeChat.id,
        created: activeChat.created,
        exportedAt: new Date().toISOString(),
        model: selectedModel,
        messageCount: activeChat.messages.length,
        messages: activeChat.messages.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
          sourceType: m.sourceType || undefined,
          sources: m.sources || undefined,
          usage: m.usage || undefined
        }))
      };
      content = JSON.stringify(exportData, null, 2);
    } else {
      mimeType = "text/markdown;charset=utf-8";
      const mdLines = [
        `# ${activeChat.title}`,
        `**Session ID**: \`${activeChat.id}\`  `,
        `**Created**: ${activeChat.created}  `,
        `**Model**: \`${selectedModel}\`  `,
        `**Exported**: ${new Date().toLocaleString()}  `,
        `\n---\n`
      ];

      activeChat.messages.forEach((msg, idx) => {
        const sender = msg.role === "user" ? "🧑‍💻 User" : "🤖 Nexa Assistant";
        mdLines.push(`### ${idx + 1}. ${sender} *(${msg.timestamp})*\n`);
        mdLines.push(msg.content);
        if (msg.sourceType) {
          mdLines.push(`\n*Source: ${msg.sourceType}*`);
        }
        mdLines.push(`\n---\n`);
      });

      content = mdLines.join("\n");
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `nexa-chat-${activeChat.id}-${Date.now()}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Handle Delete Chat
  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = chats.filter(c => c.id !== chatId);
    setChats(updated);
    if (activeChatId === chatId) {
      if (updated.length > 0) {
        setActiveChatId(updated[0].id);
      } else {
        setActiveChatId(null);
      }
    }
    try {
      await fetch(`/api/chat/sessions/${chatId}`, {
        method: "DELETE"
      });
    } catch (err) {
      console.error("Supabase delete chat error:", err);
    }
  };

  // Handle Save BYOK Settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userGeminiApiKey.trim()) return;
    localStorage.setItem("user_gemini_api_key", userGeminiApiKey.trim());
    localStorage.setItem("user_gemini_model", selectedModel);
    setIsSettingsOpen(false);
  };

  // Handle Clear BYOK Settings
  const handleClearSettings = () => {
    localStorage.removeItem("user_gemini_api_key");
    setUserGeminiApiKey("");
  };

  // Handle Send Message
  const handleSendMessage = async (customText?: string) => {
    const rawText = customText !== undefined ? customText : inputValue;
    const hasImages = selectedImages.length > 0;
    const textToSend = rawText.trim() || (hasImages ? (selectedImages.length === 1 ? "Analyze this image and explain what is depicted or provide code/solutions." : `Analyze these ${selectedImages.length} images and explain what is depicted or compare and extract details.`) : "");
    if ((!textToSend.trim() && !hasImages) || isSending) return;

    // Check for Bring Your Own Key (BYOK) - gracefully fallback to server key if empty
    const userApiKey = localStorage.getItem("user_gemini_api_key") || "";

    const currentChatId = activeChatId || generateUniqueId("chat");

    if (!activeChatId) {
      // Automatically create a new chat if none exists
      const newChat: ChatSession = {
        id: currentChatId,
        title: textToSend.substring(0, 32) + (textToSend.length > 32 ? "..." : ""),
        created: getFormattedDate(),
        messages: []
      };
      setChats([newChat]);
      setActiveChatId(currentChatId);
    }

    const targetChat = chats.find(c => c.id === currentChatId);
    if (!targetChat) return;

    const currentAttachedZip = attachedZip;
    const currentAttachedImages = [...selectedImages];

    const userMsgId = generateUUID();
    const userMsg: Message = {
      id: userMsgId,
      role: "user",
      content: textToSend,
      attachedZip: currentAttachedZip ? {
        fileName: currentAttachedZip.fileName,
        totalFiles: currentAttachedZip.totalFiles,
        totalSizeKb: currentAttachedZip.totalSizeKb
      } : undefined,
      attachedImages: currentAttachedImages.length > 0 ? currentAttachedImages.map(img => ({
        dataUrl: img.dataUrl,
        fileName: img.fileName,
        mimeType: img.mimeType,
        sizeKb: img.sizeKb
      })) : undefined,
      attachedImage: currentAttachedImages.length === 1 ? {
        dataUrl: currentAttachedImages[0].dataUrl,
        fileName: currentAttachedImages[0].fileName,
        mimeType: currentAttachedImages[0].mimeType
      } : undefined,
      timestamp: getFormattedTime()
    };

    // Update active chat title if it was default "New Chat Session"
    const newTitle = targetChat.title === "New Chat Session" 
      ? textToSend.substring(0, 32) + (textToSend.length > 32 ? "..." : "")
      : targetChat.title;

    const isFirstUserMessage = targetChat.messages.filter(m => m.role === "user").length === 0;

    const updatedMessages = [...targetChat.messages, userMsg];

    // Optimistic UI updates
    const userUpdatedChat: ChatSession = {
      ...targetChat,
      title: newTitle,
      messages: updatedMessages
    };

    setChats(prev => prev.map(c => {
      if (c.id === currentChatId) {
        return userUpdatedChat;
      }
      return c;
    }));

    // Save both granular chat message row and session state
    const supabaseMsgText = currentAttachedImages.length > 0 
      ? `${textToSend}\n\n[${currentAttachedImages.length} Image${currentAttachedImages.length > 1 ? "s" : ""} Attached: ${currentAttachedImages.map(img => img.fileName).join(", ")}]`
      : textToSend;
    saveChatMessageToSupabase(currentChatId, "user", supabaseMsgText, userMsgId);
    saveChatToSupabase(userUpdatedChat);

    setInputValue("");
    setAttachedZip(null); // Reset attachment once staged in message
    setSelectedImages([]); // Reset images once staged in message
    setIsSending(true);
    setChatError(null);
    if (currentAttachedZip) {
      setAiActionStatus("Inspecting files and context");
    } else if (currentAttachedImages.length > 0) {
      setAiActionStatus("Analyzing visual data");
    } else {
      setAiActionStatus("Thinking");
    }

    // Asynchronously generate concise auto-title for the session if this is the first message
    if (isFirstUserMessage) {
      fetch("/api/chat/title", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-goog-api-key": userApiKey,
          "x-gemini-api-key": userApiKey
        },
        body: JSON.stringify({ 
          message: textToSend,
          apiKey: userApiKey
        })
      })
      .then(res => res.json())
      .then(titleData => {
        if (titleData.title && typeof titleData.title === "string") {
          const generatedTitle = titleData.title.trim();
          if (generatedTitle) {
            setChats(prev => prev.map(c => {
              if (c.id === currentChatId) {
                const updatedSession = { ...c, title: generatedTitle };
                saveChatToSupabase(updatedSession);
                return updatedSession;
              }
              return c;
            }));
          }
        }
      })
      .catch(err => {
        console.warn("Auto-title generation failed silently, keeping fallback title:", err);
      });
    }

    // Format full multi-turn conversation history for Gemini API with codebase & image attachments
    const messagesPayload = updatedMessages.map((msg, idx) => {
      const isLast = idx === updatedMessages.length - 1;
      let content = msg.content;
      if (isLast && currentAttachedZip) {
        content = `${content}\n\n${currentAttachedZip.formattedContext}`;
      }
      
      const payloadItem: any = {
        role: msg.role,
        content: content
      };

      if (isLast && currentAttachedImages.length > 0) {
        payloadItem.images = currentAttachedImages.map(img => ({
          data: img.base64,
          mimeType: img.mimeType
        }));
      } else if (msg.attachedImages && msg.attachedImages.length > 0) {
        payloadItem.images = msg.attachedImages.map(img => ({
          data: img.dataUrl.includes(",") ? img.dataUrl.split(",")[1] : img.dataUrl,
          mimeType: img.mimeType || "image/jpeg"
        }));
      } else if (msg.attachedImage?.dataUrl) {
        payloadItem.image = {
          data: msg.attachedImage.dataUrl.includes(",") ? msg.attachedImage.dataUrl.split(",")[1] : msg.attachedImage.dataUrl,
          mimeType: msg.attachedImage.mimeType || "image/jpeg"
        };
      }

      return payloadItem;
    });

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${userApiKey}`,
          "x-goog-api-key": userApiKey,
          "x-gemini-api-key": userApiKey
        },
        body: JSON.stringify({ 
          messages: messagesPayload,
          images: currentAttachedImages.length > 0 ? currentAttachedImages.map(img => ({
            data: img.base64,
            mimeType: img.mimeType
          })) : undefined,
          isThinking,
          isDeepResearch,
          model: selectedModel,
          apiKey: userApiKey,
          userApiKey: userApiKey
        }),
      });

      if (!response.ok) {
        const rawText = await response.text();
        let errorData = "";
        try {
          const parsed = JSON.parse(rawText);
          errorData = parsed.error || `Failed to receive response from assistant (Status ${response.status})`;
        } catch {
          errorData = `Server Error (${response.status}): Backend failed to return valid JSON. Check your backend logs or Gemini API key.`;
        }
        throw new Error(errorData);
      }

      if (!response.body) throw new Error("No response stream");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      
      let assistantText = "";
      let finalUsage = null;
      let finalSources = null;
      let finalSourceType = null;
      
      const assistantMsgId = generateUUID();
      const assistantMsg: Message = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        timestamp: getFormattedTime()
      };
      
      setChats(prev => prev.map(c => {
        if (c.id === currentChatId) {
          return { ...c, messages: [...c.messages, assistantMsg] };
        }
        return c;
      }));

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // When stream from Gemini starts receiving chunks
        setAiActionStatus("Generating response");

        buffer += decoder.decode(value, { stream: true });
        
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        
        for (const rawLine of lines) {
           let line = rawLine.trim();
           if (!line) continue;
           // Support standard Server-Sent Events (SSE) data: prefix
           if (line.startsWith("data:")) {
             line = line.slice(5).trim();
           }
           if (!line) continue;

           try {
             const data = JSON.parse(line);
             if (data.error) throw new Error(data.error);
             if (data.text) {
               assistantText += data.text;
               setAiActionStatus("Generating response");
             }
             if (data.done) {
                finalUsage = data.usage;
                finalSources = data.sources;
                finalSourceType = data.sourceType;
             }
           } catch (parseErr) {
             if (parseErr instanceof Error && parseErr.message !== "Unexpected end of JSON input") {
                throw parseErr;
             }
           }
        }
        
        // Render updated stream content immediately on each chunk
        setChats(prev => prev.map(c => {
           if (c.id === currentChatId) {
              const updatedSessionMsgs = c.messages.map(m => m.id === assistantMsg.id ? { ...m, content: assistantText } : m);
              return { ...c, messages: updatedSessionMsgs };
           }
           return c;
        }));
      }

      // Stream fully completed
      setAiActionStatus(null);

      if (finalUsage && finalUsage.totalTokens > 0) {
        setSessionTokenUsage({
          promptTokens: finalUsage.promptTokens || 0,
          candidatesTokens: finalUsage.candidatesTokens || 0,
          totalTokens: finalUsage.totalTokens || 0
        });
      }

      setChats(prev => prev.map(c => {
        if (c.id === currentChatId) {
          const finalSuccessChat: ChatSession = {
            ...c,
            messages: c.messages.map(m => m.id === assistantMsg.id ? { 
              ...m, 
              content: assistantText, 
              sources: finalSources, 
              sourceType: finalSourceType, 
              usage: finalUsage 
            } : m),
            lastUsage: finalUsage
          };
          // Persist the completed model response to chat_messages table and sync session
          saveChatMessageToSupabase(currentChatId, "model", assistantText, assistantMsgId);
          saveChatToSupabase(finalSuccessChat);
          return finalSuccessChat;
        }
        return c;
      }));
    } catch (err: any) {
      console.error(err);
      setAiActionStatus(null);
      const errMessage = err.message || "An unexpected error occurred.";
      const isAuthError = errMessage.toLowerCase().includes("api key") || errMessage.toLowerCase().includes("authentication") || errMessage.toLowerCase().includes("401") || errMessage.toLowerCase().includes("403");

      setChatError(errMessage);

      let formattedErrorContent = errMessage;
      if (isAuthError) {
        formattedErrorContent = `⚠️ **Authentication Error**: ${errMessage}\n\nPlease ensure your personal Gemini API Key is configured correctly in the **BYOK Settings** Modal.`;
      } else {
        formattedErrorContent = `${errMessage}`;
      }

      const errorSystemMsg: Message = {
        id: generateUniqueId("msg-error"),
        role: "assistant",
        content: formattedErrorContent,
        timestamp: getFormattedTime()
      };

      const finalErrorChat: ChatSession = {
        ...targetChat,
        title: newTitle,
        messages: [...updatedMessages, errorSystemMsg]
      };

      setChats(prev => prev.map(c => {
        if (c.id === currentChatId) {
          return finalErrorChat;
        }
        return c;
      }));

      saveChatToSupabase(finalErrorChat);
    } finally {
      setIsSending(false);
      setAiActionStatus(null);
    }
  };

  // Generate Key API Handler
  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    setIsGeneratingKey(true);

    try {
      if (supabaseStatus === "connected") {
        const response = await fetch("/api/keys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newKeyName })
        });
        const result = await response.json();
        if (result.status === "success") {
          const savedKey = result.data;
          setApiKeys(prev => {
            const updated = [savedKey, ...prev];
            localStorage.setItem("ai_platform_api_keys", JSON.stringify(updated));
            return updated;
          });
          setGeneratedKeyDetails(savedKey);
        } else {
          throw new Error(result.error || "Failed to generate key");
        }
      } else {
        // Fallback for local mode if Supabase is not connected
        const tempId = generateUniqueId("key");
        const tempKey = `sys_ai_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
        const newKey: ApiKey = {
          id: tempId,
          name: newKeyName,
          key: tempKey,
          created: getFormattedDate(),
          status: "active"
        };
        setApiKeys(prev => {
          const updated = [newKey, ...prev];
          localStorage.setItem("ai_platform_api_keys", JSON.stringify(updated));
          return updated;
        });
        setGeneratedKeyDetails(newKey);
      }
    } catch (err: any) {
      console.error("Key generation error:", err);
      alert("Error: " + (err.message || "Failed to generate key"));
    } finally {
      setIsGeneratingKey(false);
      setNewKeyName("");
    }
  };

  // Revoke Key Handler
  const handleRevokeKey = async (keyId: string) => {
    // Optimistic state update
    setApiKeys(prev => {
      const updated = prev.map(k => k.id === keyId ? { ...k, status: "revoked" as const } : k);
      localStorage.setItem("ai_platform_api_keys", JSON.stringify(updated));
      return updated;
    });

    if (supabaseStatus === "connected") {
      try {
        const response = await fetch("/api/keys/revoke", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: keyId })
        });
        const result = await response.json();
        if (result.status !== "success") {
          console.error("Supabase revocation error:", result.error);
        }
      } catch (err) {
        console.error("Supabase revocation connection error:", err);
      }
    }
  };

  // Pinecone Knowledge Base Embedding Sync Handler
  const handlePineconeSync = async () => {
    try {
      setPineconeSyncing(true);
      setPineconeStatus("idle");
      setPineconeLogs(["📡 Connecting to synchronization server...", "🚀 Sync routine started..."]);

      const response = await fetch("/api/pinecone/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      const result = await response.json();

      if (result.logs) {
        setPineconeLogs(result.logs);
      }

      if (result.status === "needs_config") {
        setPineconeStatus("needs_config");
      } else if (result.status === "success") {
        setPineconeStatus("success");
      } else {
        setPineconeStatus("error");
      }
    } catch (err: any) {
      console.error(err);
      setPineconeStatus("error");
      setPineconeLogs(prev => [
        ...prev,
        `❌ System Error: Connection failed. ${err.message || err}`
      ]);
    } finally {
      setPineconeSyncing(false);
    }
  };

  // Fetch Library Items Catalog
  const fetchLibraryItems = async () => {
    try {
      setLibraryLoading(true);
      const res = await fetch("/api/library");
      
      let data: any = {};
      try {
        data = await res.json();
      } catch (jsonErr) {
        throw new Error(`Invalid library response (Status ${res.status})`);
      }
      
      if (data.success) {
        setLibraryItems(data.items);
      }
    } catch (err) {
      console.warn("Error fetching library items:", err);
    } finally {
      setLibraryLoading(false);
    }
  };

  // Add Snippet to Knowledge Folder & Metadata Database (Supabase Global Library)
  const handleAddSnippet = async (filename: string, category: string, content: string, fileType?: string) => {
    if (!filename || !content) return;
    try {
      setIsAddingSnippet(true);
      setAiActionStatus("💾 Saving file to Global Library...");
      const res = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_snippet",
          title: filename,
          filename,
          category,
          content,
          file_type: fileType || (filename.endsWith(".json") ? "application/json" : filename.endsWith(".md") ? "text/markdown" : "text/plain")
        })
      });
      let data: any = {};
      try {
        data = await res.json();
      } catch (jsonErr) {
        throw new Error(`Invalid response when adding snippet (Status ${res.status})`);
      }
      
      if (data.success) {
        setAiActionStatus("✅ File permanently saved to Supabase Global Library");
        setTimeout(() => setAiActionStatus(null), 3000);
        await fetchLibraryItems();
        setNewSnippetFilename("");
        setNewSnippetContent("");
      } else {
        setAiActionStatus(null);
        alert("Error adding snippet: " + (data.error || "Failed to save"));
      }
    } catch (err) {
      setAiActionStatus(null);
      console.warn("Error adding library item:", err);
    } finally {
      setIsAddingSnippet(false);
    }
  };

  // Search Library Documents with Pinecone Vector or Keyword Fallback
  const handleLibrarySearch = async (query: string) => {
    setLibrarySearchQuery(query);
    if (!query.trim()) {
      setLibrarySearchResults([]);
      return;
    }
    try {
      setLibrarySearchLoading(true);
      const res = await fetch("/api/library/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
      });
      let data: any = {};
      try {
        data = await res.json();
      } catch (jsonErr) {
        throw new Error(`Invalid response when searching library (Status ${res.status})`);
      }
      
      if (data.success) {
        setLibrarySearchResults(data.matches);
      }
    } catch (err) {
      console.warn("Error searching library:", err);
    } finally {
      setLibrarySearchLoading(false);
    }
  };

  // Read Local Files and Ingest via client-side FileReader
  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    
    try {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const text = evt.target?.result as string;
        if (text) {
          let cat = "General Documentation";
          let fileType = file.type || "text/plain";
          if (file.name.endsWith(".ts") || file.name.endsWith(".tsx")) { cat = "TypeScript"; fileType = "application/typescript"; }
          else if (file.name.endsWith(".js") || file.name.endsWith(".jsx")) { cat = "JavaScript"; fileType = "application/javascript"; }
          else if (file.name.endsWith(".css")) { cat = "CSS Layout"; fileType = "text/css"; }
          else if (file.name.endsWith(".json")) { cat = "JSON Config"; fileType = "application/json"; }
          else if (file.name.endsWith(".md")) { cat = "Markdown"; fileType = "text/markdown"; }

          await handleAddSnippet(file.name, cat, text, fileType);
        }
      };
      reader.readAsText(file);
    } catch (err) {
      console.warn("File reading failed:", err);
    } finally {
      setIsUploading(false);
    }
  };

  if (!mounted) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#FBF9F6] text-neutral-800">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-amber-800" />
          <p className="text-sm font-medium">Initializing AI Studio workspace...</p>
        </div>
      </div>
    );
  }

  const activeChat = chats.find(c => c.id === activeChatId);

  return (
    <div id="ai-platform-root" className={`${theme === "dark" ? "dark bg-neutral-950 text-neutral-100" : "bg-[#F9F7F3] text-neutral-800"} flex h-screen overflow-hidden font-sans transition-colors duration-200`}>
      
      {/* 1. SIDEBAR (Claude style, clean list and navigation) */}
      <aside 
        id="sidebar"
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-neutral-200/60 dark:border-neutral-800/60 bg-[#F5F2EC] dark:bg-neutral-900/90 transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand / Logo Header */}
        <div className="flex items-center justify-between p-5 border-b border-neutral-200/40 dark:border-neutral-800/40">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-900/10 dark:bg-amber-100/10 text-amber-800 dark:text-amber-300">
              <Terminal className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-amber-900 dark:text-amber-100">
                Play Nexa AI
              </h1>
              <p className="text-[10px] text-neutral-500 font-mono tracking-wider uppercase">Claude-like Assistant</p>
            </div>
          </div>
          <button 
            id="close-sidebar-button"
            onClick={() => setSidebarOpen(false)} 
            className="rounded-md p-1.5 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Action Button: New Chat */}
        <div className="px-4 py-4">
          <button
            id="new-chat-button"
            onClick={handleNewChat}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-900/10 hover:bg-amber-900/15 dark:bg-amber-100/10 dark:hover:bg-amber-100/15 px-4 py-3 text-sm font-semibold text-amber-950 dark:text-amber-100 border border-amber-900/15 dark:border-amber-100/15 transition-all duration-200 active:scale-[0.98] shadow-xs cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            New Chat
          </button>
        </div>

        {/* Conversational History List */}
        <div className="flex-1 overflow-y-auto px-3 py-1 space-y-1">
          <div className="flex items-center justify-between px-3 mb-2">
            <p className="text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest font-mono">
              Recent Chats
            </p>
          </div>
          
          {/* Search Chats Input */}
          <div className="px-1 mb-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
              <input
                id="recent-chats-search-input"
                type="text"
                placeholder="Search chats..."
                value={chatSearchQuery}
                onChange={(e) => setChatSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900 pl-8 pr-3 py-1.5 text-xs text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 focus:outline-hidden focus:ring-1 focus:ring-amber-800"
              />
            </div>
          </div>

          {chats.filter(c => c.title.toLowerCase().includes(chatSearchQuery.toLowerCase())).length === 0 ? (
            <div className="px-3 py-4 text-xs text-neutral-400 dark:text-neutral-500">
              {chatSearchQuery ? "No matching chats found." : "No chats yet. Create one above!"}
            </div>
          ) : (
            chats
              .filter(c => c.title.toLowerCase().includes(chatSearchQuery.toLowerCase()))
              .map((c) => {
              const isActive = activeChatId === c.id && activeTab === "chat";
              return (
                <div
                  id={`chat-session-item-${c.id}`}
                  key={c.id}
                  onClick={() => handleSelectChatSession(c.id)}
                  className={`group relative flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-amber-900/5 dark:bg-amber-100/5 text-amber-950 dark:text-amber-100 border-l-2 border-amber-800 rounded-l-none"
                      : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/40 dark:hover:bg-neutral-800/40"
                  }`}
                >
                  {editingChatId === c.id ? (
                    <div className="flex items-center gap-1.5 w-full" onClick={(e) => e.stopPropagation()}>
                      <input
                        id={`edit-chat-title-input-${c.id}`}
                        type="text"
                        value={editingChatTitle}
                        onChange={(e) => setEditingChatTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRenameChat(c.id, editingChatTitle);
                          if (e.key === "Escape") setEditingChatId(null);
                        }}
                        autoFocus
                        className="flex-1 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-xs text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-1 focus:ring-amber-800"
                      />
                      <button
                        id={`save-chat-title-btn-${c.id}`}
                        onClick={() => handleRenameChat(c.id, editingChatTitle)}
                        className="p-1 hover:bg-green-500/10 rounded text-green-600 dark:text-green-400"
                        title="Save title"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        id={`cancel-chat-title-btn-${c.id}`}
                        onClick={() => setEditingChatId(null)}
                        className="p-1 hover:bg-neutral-500/10 rounded text-neutral-400"
                        title="Cancel"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <MessageSquare className={`h-4 w-4 shrink-0 ${isActive ? "text-amber-800 dark:text-amber-400" : "text-neutral-400"}`} />
                        <span className="truncate text-xs leading-relaxed">{c.title}</span>
                      </div>
                      
                      {/* Action Buttons: Rename & Delete */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          id={`rename-chat-btn-${c.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingChatId(c.id);
                            setEditingChatTitle(c.title);
                          }}
                          className="p-1 hover:bg-neutral-500/10 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-all"
                          title="Rename Chat"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          id={`delete-chat-btn-${c.id}`}
                          onClick={(e) => handleDeleteChat(c.id, e)}
                          className="p-1 hover:bg-red-500/10 rounded text-neutral-400 hover:text-red-500 transition-all"
                          title="Delete Chat"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Menu & Settings Panel */}
        <div className="border-t border-neutral-200/50 dark:border-neutral-800/50 p-4 space-y-3 bg-[#EFECE5] dark:bg-neutral-900/60">
          
          {/* Navigation Options: Chat Dashboard, Library Catalog, vs API Panel */}
          <div className="grid grid-cols-3 gap-1 bg-neutral-200/40 dark:bg-neutral-800/40 p-1 rounded-xl">
            <button
              id="switch-chat-tab-button"
              onClick={() => {
                setActiveTab("chat");
                setSidebarOpen(false);
              }}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1 py-1.5 px-0.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-colors ${
                activeTab === "chat"
                  ? "bg-white dark:bg-neutral-800 text-amber-900 dark:text-amber-100 shadow-sm"
                  : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Chat
            </button>
            <button
              id="switch-library-tab-button"
              onClick={() => {
                setActiveTab("library");
                setSidebarOpen(false);
              }}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1 py-1.5 px-0.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-colors ${
                activeTab === "library"
                  ? "bg-white dark:bg-neutral-800 text-amber-900 dark:text-amber-100 shadow-sm"
                  : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              Library
            </button>
            <button
              id="switch-api-tab-button"
              onClick={() => {
                setActiveTab("api-keys");
                setSidebarOpen(false);
              }}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1 py-1.5 px-0.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-colors ${
                activeTab === "api-keys"
                  ? "bg-white dark:bg-neutral-800 text-amber-900 dark:text-amber-100 shadow-sm"
                  : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
              }`}
            >
              <KeyRound className="h-3.5 w-3.5" />
              Keys
            </button>
          </div>

          {/* PWA Install Button in Sidebar */}
          {!isInstalled && (
            <button
              id="sidebar-install-pwa-btn"
              onClick={promptInstall}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-transparent border border-amber-500/30 hover:border-amber-500/50 text-amber-900 dark:text-amber-200 transition-all text-xs font-semibold cursor-pointer shadow-xs group"
            >
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-amber-500 group-hover:scale-110 transition-transform" />
                <span>Install Nexa App</span>
              </div>
              <span className="text-[10px] bg-amber-500/20 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded font-mono font-bold">
                PWA
              </span>
            </button>
          )}

          {/* User Profile Card (drdarkfactshindi@gmail.com) */}
          <div className="flex items-center justify-between rounded-xl p-2.5 bg-neutral-200/20 dark:bg-neutral-800/20">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-850 dark:bg-amber-300 text-white dark:text-neutral-900 text-xs font-bold font-mono">
                DF
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold truncate text-neutral-800 dark:text-neutral-200">
                  drdarkfactshindi
                </p>
                <p className="text-[10px] text-neutral-400 dark:text-neutral-500 truncate font-mono">
                  drdarkfactshindi@gmail.com
                </p>
              </div>
            </div>
            
            {/* Theme Toggle Button inside sidebar */}
            <button
              id="theme-toggle-button"
              onClick={() => setTheme(prev => prev === "light" ? "dark" : "light")}
              className="p-1.5 rounded-lg hover:bg-neutral-300/40 dark:hover:bg-neutral-700/40 text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-100 transition-colors"
              title="Toggle theme"
            >
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </aside>

      {/* Backdrop for mobile drawer */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            id="sidebar-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-xs md:hidden"
          />
        )}
      </AnimatePresence>

      {/* 2. MAIN APPLICATION CONTENT AREA */}
      <main id="main-content-panel" className="flex flex-1 flex-col h-full overflow-hidden">
        
        {/* Top Navbar */}
        <header className="flex h-14 items-center justify-between border-b border-neutral-200/60 dark:border-neutral-800/60 bg-[#F9F7F3] dark:bg-neutral-950 px-3 md:px-6">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <button
              id="sidebar-hamburger-menu"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 text-neutral-600 dark:text-neutral-300 md:hidden shrink-0"
            >
              <Menu className="h-5 w-5" />
            </button>
            
            {/* View Title - Minimal on mobile */}
            <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
              <span className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-100 hidden sm:inline-block shrink-0">
                Play Nexa AI
              </span>
              <span className="text-neutral-300 dark:text-neutral-700 hidden sm:inline-block">/</span>
              <span className="text-xs font-mono font-bold tracking-wider text-neutral-400 dark:text-neutral-500 uppercase hidden sm:inline-block shrink-0">
                {activeTab === "chat" ? "Workspace" : "Developer Tools"}
              </span>
              <span className="text-neutral-300 dark:text-neutral-700 hidden sm:inline-block">/</span>
              <h2 className="text-xs sm:text-sm font-semibold text-neutral-700 dark:text-neutral-300 truncate max-w-[150px] sm:max-w-[220px] md:max-w-[400px]">
                {activeTab === "chat" 
                  ? (activeChat ? activeChat.title : "New Conversation")
                  : "API Keys Dashboard"}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            {/* Export Chat Dropdown Menu */}
            {activeTab === "chat" && activeChat && activeChat.messages.length > 0 && (
              <div className="relative">
                <button
                  id="export-chat-button"
                  onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 md:px-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors shadow-xs cursor-pointer"
                  title="Export Chat Session"
                >
                  <Download className="h-3.5 w-3.5 text-amber-800 dark:text-amber-400" />
                  <span className="text-xs font-semibold font-mono hidden md:inline">Export</span>
                  <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
                </button>

                <AnimatePresence>
                  {isExportDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      className="absolute right-0 mt-1.5 w-36 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl p-1 z-30 font-mono text-xs"
                    >
                      <button
                        id="export-chat-json-btn"
                        onClick={() => handleExportChat("json")}
                        className="w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
                      >
                        <span>JSON (.json)</span>
                      </button>
                      <button
                        id="export-chat-md-btn"
                        onClick={() => handleExportChat("md")}
                        className="w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
                      >
                        <span>Markdown (.md)</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Desktop Live indicator or status bubble */}
            <div className="hidden md:flex items-center gap-2 rounded-full border border-neutral-200 dark:border-neutral-800 bg-neutral-100/50 dark:bg-neutral-900/50 px-3 py-1 text-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-neutral-500 dark:text-neutral-400 font-mono text-[11px]">{selectedModel}</span>
            </div>
            
            {/* Desktop Quick action: API doc link */}
            <a 
              id="api-docs-link"
              href="https://ai.google.dev/gemini-api/docs" 
              target="_blank" 
              rel="noreferrer"
              className="hidden md:flex items-center gap-1 text-xs text-neutral-400 hover:text-amber-800 dark:hover:text-amber-300 font-mono"
            >
              API Docs
              <ExternalLink className="h-3 w-3" />
            </a>

            {/* Desktop Install Nexa Ai PWA App Button */}
            {!isInstalled && (
              <button
                id="header-install-pwa-btn"
                onClick={promptInstall}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 dark:text-amber-300 transition-all shadow-xs cursor-pointer"
                title="Install Nexa Ai App directly to your device"
              >
                <Smartphone className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                <span className="text-xs font-semibold font-mono">Install App</span>
              </button>
            )}

            {/* Desktop Settings button for BYOK */}
            <button
              id="byok-settings-toggle-btn"
              onClick={() => setIsSettingsOpen(true)}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-neutral-800 dark:hover:text-neutral-100 transition-colors shadow-xs cursor-pointer"
              title="BYOK Settings"
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold font-mono">BYOK Settings</span>
            </button>
          </div>
        </header>

        {/* TAB 1: CONVERSATIONAL CHAT SCREEN */}
        {activeTab === "chat" && (
          <div id="chat-tab-container" className="flex flex-1 flex-col h-full overflow-hidden">
            
            {/* Scrollable Message Box */}
            <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 bg-[#FBF9F6] dark:bg-neutral-950">
              <div className="mx-auto max-w-3xl space-y-6">
                
                {/* Empty State / Welcome Splash */}
                {(!activeChat || activeChat.messages.length === 0) ? (
                  <div id="chat-empty-state" className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-900/5 dark:bg-amber-100/5 text-amber-800 dark:text-amber-300 mb-4 border border-amber-900/10 dark:border-amber-100/10">
                      <Sparkles className="h-6 w-6 animate-pulse" />
                    </div>
                    <h3 className="text-xl font-serif font-semibold text-neutral-800 dark:text-neutral-100">
                      How can I help you code today?
                    </h3>
                    <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 max-w-md leading-relaxed">
                      Write some code, ask debugging questions, explain algorithms or test complex systems. Powered by Google Gemini.
                    </p>

                    {/* Developer Starters Grid */}
                    <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl text-left">
                      {promptStarters.map((starter, i) => (
                        <button
                          id={`prompt-starter-${i}`}
                          key={i}
                          onClick={() => {
                            setInputValue(starter.text);
                            handleSendMessage(starter.text);
                          }}
                          className="flex flex-col gap-1.5 p-4 rounded-xl border border-neutral-200/50 dark:border-neutral-800/50 bg-[#F5F2EC]/40 hover:bg-[#F5F2EC]/80 dark:bg-neutral-900/20 dark:hover:bg-neutral-900/60 transition-all duration-200 text-left active:scale-[0.99] group"
                        >
                          <span className="text-xs font-mono font-bold tracking-wider text-amber-900 dark:text-amber-400 uppercase">
                            {starter.label}
                          </span>
                          <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 group-hover:text-amber-900 dark:group-hover:text-amber-200 transition-colors leading-relaxed">
                            &ldquo;{starter.text}&rdquo;
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Render Chat Messages */
                  <div className="space-y-6">
                    {activeChat.messages.map((message, index) => {
                      const isUser = message.role === "user";
                      return (
                        <div
                          id={`chat-message-${message.id}`}
                          key={message.id}
                          className={`flex gap-4 ${isUser ? "justify-end" : "justify-start"}`}
                        >
                          {/* Bot Avatar */}
                          {!isUser && (
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-bold border border-neutral-300/20 dark:border-neutral-700/20">
                              <Terminal className="h-4 w-4 text-amber-800 dark:text-amber-400" />
                            </div>
                          )}

                          {/* Message Content Bubble */}
                          <div 
                            className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                              isUser
                                ? "bg-amber-900/5 dark:bg-amber-100/10 border border-amber-900/10 dark:border-amber-100/10 text-neutral-800 dark:text-neutral-200 shadow-xs"
                                : "text-neutral-800 dark:text-neutral-100"
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1 justify-between">
                              <span className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-wider">
                                {isUser ? "You" : (
                                  <div className="flex items-center gap-2">
                                    <span>Assistant</span>
                                    {message.sourceType && (
                                      <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider normal-case ${
                                        message.sourceType === 'Global Library' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 
                                        message.sourceType === 'Deep Research' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 
                                        'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                                      }`}>
                                        {message.sourceType === 'Global Library' ? '🟢 Global Library' : 
                                         message.sourceType === 'Deep Research' ? '🌐 Deep Research' : 
                                         '🧠 Nexa Brain'}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </span>
                              <span className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500">
                                {message.timestamp}
                              </span>
                            </div>

                            {/* Markdown Render Area with beautiful syntax code styles */}
                            <div className="prose prose-neutral dark:prose-invert max-w-none text-neutral-700 dark:text-neutral-300 space-y-2 min-w-0">
                              {isUser ? (
                                <div>
                                  {/* Multi-Image Gallery Rendering */}
                                  {message.attachedImages && message.attachedImages.length > 0 ? (
                                    <div className="mb-3">
                                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-500 dark:text-neutral-400 mb-2">
                                        <ImageIcon className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                        <span>{message.attachedImages.length} Image{message.attachedImages.length > 1 ? "s" : ""} Attached</span>
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {message.attachedImages.map((img, imgIdx) => (
                                          <div 
                                            key={imgIdx} 
                                            onClick={() => setPreviewModalImage(img)}
                                            className="group relative h-20 w-20 sm:h-24 sm:w-24 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-900/10 dark:bg-neutral-900/60 cursor-pointer shadow-xs hover:border-blue-500/50 hover:shadow-md transition-all"
                                            title={`Click to preview ${img.fileName}`}
                                          >
                                            <img 
                                              src={img.dataUrl} 
                                              alt={img.fileName} 
                                              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                                            />
                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1">
                                              <p className="text-[9px] font-mono text-white truncate text-center">{img.fileName}</p>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : message.attachedImage ? (
                                    <div 
                                      onClick={() => setPreviewModalImage(message.attachedImage!)}
                                      className="mb-3 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-900/5 dark:bg-neutral-900/50 max-w-sm cursor-pointer group"
                                      title="Click to preview image"
                                    >
                                      <img 
                                        src={message.attachedImage.dataUrl} 
                                        alt={message.attachedImage.fileName} 
                                        className="max-h-64 w-auto rounded-lg object-contain group-hover:opacity-95 transition-opacity"
                                      />
                                      <div className="px-2.5 py-1 text-[10px] font-mono text-neutral-500 dark:text-neutral-400 truncate flex items-center gap-1.5">
                                        <ImageIcon className="h-3 w-3 text-blue-500 shrink-0" />
                                        <span className="truncate">{message.attachedImage.fileName}</span>
                                      </div>
                                    </div>
                                  ) : null}

                                  {message.attachedZip && (
                                    <div className="mb-2.5 flex items-center gap-2.5 rounded-xl bg-amber-950/5 dark:bg-amber-100/10 border border-amber-900/15 dark:border-amber-100/15 px-3 py-2 text-xs">
                                      <FolderArchive className="h-4 w-4 text-amber-800 dark:text-amber-300 shrink-0" />
                                      <div className="min-w-0 flex-1">
                                        <span className="font-mono font-bold text-amber-950 dark:text-amber-100 truncate block">
                                          {message.attachedZip.fileName}
                                        </span>
                                        <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono">
                                          {message.attachedZip.totalFiles} code files analyzed · {message.attachedZip.totalSizeKb} KB
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                  <p className="whitespace-pre-wrap">{message.content}</p>
                                </div>
                              ) : (
                                <div className="markdown-content min-w-0">
                                  {/* Claude-style Dynamic Live Thinking Indicator while content is empty or actively streaming */}
                                  {isSending && index === activeChat.messages.length - 1 && (
                                    <ClaudeThinkingIndicator 
                                      statusText={aiActionStatus || undefined}
                                      isStreaming={message.content.length > 0}
                                      hasZip={activeChat.messages[index - 1]?.attachedZip !== undefined}
                                      hasImages={(activeChat.messages[index - 1]?.attachedImages?.length || 0) > 0 || !!activeChat.messages[index - 1]?.attachedImage}
                                    />
                                  )}

                                  {message.content ? (
                                    <Markdown
                                      components={{
                                        p({ children }) {
                                          return <p className="mb-3 leading-relaxed last:mb-0">{children}</p>;
                                        },
                                        ul({ children }) {
                                          return <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>;
                                        },
                                        ol({ children }) {
                                          return <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>;
                                        },
                                        li({ children }) {
                                          return <li className="leading-relaxed">{children}</li>;
                                        },
                                        h3({ children }) {
                                          return <h3 className="text-base font-bold text-neutral-800 dark:text-neutral-200 mt-4 mb-2">{children}</h3>;
                                        },
                                        pre({ children }) {
                                          return (
                                            <pre className="overflow-x-auto max-w-full text-xs sm:text-sm font-mono whitespace-pre rounded-lg p-3 bg-slate-900 border border-slate-800 text-slate-100 my-3 leading-relaxed [touch-action:pan-x] overscroll-x-contain">
                                              {children}
                                            </pre>
                                          );
                                        },
                                        code({ className, children, ...props }) {
                                          const match = /language-(\w+)/.exec(className || "");
                                          const isInline = !match;
                                          const codeContent = String(children).replace(/\n$/, "");
                                          
                                          if (isInline) {
                                            return (
                                              <code 
                                                className="bg-neutral-150 dark:bg-neutral-800/80 px-1.5 py-0.5 rounded text-xs font-mono font-semibold text-amber-800 dark:text-amber-300" 
                                                {...props}
                                              >
                                                {children}
                                              </code>
                                            );
                                          }

                                          return (
                                            <div className="relative group my-4 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 font-mono text-xs shadow-md max-w-full">
                                              <div className="flex items-center justify-between px-3.5 py-2 bg-slate-900 border-b border-slate-800 text-[10px] text-slate-400 font-bold font-mono uppercase tracking-wider">
                                                <span>{match ? match[1] : "code"}</span>
                                                <button
                                                  id={`copy-code-bubble-button-${message.id}`}
                                                  onClick={() => handleCopy(codeContent, message.id + "-code")}
                                                  className="hover:text-amber-400 text-slate-400 flex items-center gap-1 transition-colors cursor-pointer"
                                                >
                                                  {copySuccessId === (message.id + "-code") ? (
                                                    <>
                                                      <Check className="w-3 h-3 text-emerald-400 animate-bounce" />
                                                      <span className="text-emerald-400 normal-case">Copied!</span>
                                                    </>
                                                  ) : (
                                                    <>
                                                      <Copy className="w-3 h-3" />
                                                      <span>Copy</span>
                                                    </>
                                                  )}
                                                </button>
                                              </div>
                                              <pre className="overflow-x-auto max-w-full text-xs sm:text-sm font-mono whitespace-pre rounded-b-lg p-3 bg-slate-900 border-t-0 border border-slate-800 text-slate-100 leading-relaxed [touch-action:pan-x] overscroll-x-contain">
                                                <code className="font-mono text-xs sm:text-sm text-slate-100">{children}</code>
                                              </pre>
                                            </div>
                                          );
                                        }
                                      }}
                                    >
                                      {message.content}
                                    </Markdown>
                                  ) : null}
                                </div>
                              )}
                            </div>

                            {/* Retry Button for Error Messages */}
                            {!isUser && (message.content.includes("503") || message.content.includes("heavy traffic") || message.content.includes("Rate limit") || message.content.includes("Authentication") || message.content.includes("⚠️")) && (
                              <div className="mt-3 pt-2 flex items-center">
                                <button
                                  onClick={() => {
                                    const msgIndex = activeChat.messages.findIndex(m => m.id === message.id);
                                    if (msgIndex > 0) {
                                      const prevUserMsg = activeChat.messages[msgIndex - 1];
                                      if (prevUserMsg && prevUserMsg.role === "user") {
                                        handleSendMessage(prevUserMsg.content);
                                      }
                                    }
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-900/10 hover:bg-amber-900/20 dark:bg-amber-100/10 dark:hover:bg-amber-100/20 text-amber-900 dark:text-amber-200 text-xs font-medium transition-all"
                                >
                                  <RefreshCw className="h-3.5 w-3.5" />
                                  <span>Retry Request</span>
                                </button>
                              </div>
                            )}

                            {/* RAG Source Attribution Badge */}
                            {!isUser && message.sources && message.sources.length > 0 && (
                              <div className="mt-4 pt-3 border-t border-neutral-200/50 dark:border-neutral-800/50 space-y-2">
                                <span className="text-[10px] font-mono font-bold tracking-wider text-neutral-400 dark:text-neutral-500 uppercase">
                                  Retrieved Reference Sources:
                                </span>
                                <div className="space-y-1.5">
                                  {message.sources.map((src, sIdx) => {
                                    const isExpanded = !!expandedSources[`${message.id}-${sIdx}`];
                                    return (
                                      <div key={sIdx} className="rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 bg-neutral-100/50 dark:bg-neutral-900/50 overflow-hidden text-xs">
                                        <button
                                          id={`toggle-source-btn-${message.id}-${sIdx}`}
                                          onClick={() => {
                                            setExpandedSources(prev => ({
                                              ...prev,
                                              [`${message.id}-${sIdx}`]: !isExpanded
                                            }));
                                          }}
                                          className="flex items-center justify-between w-full p-2.5 hover:bg-neutral-200/30 dark:hover:bg-neutral-800/30 transition-colors text-left"
                                        >
                                          <div className="flex items-center gap-2 min-w-0">
                                            <FileText className="h-3.5 w-3.5 text-amber-800 dark:text-amber-400 shrink-0" />
                                            <span className="font-semibold text-neutral-700 dark:text-neutral-200 truncate">{src.filename}</span>
                                            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 tracking-wider">
                                              {src.score}% Match
                                            </span>
                                          </div>
                                          {isExpanded ? (
                                            <ChevronUp className="h-3.5 w-3.5 text-neutral-400" />
                                          ) : (
                                            <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
                                          )}
                                        </button>
                                        
                                        {isExpanded && (
                                          <div className="p-3 bg-[#FBF9F6] dark:bg-[#080808] border-t border-neutral-200/50 dark:border-neutral-800/50 font-mono text-[11px] leading-relaxed text-neutral-600 dark:text-neutral-400 overflow-x-auto whitespace-pre-wrap select-all">
                                            {src.snippet}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Pending Response Indicator (Shown before assistant message is created in list) */}
                    {isSending && (!activeChat.messages.length || activeChat.messages[activeChat.messages.length - 1]?.role !== "assistant") && (
                      <LoadingAnimation 
                        statusText={aiActionStatus || undefined}
                        hasZip={activeChat.messages[activeChat.messages.length - 1]?.attachedZip !== undefined}
                        hasImages={(activeChat.messages[activeChat.messages.length - 1]?.attachedImages?.length || 0) > 0 || !!activeChat.messages[activeChat.messages.length - 1]?.attachedImage}
                      />
                    )}
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input Box Area */}
            <div className="border-t border-neutral-200/50 dark:border-neutral-800/50 bg-[#FBF9F6] dark:bg-neutral-950 p-4 md:p-6">
              <div className="relative mx-auto max-w-3xl">

                {/* Floating AI Action Status Indicator (Google AI Studio Style) */}
                {aiActionStatus && (
                  <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none transition-all duration-300">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#1E2024]/90 backdrop-blur-md border border-slate-700/50 shadow-lg w-max mx-auto text-sm text-slate-300 font-medium animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <span className="relative flex h-2.5 w-2.5 items-center justify-center shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]"></span>
                      </span>
                      <span className="tracking-normal select-none">{aiActionStatus}</span>
                    </div>
                  </div>
                )}
                
                {/* Extraction Progress Banner */}
                {isExtractingZip && (
                  <div className="mb-2.5 flex items-center gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3.5 py-2.5 text-xs text-amber-900 dark:text-amber-200">
                    <RefreshCw className="h-4 w-4 animate-spin text-amber-800 dark:text-amber-400 shrink-0" />
                    <span className="font-medium">{zipExtractionProgress || "Extracting codebase archive..."}</span>
                  </div>
                )}

                {/* Multi-Image Upload Card Previews (Up to 10 Images) */}
                {selectedImages.length > 0 && (
                  <div className="mb-2.5 rounded-xl bg-blue-500/10 dark:bg-blue-400/10 border border-blue-500/20 dark:border-blue-400/20 p-2.5 text-xs shadow-2xs">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/20 text-blue-700 dark:text-blue-300">
                          <ImageIcon className="h-3 w-3" />
                          {selectedImages.length}/10 Images Attached
                        </span>
                        <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono hidden sm:inline">
                          Multimodal Vision ready
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedImages.length < 10 && (
                          <button
                            type="button"
                            onClick={() => imageInputRef.current?.click()}
                            className="flex items-center gap-1 text-[11px] font-mono font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                          >
                            + Add more ({10 - selectedImages.length} left)
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleClearImages}
                          className="text-[11px] font-mono text-neutral-400 hover:text-red-500 transition-colors cursor-pointer"
                        >
                          Clear all
                        </button>
                      </div>
                    </div>

                    {/* Scrollable / Wrapping Thumbnails */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                      {selectedImages.map((img, idx) => (
                        <div 
                          key={idx} 
                          className="group relative h-16 w-16 shrink-0 rounded-lg overflow-hidden border border-blue-500/30 bg-neutral-900 shadow-2xs"
                        >
                          <img 
                            src={img.dataUrl} 
                            alt={img.fileName} 
                            className="h-full w-full object-cover cursor-pointer"
                            onClick={() => setPreviewModalImage(img)}
                          />
                          {/* Remove button on top-right */}
                          <button
                            id={`remove-image-${idx}-btn`}
                            type="button"
                            onClick={() => handleRemoveImage(idx)}
                            className="absolute top-1 right-1 h-4 w-4 rounded-full bg-black/80 hover:bg-red-600 text-white flex items-center justify-center transition-colors cursor-pointer shadow-xs"
                            title={`Remove ${img.fileName}`}
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                          <div className="absolute inset-x-0 bottom-0 bg-black/70 px-1 py-0.5 pointer-events-none">
                            <p className="text-[8px] font-mono text-white truncate text-center">
                              {img.sizeKb}KB
                            </p>
                          </div>
                        </div>
                      ))}

                      {selectedImages.length < 10 && (
                        <button
                          type="button"
                          onClick={() => imageInputRef.current?.click()}
                          className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-lg border border-dashed border-blue-500/40 hover:border-blue-500 bg-blue-500/5 hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 transition-colors cursor-pointer"
                          title="Add another image (up to 10)"
                        >
                          <ImageIcon className="h-4 w-4 mb-0.5" />
                          <span className="text-[9px] font-mono">+Add</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Attached Codebase Card Preview */}
                {attachedZip && !isExtractingZip && (
                  <div className="mb-2.5 flex items-center justify-between gap-3 rounded-xl bg-amber-900/5 dark:bg-amber-100/10 border border-amber-900/15 dark:border-amber-100/15 p-2.5 text-xs shadow-2xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-900/10 dark:bg-amber-100/15 text-amber-900 dark:text-amber-200 shrink-0">
                        <FolderArchive className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-mono font-bold text-amber-950 dark:text-amber-100 truncate">
                            {attachedZip.fileName}
                          </p>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-900/10 text-amber-900 dark:bg-amber-100/15 dark:text-amber-200">
                            {attachedZip.totalFiles} files loaded ({attachedZip.totalSizeKb} KB)
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">
                          Extracted client-side & ready to send with your message
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        id="view-attached-codebase-btn"
                        type="button"
                        onClick={() => setIsZipFilesModalOpen(true)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-750 transition-colors shadow-2xs cursor-pointer"
                      >
                        <Eye className="h-3 w-3" />
                        <span>View Files</span>
                      </button>
                      <button
                        id="remove-attached-codebase-btn"
                        type="button"
                        onClick={() => setAttachedZip(null)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-neutral-400 hover:text-red-600 transition-colors cursor-pointer"
                        title="Remove attached codebase"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Text Input Wrapper */}
                <div className="relative flex flex-col rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-[#FDFCFB] dark:bg-neutral-900 shadow-sm focus-within:ring-2 focus-within:ring-amber-900/20 dark:focus-within:ring-amber-100/20 focus-within:border-amber-900/50 dark:focus-within:border-amber-100/50 transition-all duration-200">
                  <textarea
                    id="chat-message-textarea"
                    rows={2}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={
                      selectedImages.length > 0 
                        ? `Ask something about ${selectedImages.length === 1 ? "this image" : `these ${selectedImages.length} images`} or press Enter to analyze...`
                        : "Ask anything about coding, algorithms, design patterns..."
                    }
                    className="w-full resize-none bg-transparent px-4 py-3.5 text-sm text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 focus:outline-hidden min-h-[50px] leading-relaxed"
                  />

                  {/* Input Actions Bar */}
                  <div className="flex items-center justify-between border-t border-neutral-200/40 dark:border-neutral-800/40 px-4 py-2.5 bg-[#FAF8F5] dark:bg-neutral-900/50 rounded-b-2xl">
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                      {/* Hidden File Input for Images (Multiple Supported) */}
                      <input
                        id="vision-image-upload-input"
                        type="file"
                        ref={imageInputRef}
                        multiple
                        accept=".png,.jpg,.jpeg,.webp"
                        onChange={handleImageUpload}
                        className="hidden"
                      />

                      {/* Image Upload Button */}
                      <button
                        id="attach-image-button"
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        disabled={isSending}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                          selectedImages.length > 0 
                            ? "bg-blue-600/15 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300 border border-blue-600/30"
                            : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/60"
                        }`}
                        title="Upload up to 10 images (.png, .jpg, .webp) for multimodal vision analysis"
                      >
                        <ImageIcon className="h-3.5 w-3.5" />
                        <span>{selectedImages.length > 0 ? `Images (${selectedImages.length}/10)` : "Images"}</span>
                      </button>

                      {/* Hidden File Input for Zip / Code */}
                      <input
                        id="codebase-zip-upload-input"
                        type="file"
                        ref={zipFileInputRef}
                        accept=".zip,.js,.jsx,.ts,.tsx,.py,.json,.html,.css,.scss,.md,.rs,.go,.c,.cpp,.h,.hpp,.java,.kt,.sql,.yaml,.yml,.sh,.toml,.txt,.prisma"
                        onChange={handleZipFileUpload}
                        className="hidden"
                      />

                      {/* Zip / Codebase Upload Button */}
                      <button
                        id="attach-codebase-button"
                        type="button"
                        onClick={() => zipFileInputRef.current?.click()}
                        disabled={isExtractingZip || isSending}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                          attachedZip 
                            ? "bg-emerald-600/15 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300 border border-emerald-600/30"
                            : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/60"
                        }`}
                        title="Upload .zip codebase archive or code file to analyze"
                      >
                        <FolderArchive className="h-3.5 w-3.5" />
                        <span>{attachedZip ? `${attachedZip.totalFiles} Files` : "Attach Zip / Code"}</span>
                      </button>

                      {/* Thinking Toggle */}
                      <button
                        id="toggle-thinking-button"
                        onClick={() => setIsThinking(!isThinking)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                          isThinking 
                            ? "bg-amber-900/10 text-amber-900 dark:bg-amber-100/10 dark:text-amber-200 border border-amber-900/20 dark:border-amber-100/20" 
                            : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                        }`}
                        title="Think step-by-step before answering"
                      >
                        <Zap className={`h-3 w-3 ${isThinking ? "fill-amber-900 dark:fill-amber-100" : ""}`} />
                        <span>Thinking</span>
                      </button>

                      {/* Deep Research Toggle */}
                      <button
                        id="toggle-deep-research-button"
                        onClick={() => setIsDeepResearch(!isDeepResearch)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                          isDeepResearch 
                            ? "bg-blue-600/10 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300 border border-blue-600/20 dark:border-blue-400/20" 
                            : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                        }`}
                        title="Deeply research using all available sources"
                      >
                        <Search className="h-3 w-3" />
                        <span>Research</span>
                      </button>

                      {/* Mobile Quick BYOK Settings Shortcut (Adjacent to Chat Controls) */}
                      <button
                        id="mobile-chat-controls-settings-btn"
                        type="button"
                        onClick={() => setIsSettingsOpen(true)}
                        className="md:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/60 transition-all duration-200 cursor-pointer"
                        title="Open BYOK Settings"
                      >
                        <Settings className="h-3 w-3 text-amber-800 dark:text-amber-400" />
                        <span>Settings</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Live Token Usage Counter Badge */}
                      {(() => {
                        const estimatedInputTokens = inputValue.trim() ? Math.ceil(inputValue.trim().length / 3.8) : 0;
                        const currentSessionTokens = activeChat?.lastUsage?.totalTokens || sessionTokenUsage?.totalTokens || 0;
                        
                        return (
                          <div 
                            id="token-usage-badge"
                            className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md bg-neutral-200/50 dark:bg-neutral-800/50 text-[10px] font-mono text-neutral-500 dark:text-neutral-400 border border-neutral-200/60 dark:border-neutral-800/60"
                            title={
                              currentSessionTokens > 0 
                                ? `Last Response: ${currentSessionTokens.toLocaleString()} tokens | Est. Input: ~${estimatedInputTokens} tokens`
                                : `Real-time token estimation based on prompt character length (~${estimatedInputTokens} tokens)`
                            }
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500/80 shrink-0"></span>
                            <span>
                              {currentSessionTokens > 0 ? (
                                <>
                                  <span className="font-semibold text-neutral-700 dark:text-neutral-300">{currentSessionTokens.toLocaleString()}</span>
                                  <span className="opacity-70"> tok</span>
                                  {estimatedInputTokens > 0 && (
                                    <span className="text-amber-600 dark:text-amber-400 ml-1">
                                      (+~{estimatedInputTokens})
                                    </span>
                                  )}
                                </>
                              ) : (
                                <>
                                  <span className="opacity-75">Est: </span>
                                  <span className="font-semibold text-neutral-700 dark:text-neutral-300">~{estimatedInputTokens}</span>
                                  <span className="opacity-70"> tok</span>
                                </>
                              )}
                            </span>
                          </div>
                        );
                      })()}

                      {/* Submit / Send Button */}
                      <button
                        id="submit-message-button"
                        disabled={(!inputValue.trim() && selectedImages.length === 0) || isSending}
                        onClick={() => handleSendMessage()}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 cursor-pointer ${
                          (inputValue.trim() || selectedImages.length > 0) && !isSending
                            ? "bg-amber-900 dark:bg-amber-100 text-white dark:text-neutral-950 hover:scale-[1.05]"
                            : "bg-neutral-200 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed"
                        }`}
                        title="Send message"
                      >
                        <ArrowUp className="h-4 w-4 stroke-[2.5px]" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Footer disclaimer */}
                <p className="mt-2 text-center text-[10px] text-neutral-400 dark:text-neutral-500 font-mono leading-relaxed">
                  Coding models can make mistakes. Please verify critical code blocks. Powered by Gemini Developer API.
                </p>
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: API KEY DASHBOARD */}
        {activeTab === "api-keys" && (
          <div id="api-keys-tab-container" className="flex-1 overflow-y-auto px-4 py-6 md:px-8 bg-[#FBF9F6] dark:bg-neutral-950">
            <div className="mx-auto max-w-4xl space-y-6">
              
              {/* Dashboard Hero Header */}
              <div id="api-dashboard-header" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200/50 dark:border-neutral-800/50 pb-6">
                <div>
                  <h3 className="text-xl font-serif font-semibold text-neutral-800 dark:text-neutral-100">
                    Developer API Keys
                  </h3>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 max-w-lg leading-relaxed">
                    Generate and manage secure secret keys to integrate our coding companion directly into your continuous integration (CI) workflows, scripts, or IDE extensions.
                  </p>
                </div>
                
                <button
                  id="generate-new-key-trigger"
                  onClick={() => setIsGeneratingKey(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-900 dark:bg-amber-100 hover:bg-amber-950 dark:hover:bg-white px-4 py-3 text-xs font-semibold text-white dark:text-neutral-950 transition-all duration-200 active:scale-[0.98] shadow-sm self-start sm:self-center"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Generate New Secret Key
                </button>
              </div>

              {/* Supabase Database Connection Status Banner */}
              {supabaseStatus === "loading" && (
                <div id="supabase-status-loading" className="flex items-center gap-3 rounded-xl border border-neutral-200/65 dark:border-neutral-800/65 bg-[#FDFCFB] dark:bg-neutral-900 p-4 text-xs">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-neutral-500" />
                  <span className="font-medium text-neutral-500 dark:text-neutral-400">Verifying cloud database sync...</span>
                </div>
              )}

              {supabaseStatus === "connected" && (
                <div id="supabase-status-connected" className="flex items-start gap-3 rounded-xl border border-emerald-900/15 dark:border-emerald-100/10 bg-emerald-900/[0.03] dark:bg-emerald-100/[0.02] p-4 text-xs">
                  <div className="relative flex h-2 w-2 shrink-0 mt-1.5 ml-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-semibold text-emerald-950 dark:text-emerald-400">Supabase Cloud Sync Active</h4>
                    <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">
                      Your platform is securely connected to your PostgreSQL database. Generated API keys are persisted instantly, backed up, and synchronized across your deployment.
                    </p>
                  </div>
                </div>
              )}

              {supabaseStatus === "needs_config" && (
                <div id="supabase-status-needs-config" className="flex items-start gap-3 rounded-xl border border-amber-900/15 dark:border-amber-100/10 bg-amber-900/[0.03] dark:bg-amber-100/[0.02] p-4 text-xs">
                  <AlertCircle className="h-4 w-4 text-amber-800 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 w-full">
                    <h4 className="font-semibold text-amber-950 dark:text-amber-400">Supabase Connection Config Pending</h4>
                    <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">
                      To persist keys securely in your custom database, please configure <code className="font-mono bg-neutral-200/50 dark:bg-neutral-800 px-1 py-0.5 rounded text-neutral-600 dark:text-neutral-300 font-bold">SUPABASE_URL</code> and <code className="font-mono bg-neutral-200/50 dark:bg-neutral-800 px-1 py-0.5 rounded text-neutral-600 dark:text-neutral-300 font-bold">SUPABASE_SERVICE_ROLE_KEY</code> in your environment. Currently operating in secure **Local-Only Offline Mode**.
                    </p>
                  </div>
                </div>
              )}

              {supabaseStatus === "needs_table" && (
                <div id="supabase-status-needs-table" className="flex flex-col gap-3 rounded-xl border border-red-900/15 dark:border-red-100/10 bg-red-900/[0.02] dark:bg-red-100/[0.02] p-4 text-xs">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-4 w-4 text-red-800 dark:text-red-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="font-semibold text-red-950 dark:text-red-400">Supabase Connection Success &mdash; Table Required</h4>
                      <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">
                        Database connection is active, but the <code className="font-mono bg-neutral-200/50 dark:bg-neutral-800 px-1 py-0.5 rounded text-neutral-600 dark:text-neutral-300 font-bold">api_keys</code> table could not be found. Please paste and run this SQL query inside your Supabase dashboard SQL editor:
                      </p>
                    </div>
                  </div>
                  
                  <div className="relative mt-1">
                    <pre className="font-mono text-[10px] p-3 rounded-lg bg-neutral-900 text-neutral-200 overflow-x-auto select-all max-h-36">
                      {supabaseSql}
                    </pre>
                    <button
                      id="copy-sql-setup-btn"
                      onClick={() => {
                        navigator.clipboard.writeText(supabaseSql);
                        setCopySqlSuccess(true);
                        setTimeout(() => setCopySqlSuccess(false), 2000);
                      }}
                      className="absolute top-2 right-2 flex items-center gap-1 rounded bg-neutral-800 hover:bg-neutral-750 px-2 py-1 text-[10px] text-neutral-300 transition-all font-sans font-medium"
                    >
                      {copySqlSuccess ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          Copy SQL
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {supabaseStatus === "error" && (
                <div id="supabase-status-error" className="flex items-start gap-3 rounded-xl border border-red-900/15 dark:border-red-100/10 bg-red-900/[0.03] dark:bg-red-100/[0.02] p-4 text-xs">
                  <AlertCircle className="h-4 w-4 text-red-800 dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 w-full">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-red-950 dark:text-red-400">Database Connection Error</h4>
                      <button
                        id="retry-db-sync-btn"
                        onClick={() => fetchSupabaseKeys()}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:opacity-85"
                      >
                        <RefreshCw className="h-2.5 w-2.5 mr-0.5" /> Retry
                      </button>
                    </div>
                    <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed font-mono mt-1 text-[11px]">
                      {supabaseErrorMsg}
                    </p>
                  </div>
                </div>
              )}

              {/* API Security Banner */}
              <div id="api-security-card" className="flex items-start gap-3 rounded-xl border border-amber-900/10 dark:border-amber-100/10 bg-amber-900/[0.02] dark:bg-amber-100/[0.02] p-4 text-xs">
                <Shield className="h-4 w-4 text-amber-800 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-semibold text-amber-900 dark:text-amber-300">API Credentials Security Warning</h4>
                  <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    Your secret API keys are authenticators carrying direct access privileges. Do not share your API keys in public repositories, client-side browser bundles, or public forums. Store them securely in your system environment variables.
                  </p>
                </div>
              </div>

              {/* Keys Table Container */}
              <div id="api-keys-table-card" className="rounded-2xl border border-neutral-200/60 dark:border-neutral-800/60 bg-[#FDFCFB] dark:bg-neutral-900 overflow-hidden shadow-xs">
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-neutral-200/60 dark:border-neutral-800/60 bg-neutral-100/50 dark:bg-neutral-850/50 text-neutral-400 dark:text-neutral-500 font-mono uppercase tracking-wider text-[10px] font-bold">
                        <th className="p-4 font-semibold">Key Identifier Name</th>
                        <th className="p-4 font-semibold">Secret Key Token</th>
                        <th className="p-4 font-semibold">Date Created</th>
                        <th className="p-4 font-semibold text-center">Status</th>
                        <th className="p-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200/40 dark:divide-neutral-800/40 text-neutral-700 dark:text-neutral-300">
                      {apiKeys.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-neutral-400 dark:text-neutral-500">
                            No API Keys generated. Click &apos;Generate New Secret Key&apos; to get started.
                          </td>
                        </tr>
                      ) : (
                        apiKeys.map((k) => {
                          const isVisible = !!visibleKeyIds[k.id];
                          const isRevoked = k.status === "revoked";
                          return (
                            <tr key={k.id} className={`hover:bg-[#FAF9F6]/50 dark:hover:bg-neutral-800/20 transition-colors ${isRevoked ? "opacity-60 bg-neutral-100/10 dark:bg-neutral-900/10" : ""}`}>
                              
                              {/* Name */}
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <Key className={`h-4 w-4 ${isRevoked ? "text-neutral-400" : "text-amber-800 dark:text-amber-400"}`} />
                                  <span className="font-semibold text-neutral-800 dark:text-neutral-200">{k.name}</span>
                                </div>
                              </td>

                              {/* Secret Key Masked */}
                              <td className="p-4 font-mono text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded select-all max-w-[200px] sm:max-w-xs truncate text-[11px]">
                                    {maskKey(k.key, isVisible)}
                                  </span>
                                  {!isRevoked && (
                                    <>
                                      <button
                                        id={`toggle-visibility-btn-${k.id}`}
                                        onClick={() => toggleKeyVisibility(k.id)}
                                        className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                                        title={isVisible ? "Hide Key" : "Show Key"}
                                      >
                                        {isVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                      </button>
                                      <button
                                        id={`copy-key-btn-${k.id}`}
                                        onClick={() => handleCopy(k.key, k.id)}
                                        className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                                        title="Copy Key"
                                      >
                                        {copySuccessId === k.id ? (
                                          <Check className="h-3.5 w-3.5 text-green-500" />
                                        ) : (
                                          <Copy className="h-3.5 w-3.5" />
                                        )}
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>

                              {/* Date Created */}
                              <td className="p-4 text-neutral-500 dark:text-neutral-400">
                                {k.created}
                              </td>

                              {/* Status Badge */}
                              <td className="p-4 text-center">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  isRevoked 
                                    ? "bg-red-500/10 text-red-500 dark:bg-red-500/10" 
                                    : "bg-green-500/10 text-green-500 dark:bg-green-500/10"
                                }`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${isRevoked ? "bg-red-500" : "bg-green-500"}`}></span>
                                  {k.status}
                                </span>
                              </td>

                              {/* Actions (Revoke) */}
                              <td className="p-4 text-right">
                                {!isRevoked ? (
                                  <button
                                    id={`revoke-key-action-btn-${k.id}`}
                                    onClick={() => handleRevokeKey(k.id)}
                                    className="px-2.5 py-1.5 rounded-lg border border-red-500/20 bg-red-500/5 text-red-500 hover:bg-red-500 hover:text-white transition-all text-xs font-medium active:scale-[0.95]"
                                    title="Revoke and cancel this key"
                                  >
                                    Revoke
                                  </button>
                                ) : (
                                  <span className="text-[10px] font-mono text-neutral-400 uppercase">Inactive</span>
                                )}
                              </td>

                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

              </div>

              {/* Pinecone Vector Indexing Panel */}
              <div id="pinecone-sync-panel" className="rounded-2xl border border-neutral-200/60 dark:border-neutral-800/60 bg-[#FDFCFB] dark:bg-neutral-900 p-6 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-900/5 dark:bg-amber-100/5 text-amber-800 dark:text-amber-400">
                      <Terminal className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-neutral-800 dark:text-neutral-200">Pinecone Vector Indexing</h4>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                        Convert <code className="bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded text-[11px]">/knowledge</code> files to 768-dim embeddings and sync with Pinecone.
                      </p>
                    </div>
                  </div>

                  <button
                    id="trigger-pinecone-sync-btn"
                    onClick={handlePineconeSync}
                    disabled={pineconeSyncing}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all ${
                      pineconeSyncing
                        ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed"
                        : "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:opacity-90 active:scale-[0.98]"
                    }`}
                  >
                    {pineconeSyncing ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        Syncing Embeddings...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-3.5 w-3.5" />
                        Run Vector Sync Script
                      </>
                    )}
                  </button>
                </div>

                {/* Status Banners for Pinecone */}
                {pineconeStatus === "needs_config" && (
                  <div className="flex items-start gap-3 rounded-xl border border-amber-900/15 dark:border-amber-100/10 bg-amber-900/[0.03] dark:bg-amber-100/[0.02] p-4 text-xs">
                    <AlertCircle className="h-4 w-4 text-amber-800 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="font-semibold text-amber-950 dark:text-amber-300">Pinecone Integration Pending</h5>
                      <p className="text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
                        To activate, configure <code className="font-mono text-[11px] bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded">PINECONE_API_KEY</code> and <code className="font-mono text-[11px] bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded">PINECONE_INDEX_NAME</code> in your **Secrets/Environment Variables**.
                      </p>
                    </div>
                  </div>
                )}

                {pineconeStatus === "success" && (
                  <div className="flex items-start gap-3 rounded-xl border border-emerald-900/15 dark:border-emerald-100/10 bg-emerald-900/[0.03] dark:bg-emerald-100/[0.02] p-4 text-xs">
                    <Check className="h-4 w-4 text-emerald-800 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="font-semibold text-emerald-950 dark:text-emerald-300">Synchronized Successfully</h5>
                      <p className="text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
                        All local documents inside <code className="font-mono text-[11px] bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded">/knowledge</code> have been processed into embeddings and synchronized with Pinecone.
                      </p>
                    </div>
                  </div>
                )}

                {pineconeStatus === "error" && (
                  <div className="flex items-start gap-3 rounded-xl border border-red-900/15 dark:border-red-100/10 bg-red-900/[0.03] dark:bg-red-100/[0.02] p-4 text-xs">
                    <AlertCircle className="h-4 w-4 text-red-800 dark:text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="font-semibold text-red-950 dark:text-red-400">Sync Failure</h5>
                      <p className="text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
                        An operational exception occurred during vector upsertion. Please review the terminal logs below.
                      </p>
                    </div>
                  </div>
                )}

                {/* Console Outputs Terminal */}
                {pineconeLogs.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-neutral-400 dark:text-neutral-500 font-mono">
                      <span>SYNC TERMINAL OUTPUT</span>
                      <span>{pineconeLogs.length} LOG LINES</span>
                    </div>
                    <div className="bg-neutral-900 dark:bg-black text-neutral-300 p-4 rounded-xl font-mono text-[11px] leading-relaxed max-h-60 overflow-y-auto border border-neutral-800 space-y-1 select-all scrollbar-thin">
                      {pineconeLogs.map((log, idx) => (
                        <div key={idx} className={
                          log.startsWith("❌") ? "text-red-400" :
                          log.startsWith("✅") || log.startsWith("🎉") ? "text-emerald-400" :
                          log.startsWith("⚠️") ? "text-amber-400" :
                          log.startsWith("=== ") ? "text-neutral-400 font-bold border-b border-neutral-850 pb-1 mb-1 mt-2 first:mt-0" :
                          "text-neutral-300"
                        }>
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* TAB 3: LIBRARY & KNOWLEDGE BASE CATALOG */}
        {activeTab === "library" && (
          <div id="library-tab-container" className="flex-1 overflow-y-auto px-4 py-8 md:px-8 bg-[#FBF9F6] dark:bg-neutral-950">
            <div className="mx-auto max-w-6xl space-y-8">
              
              {/* Header Title Section */}
              <div className="space-y-2 border-b border-neutral-200/50 dark:border-neutral-800/50 pb-5">
                <h3 className="text-2xl font-serif font-bold text-neutral-800 dark:text-neutral-100">
                  Knowledge Base & Document Library
                </h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed max-w-2xl">
                  Manage references, documentation, and specific code guides permanently saved to the Supabase Global Library. 
                  Synchronized across all user sessions and paired with vector/semantic search to power lifelong contextual retrieval in your coding chats.
                </p>
              </div>

              {/* Split Dashboard Content */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Columns 1 & 2: Library Catalog & Interactive Search */}
                <div className="lg:col-span-2 space-y-8">
                  
                  {/* Library Catalog Table Panel */}
                  <div className="rounded-2xl border border-neutral-200/60 dark:border-neutral-800/60 bg-[#FDFCFB] dark:bg-neutral-900 overflow-hidden shadow-xs">
                    <div className="p-4 border-b border-neutral-200/60 dark:border-neutral-800/60 bg-neutral-100/30 dark:bg-neutral-850/30 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-amber-800 dark:text-amber-400" />
                        <h4 className="font-semibold text-sm text-neutral-800 dark:text-neutral-200">Documents Catalog</h4>
                      </div>
                      <span className="text-[10px] font-mono font-bold tracking-wider text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 rounded">
                        {libraryItems.length} ITEMS
                      </span>
                    </div>

                    {libraryLoading ? (
                      <div className="p-8 text-center text-xs text-neutral-400 flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="h-5 w-5 animate-spin text-neutral-400" />
                        <span>Loading files registry...</span>
                      </div>
                    ) : libraryItems.length === 0 ? (
                      <div className="p-12 text-center text-neutral-400 dark:text-neutral-500">
                        <FileText className="h-8 w-8 mx-auto mb-3 opacity-40 text-neutral-400" />
                        <p className="text-sm font-semibold">No Documents Found</p>
                        <p className="text-xs mt-1">Upload a reference sheet or type a code snippet on the right to start!</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-neutral-200/60 dark:border-neutral-800/60 bg-neutral-100/50 dark:bg-neutral-850/50 text-neutral-400 dark:text-neutral-500 font-mono uppercase tracking-wider text-[10px] font-bold">
                              <th className="p-4 font-semibold">File Name</th>
                              <th className="p-4 font-semibold">Category Tag</th>
                              <th className="p-4 font-semibold">Date Added</th>
                              <th className="p-4 font-semibold text-center">Usage Count</th>
                            </tr>
                          </thead>
                          <tbody>
                            {libraryItems.map((item) => (
                              <tr key={item.id} className="border-b border-neutral-150 dark:border-neutral-850 hover:bg-neutral-100/30 dark:hover:bg-neutral-800/10 transition-colors">
                                <td className="p-4">
                                  <button
                                    id={`preview-item-${item.id}`}
                                    onClick={() => setActiveLibraryPreviewItem(item)}
                                    className="font-semibold text-neutral-800 dark:text-neutral-200 hover:text-amber-800 dark:hover:text-amber-300 text-left flex items-center gap-2"
                                  >
                                    <FileText className="h-3.5 w-3.5 shrink-0 text-amber-850 dark:text-amber-400" />
                                    <span className="truncate max-w-[180px] sm:max-w-xs">{item.filename}</span>
                                  </button>
                                </td>
                                <td className="p-4">
                                  <span className="inline-flex rounded-lg bg-amber-900/5 dark:bg-amber-100/10 border border-amber-900/10 dark:border-amber-100/10 text-[10px] font-bold text-amber-900 dark:text-amber-300 px-2 py-0.5 tracking-wider font-mono">
                                    {item.category}
                                  </span>
                                </td>
                                <td className="p-4 text-neutral-500 dark:text-neutral-400 font-mono text-[11px]">{item.dateAdded}</td>
                                <td className="p-4 text-center text-neutral-600 dark:text-neutral-400 font-mono font-semibold">{item.usageCount || 0}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Library Search Bar & Match Preview */}
                  <div className="rounded-2xl border border-neutral-200/60 dark:border-neutral-800/60 bg-[#FDFCFB] dark:bg-neutral-900 p-6 space-y-4 shadow-xs">
                    <div className="flex items-center gap-2 border-b border-neutral-100 dark:border-neutral-850 pb-3">
                      <Search className="h-4 w-4 text-neutral-400" />
                      <h4 className="font-semibold text-sm text-neutral-800 dark:text-neutral-200">Library Retrieval Search Preview</h4>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                        Test how the semantic / keyword index handles queries. Type a developer prompt to preview matches instantly.
                      </p>
                      <div className="relative mt-2">
                        <input
                          id="library-search-input"
                          type="text"
                          value={librarySearchQuery}
                          onChange={(e) => handleLibrarySearch(e.target.value)}
                          placeholder="Type a coding query (e.g. 'TypeScript configurations', 'Tailwind corners')..."
                          className="w-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-[#FBF9F6] dark:bg-neutral-950 px-4 py-3 pl-10 text-xs font-medium text-neutral-805 dark:text-neutral-150 outline-hidden focus:border-amber-800 dark:focus:border-amber-400 focus:ring-1 focus:ring-amber-800/20"
                        />
                        <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-neutral-400" />
                      </div>
                    </div>

                    {/* Search Results Display */}
                    {librarySearchQuery.trim() && (
                      <div className="space-y-2 pt-2 animate-fadeIn">
                        <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono font-bold">
                          <span>MATCHES DISCOVERED</span>
                          <span>{librarySearchResults.length} RESULTS</span>
                        </div>

                        {librarySearchLoading ? (
                          <div className="p-6 text-center text-xs text-neutral-400 flex items-center justify-center gap-2">
                            <RefreshCw className="h-4 w-4 animate-spin text-neutral-400" />
                            <span>Performing search retrieval...</span>
                          </div>
                        ) : librarySearchResults.length === 0 ? (
                          <div className="p-4 rounded-xl bg-neutral-100/50 dark:bg-neutral-900/50 border border-neutral-200/30 text-center text-xs text-neutral-500">
                            No immediate context matches found for &ldquo;{librarySearchQuery}&rdquo;.
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {librarySearchResults.map((match, mIdx) => (
                              <div key={mIdx} className="rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 bg-[#FBF9F6] dark:bg-[#0d0d0d] p-3.5 space-y-2 text-xs">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <FileText className="h-3.5 w-3.5 text-amber-800 dark:text-amber-400" />
                                    <span className="font-bold text-neutral-800 dark:text-neutral-250 truncate">{match.filename}</span>
                                    <span className="text-[10px] text-neutral-400 font-mono">({match.source})</span>
                                  </div>
                                  <span className="rounded bg-emerald-500/10 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 tracking-wider font-mono">
                                    {match.score}% Match
                                  </span>
                                </div>
                                <pre className="p-3 rounded-lg bg-neutral-900 text-neutral-300 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap leading-relaxed select-all">
                                  {match.snippet}
                                </pre>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Column 3: Upload & Directly Add Form */}
                <div className="space-y-8">
                  
                  {/* Form Card */}
                  <div className="rounded-2xl border border-neutral-200/60 dark:border-neutral-800/60 bg-[#FDFCFB] dark:bg-neutral-900 p-6 space-y-6 shadow-xs">
                    <div className="flex items-center gap-2 border-b border-neutral-100 dark:border-neutral-850 pb-3">
                      <UploadCloud className="h-4.5 w-4.5 text-amber-800 dark:text-amber-400" />
                      <h4 className="font-semibold text-sm text-neutral-800 dark:text-neutral-200">Ingest New Data</h4>
                    </div>

                    {/* Upload File Section */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 tracking-wide uppercase font-mono">Upload local file</label>
                      <div 
                        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                        onDragLeave={() => setDragActive(false)}
                        onDrop={async (e) => {
                          e.preventDefault();
                          setDragActive(false);
                          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                            const file = e.dataTransfer.files[0];
                            const text = await file.text();
                            let cat = "General Documentation";
                            let fileType = file.type || "text/plain";
                            if (file.name.endsWith(".ts") || file.name.endsWith(".tsx")) { cat = "TypeScript"; fileType = "application/typescript"; }
                            else if (file.name.endsWith(".js") || file.name.endsWith(".jsx")) { cat = "JavaScript"; fileType = "application/javascript"; }
                            else if (file.name.endsWith(".css")) { cat = "CSS Layout"; fileType = "text/css"; }
                            else if (file.name.endsWith(".json")) { cat = "JSON Config"; fileType = "application/json"; }
                            else if (file.name.endsWith(".md")) { cat = "Markdown"; fileType = "text/markdown"; }

                            await handleAddSnippet(file.name, cat, text, fileType);
                          }
                        }}
                        className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
                          dragActive 
                            ? "border-amber-800 bg-amber-900/[0.02]" 
                            : "border-neutral-200/70 dark:border-neutral-800/75 hover:border-amber-900/30 dark:hover:border-amber-100/30 bg-[#FBF9F6]/50 dark:bg-[#0b0b0b]/30"
                        }`}
                      >
                        <UploadCloud className="h-8 w-8 text-neutral-400 animate-pulse mb-2 shrink-0" />
                        <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                          {isUploading ? "Uploading & parsing file..." : "Drag and drop file here"}
                        </span>
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">Supports plain text, .json, .md guides</span>
                        
                        <input
                          id="file-picker-input"
                          type="file"
                          accept=".txt,.md,.json,.js,.ts,.tsx,.jsx"
                          onChange={handleUploadFile}
                          className="hidden"
                        />
                        <button
                          id="browse-files-btn"
                          type="button"
                          onClick={() => document.getElementById("file-picker-input")?.click()}
                          className="mt-3 rounded-lg bg-neutral-200 dark:bg-neutral-800 hover:opacity-90 px-3 py-1.5 text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 active:scale-[0.98]"
                        >
                          Browse Files
                        </button>
                      </div>
                    </div>

                    <div className="relative flex py-1 items-center">
                      <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800"></div>
                      <span className="flex-shrink mx-4 text-[10px] font-mono text-neutral-400 font-bold uppercase">Or create raw code snippet</span>
                      <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800"></div>
                    </div>

                    {/* Directly Type Snippet Form */}
                    <form 
                      id="raw-snippet-form"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!newSnippetFilename.trim() || !newSnippetContent.trim()) return;
                        await handleAddSnippet(newSnippetFilename, newSnippetCategory, newSnippetContent);
                      }}
                      className="space-y-4"
                    >
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 tracking-wide uppercase font-mono">Snippet filename</label>
                        <input
                          id="snippet-filename-input"
                          type="text"
                          required
                          value={newSnippetFilename}
                          onChange={(e) => setNewSnippetFilename(e.target.value)}
                          placeholder="e.g. auth_handler.ts"
                          className="w-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-[#FBF9F6] dark:bg-neutral-950 px-3.5 py-2.5 text-xs font-semibold text-neutral-800 dark:text-neutral-100 outline-hidden focus:border-amber-800 dark:focus:border-amber-400"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5 col-span-2">
                          <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 tracking-wide uppercase font-mono">Category tag</label>
                          <select
                            id="snippet-category-select"
                            value={newSnippetCategory}
                            onChange={(e) => setNewSnippetCategory(e.target.value)}
                            className="w-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-[#FBF9F6] dark:bg-neutral-950 px-3.5 py-2.5 text-xs font-semibold text-neutral-800 dark:text-neutral-150 outline-hidden focus:border-amber-800"
                          >
                            <option value="TypeScript">TypeScript</option>
                            <option value="JavaScript">JavaScript</option>
                            <option value="Tailwind">Tailwind</option>
                            <option value="React">React</option>
                            <option value="General Documentation">General Documentation</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 tracking-wide uppercase font-mono">Raw Content / Code block</label>
                        <textarea
                          id="snippet-content-input"
                          required
                          rows={6}
                          value={newSnippetContent}
                          onChange={(e) => setNewSnippetContent(e.target.value)}
                          placeholder="Paste or write raw code or guide content here..."
                          className="w-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-[#FBF9F6] dark:bg-neutral-950 p-3.5 font-mono text-xs text-neutral-850 dark:text-neutral-100 outline-hidden focus:border-amber-800 focus:ring-1 focus:ring-amber-800/20"
                        />
                      </div>

                      <button
                        id="save-snippet-btn"
                        type="submit"
                        disabled={isAddingSnippet || !newSnippetFilename.trim() || !newSnippetContent.trim()}
                        className={`w-full py-2.5 rounded-xl text-xs font-bold shadow-xs transition-all ${
                          isAddingSnippet 
                            ? "bg-neutral-100 dark:bg-neutral-850 text-neutral-400 cursor-not-allowed"
                            : "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:opacity-90 active:scale-[0.98]"
                        }`}
                      >
                        {isAddingSnippet ? "Saving to Knowledge..." : "Add to Library"}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Mobile Floating Action Button (FAB) & Toolbar Menu at bottom-4 left-4 (< md) */}
      <div className="fixed bottom-4 left-4 z-40 md:hidden">
        <AnimatePresence>
          {isMobileSettingsFabOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="mb-2.5 w-60 rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-[#FDFCFB]/95 dark:bg-neutral-900/95 backdrop-blur-md shadow-2xl p-2.5 space-y-1 font-mono text-xs"
            >
              <div className="px-2.5 py-1.5 border-b border-neutral-200/60 dark:border-neutral-800/60 flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">Settings & Tools</span>
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                  <span className="truncate max-w-[90px]">{selectedModel}</span>
                </div>
              </div>

              <button
                id="mobile-fab-byok-settings-btn"
                onClick={() => {
                  setIsSettingsOpen(true);
                  setIsMobileSettingsFabOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-left cursor-pointer transition-colors"
              >
                <Settings className="h-4 w-4 text-amber-800 dark:text-amber-400 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-xs">BYOK Settings</span>
                  <span className="text-[10px] text-neutral-400 truncate">Manage API key & model</span>
                </div>
              </button>

              {!isInstalled && (
                <button
                  id="mobile-fab-install-app-btn"
                  onClick={() => {
                    promptInstall();
                    setIsMobileSettingsFabOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-amber-900 dark:text-amber-300 hover:bg-amber-500/10 text-left cursor-pointer transition-colors"
                >
                  <Smartphone className="h-4 w-4 text-amber-500 animate-pulse shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-xs">Install App</span>
                    <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80 truncate">Add to home screen</span>
                  </div>
                </button>
              )}

              <button
                id="mobile-fab-switch-view-btn"
                onClick={() => {
                  setActiveTab(activeTab === "chat" ? "api-keys" : "chat");
                  setIsMobileSettingsFabOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-left cursor-pointer transition-colors"
              >
                <Code className="h-4 w-4 text-neutral-500 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-xs">
                    {activeTab === "chat" ? "Developer Tools" : "Return to Chat"}
                  </span>
                  <span className="text-[10px] text-neutral-400 truncate">
                    {activeTab === "chat" ? "Custom API keys & DB" : "Active workspace"}
                  </span>
                </div>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          id="mobile-settings-fab-btn"
          onClick={() => setIsMobileSettingsFabOpen(!isMobileSettingsFabOpen)}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800/80 text-neutral-700 dark:text-neutral-200 shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
          title="Mobile Settings & Tools"
        >
          {isMobileSettingsFabOpen ? (
            <X className="h-5 w-5 text-neutral-600 dark:text-neutral-300" />
          ) : (
            <SlidersHorizontal className="h-5 w-5 text-amber-800 dark:text-amber-400" />
          )}
        </button>
      </div>

      {/* 3. MODAL: GENERATE KEY NAME & PROMPT */}
      <AnimatePresence>
        {isGeneratingKey && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              id="modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!generatedKeyDetails) {
                  setIsGeneratingKey(false);
                  setNewKeyName("");
                }
              }}
              className="absolute inset-0 bg-black/50 backdrop-blur-xs"
            />

            {/* Modal Body Card */}
            <motion.div
              id="modal-content"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-[#FDFCFB] dark:bg-neutral-900 p-6 shadow-xl z-10"
            >
              
              {!generatedKeyDetails ? (
                /* STEP 1: Enter Key Name */
                <form id="create-key-form" onSubmit={handleGenerateKey} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-base font-serif font-semibold text-neutral-800 dark:text-neutral-100">
                      Create Developer API Key
                    </h4>
                    <button
                      id="close-key-form-button"
                      type="button"
                      onClick={() => setIsGeneratingKey(false)}
                      className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-700 dark:hover:text-neutral-200"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    Provide a readable identifier name to organize your keys. This name will appear inside your developer usage charts and billing telemetry.
                  </p>

                  <div className="space-y-1.5">
                    <label htmlFor="key-name-input" className="text-[11px] font-mono font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                      Key Name Identifier
                    </label>
                    <input
                      id="key-name-input"
                      type="text"
                      required
                      placeholder="e.g., Main Workspace, Dev SDK"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      className="w-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3.5 py-2 text-sm text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-amber-900/20 dark:focus:ring-amber-100/20"
                    />
                  </div>

                  <div className="flex justify-end gap-2.5 pt-2">
                    <button
                      id="cancel-key-generation-button"
                      type="button"
                      onClick={() => {
                        setIsGeneratingKey(false);
                        setNewKeyName("");
                      }}
                      className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-transparent px-4 py-2.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      id="submit-key-generation-button"
                      type="submit"
                      disabled={!newKeyName.trim()}
                      className="rounded-xl bg-amber-900 dark:bg-amber-100 hover:bg-amber-950 dark:hover:bg-white px-4 py-2.5 text-xs font-semibold text-white dark:text-neutral-950 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Generate Key
                    </button>
                  </div>
                </form>
              ) : (
                /* STEP 2: Show Generated Key with Security warning */
                <div id="generated-key-confirmation-step" className="space-y-4">
                  <div className="flex items-center gap-2 text-green-500">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500/10">
                      <Check className="h-4 w-4 stroke-[3px]" />
                    </div>
                    <h4 className="text-base font-serif font-bold text-neutral-800 dark:text-neutral-100">
                      Key Generated Successfully
                    </h4>
                  </div>

                  <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    Make sure to copy your developer API key token now. For your security, **this token will not be displayed again**. If you lose this key, you will need to revoke it and generate a new one.
                  </p>

                  <div className="space-y-1.5">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                      API Token ({generatedKeyDetails.name})
                    </span>
                    <div className="flex items-center gap-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 p-3 font-mono text-xs text-neutral-800 dark:text-neutral-200 overflow-hidden select-all relative">
                      <span className="truncate pr-12 w-full select-all">{generatedKeyDetails.key}</span>
                      <button
                        id="modal-copy-key-token-button"
                        onClick={() => handleCopy(generatedKeyDetails.key, "modal-copy")}
                        className="absolute right-2 top-2 p-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 shadow-sm"
                        title="Copy key"
                      >
                        {copySuccessId === "modal-copy" ? (
                          <Check className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      id="close-key-generation-success-modal"
                      type="button"
                      onClick={() => {
                        setIsGeneratingKey(false);
                        setGeneratedKeyDetails(null);
                      }}
                      className="rounded-xl bg-amber-900 dark:bg-amber-100 hover:bg-amber-950 dark:hover:bg-white px-5 py-2.5 text-xs font-semibold text-white dark:text-neutral-950 transition-colors shadow-sm"
                    >
                      I have saved this key safely
                    </button>
                  </div>
                </div>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. MODAL: BYOK SETTINGS (GEMINI API KEY) */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              id="settings-modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-xs"
            />

            {/* Modal Body Card */}
            <motion.div
              id="settings-modal-content"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-[#FDFCFB] dark:bg-neutral-900 p-6 shadow-xl z-10"
            >
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-amber-900 dark:text-amber-100" />
                  <h4 className="text-base font-serif font-semibold text-neutral-800 dark:text-neutral-100">
                    BYOK Settings
                  </h4>
                </div>
                <button
                  id="close-settings-button"
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-700 dark:hover:text-neutral-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form id="settings-byok-form" onSubmit={handleSaveSettings} className="space-y-4">
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  Provide your own **Gemini API Key** to power this workspace. Your key is stored strictly inside this browser&apos;s <code className="bg-neutral-200/50 dark:bg-neutral-800 px-1 py-0.5 rounded font-mono">localStorage</code> and is never sent to our database.
                </p>

                <div className="space-y-1.5">
                  <label htmlFor="settings-api-key-input" className="text-[11px] font-mono font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                    Gemini API Key
                  </label>
                  <div className="relative">
                    <input
                      id="settings-api-key-input"
                      type={showApiKeyInSettings ? "text" : "password"}
                      placeholder="AIzaSy..."
                      value={userGeminiApiKey}
                      onChange={(e) => setUserGeminiApiKey(e.target.value)}
                      className="w-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 pl-3.5 pr-10 py-2.5 text-sm font-mono text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-amber-900/20 dark:focus:ring-amber-100/20"
                    />
                    <button
                      id="toggle-settings-key-visibility"
                      type="button"
                      onClick={() => setShowApiKeyInSettings(!showApiKeyInSettings)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                    >
                      {showApiKeyInSettings ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="settings-model-select" className="text-[11px] font-mono font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                    Gemini Model
                  </label>
                  <select
                    id="settings-model-select"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3.5 py-2.5 text-xs font-semibold text-neutral-800 dark:text-neutral-200 focus:outline-hidden focus:ring-2 focus:ring-amber-900/20"
                  >
                    <option value="gemini-3.7-flash">gemini-3.7-flash (Latest)</option>
                    <option value="gemini-3.5-flash">gemini-3.5-flash (Default)</option>
                    <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview</option>
                    <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite</option>
                    <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                    <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                    <option value="gemini-1.5-pro-latest">gemini-1.5-pro</option>
                    <option value="gemini-1.5-flash-latest">gemini-1.5-flash</option>
                  </select>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <button
                    id="clear-settings-key-button"
                    type="button"
                    onClick={handleClearSettings}
                    disabled={!userGeminiApiKey}
                    className="rounded-xl border border-red-200 dark:border-red-900/30 bg-transparent px-4 py-2.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Clear Key
                  </button>

                  <div className="flex gap-2">
                    <button
                      id="cancel-settings-button"
                      type="button"
                      onClick={() => setIsSettingsOpen(false)}
                      className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-transparent px-4 py-2.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      id="submit-settings-byok-button"
                      type="submit"
                      disabled={!userGeminiApiKey.trim()}
                      className="rounded-xl bg-amber-900 dark:bg-amber-100 hover:bg-amber-950 dark:hover:bg-white px-5 py-2.5 text-xs font-semibold text-white dark:text-neutral-950 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                      Save Key
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. MODAL: EXTRACTED CODEBASE FILE EXPLORER */}
      <AnimatePresence>
        {isZipFilesModalOpen && attachedZip && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              id="zip-modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsZipFilesModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />

            {/* Modal Container */}
            <motion.div
              id="zip-modal-content"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="relative w-full max-w-5xl h-[82vh] rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-[#FDFCFB] dark:bg-neutral-900 shadow-2xl z-10 flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200/60 dark:border-neutral-800/60 bg-[#FAF8F5] dark:bg-neutral-900/90">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-900/10 dark:bg-amber-100/10 text-amber-900 dark:text-amber-300">
                    <FolderArchive className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-serif font-bold text-neutral-850 dark:text-neutral-100 flex items-center gap-2">
                      <span>{attachedZip.fileName}</span>
                      <span className="text-xs font-mono font-normal px-2 py-0.5 rounded-md bg-amber-900/10 dark:bg-amber-100/10 text-amber-900 dark:text-amber-200">
                        {attachedZip.totalFiles} Files · {attachedZip.totalSizeKb} KB
                      </span>
                    </h4>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                      Extracted codebase context ready to send with your message
                    </p>
                  </div>
                </div>
                <button
                  id="close-zip-modal-button"
                  type="button"
                  onClick={() => setIsZipFilesModalOpen(false)}
                  className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-200/50 dark:hover:bg-neutral-800 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body: Two-Pane Explorer */}
              <div className="flex flex-1 min-h-0 divide-x divide-neutral-200/60 dark:divide-neutral-800/60">
                
                {/* Left Pane: File List */}
                <div className="w-80 flex flex-col bg-[#F5F2EC]/40 dark:bg-neutral-950/40">
                  <div className="p-3 border-b border-neutral-200/40 dark:border-neutral-800/40">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 block mb-1">
                      Extracted Files ({attachedZip.files.length})
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {attachedZip.files.map((file, fIdx) => {
                      const isSelected = (selectedModalFile?.path || attachedZip.files[0]?.path) === file.path;
                      return (
                        <button
                          key={fIdx}
                          onClick={() => setSelectedModalFile(file)}
                          className={`w-full text-left flex items-start gap-2 px-3 py-2 rounded-xl text-xs font-mono transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-amber-900/10 dark:bg-amber-100/10 text-amber-950 dark:text-amber-100 font-bold border border-amber-900/20"
                              : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50"
                          }`}
                        >
                          <FileCode className={`h-4 w-4 shrink-0 mt-0.5 ${isSelected ? "text-amber-800 dark:text-amber-300" : "text-neutral-400"}`} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate leading-tight">{file.path}</p>
                            <span className="text-[10px] opacity-60 font-sans">{Math.round(file.size / 1024 * 10) / 10} KB</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Right Pane: Code Preview */}
                <div className="flex-1 flex flex-col bg-[#FDFCFB] dark:bg-neutral-900 min-w-0">
                  {selectedModalFile || attachedZip.files[0] ? (
                    (() => {
                      const activeFile = selectedModalFile || attachedZip.files[0];
                      return (
                        <>
                          <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-200/60 dark:border-neutral-800/60 bg-[#FAF8F5] dark:bg-neutral-900/50">
                            <span className="font-mono text-xs font-bold text-neutral-800 dark:text-neutral-200 truncate">
                              {activeFile.path}
                            </span>
                            <button
                              onClick={() => handleCopy(activeFile.content, "zip-modal-" + activeFile.path)}
                              className="flex items-center gap-1 text-xs font-mono px-2 py-1 rounded-md bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:text-amber-800 dark:hover:text-amber-300 transition-colors cursor-pointer"
                            >
                              {copySuccessId === ("zip-modal-" + activeFile.path) ? (
                                <>
                                  <Check className="h-3 w-3 text-green-500" />
                                  <span className="text-green-600">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                          <div className="flex-1 overflow-auto p-4 bg-[#FBF9F6] dark:bg-neutral-950 font-mono text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed select-all">
                            <pre className="whitespace-pre">
                              <code>{activeFile.content}</code>
                            </pre>
                          </div>
                        </>
                      );
                    })()
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-xs text-neutral-400 font-mono">
                      Select a file from the list to preview
                    </div>
                  )}
                </div>

              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3 border-t border-neutral-200/60 dark:border-neutral-800/60 bg-[#FAF8F5] dark:bg-neutral-900 flex items-center justify-between">
                <span className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                  Press <strong>Enter</strong> in the chat to send your question along with this codebase.
                </span>
                <button
                  type="button"
                  onClick={() => setIsZipFilesModalOpen(false)}
                  className="rounded-xl bg-amber-900 dark:bg-amber-100 hover:bg-amber-950 dark:hover:bg-white px-5 py-2 text-xs font-semibold text-white dark:text-neutral-950 transition-colors shadow-xs cursor-pointer"
                >
                  Close Preview
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. MODAL: IMAGE LIGHTBOX PREVIEW */}
      <AnimatePresence>
        {previewModalImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              id="image-lightbox-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewModalImage(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />

            {/* Lightbox Container */}
            <motion.div
              id="image-lightbox-content"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative max-w-4xl max-h-[90vh] rounded-2xl border border-neutral-700 bg-neutral-900 shadow-2xl z-10 flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-800 bg-neutral-950">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-blue-400" />
                  <span className="text-sm font-mono font-bold text-neutral-200 truncate max-w-md">
                    {previewModalImage.fileName}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewModalImage(null)}
                  className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Image Body */}
              <div className="flex items-center justify-center p-4 bg-black/40 overflow-auto max-h-[75vh]">
                <img 
                  src={previewModalImage.dataUrl} 
                  alt={previewModalImage.fileName} 
                  className="max-h-[70vh] w-auto max-w-full rounded-lg object-contain shadow-md"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
