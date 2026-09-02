import JSZip from "jszip";

export interface ExtractedCodeFile {
  name: string;
  path: string;
  size: number;
  content: string;
  language: string;
}

export interface ExtractedCodebase {
  fileName: string;
  totalFiles: number;
  totalScanned: number;
  totalSizeKb: number;
  files: ExtractedCodeFile[];
  formattedContext: string;
}

export interface ZipProgressStats {
  totalFilesCount: number;
  validFilesCount: number;
}

// Map file extensions to Markdown syntax highlighter languages
export function detectLanguageFromPath(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".ts") || lower.endsWith(".tsx")) return "typescript";
  if (lower.endsWith(".js") || lower.endsWith(".jsx") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) return "javascript";
  if (lower.endsWith(".py") || lower.endsWith(".pyw")) return "python";
  if (lower.endsWith(".json") || lower.endsWith(".json5") || lower.endsWith(".jsonc")) return "json";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  if (lower.endsWith(".css")) return "css";
  if (lower.endsWith(".scss") || lower.endsWith(".sass") || lower.endsWith(".less")) return "scss";
  if (lower.endsWith(".md") || lower.endsWith(".markdown") || lower.endsWith(".mdx")) return "markdown";
  if (lower.endsWith(".rs")) return "rust";
  if (lower.endsWith(".go")) return "go";
  if (lower.endsWith(".c") || lower.endsWith(".h")) return "c";
  if (lower.endsWith(".cpp") || lower.endsWith(".hpp") || lower.endsWith(".cc") || lower.endsWith(".cxx")) return "cpp";
  if (lower.endsWith(".java")) return "java";
  if (lower.endsWith(".kt") || lower.endsWith(".kts")) return "kotlin";
  if (lower.endsWith(".sql")) return "sql";
  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) return "yaml";
  if (lower.endsWith(".sh") || lower.endsWith(".bash") || lower.endsWith(".zsh")) return "bash";
  if (lower.endsWith(".toml")) return "toml";
  if (lower.endsWith(".xml") || lower.endsWith(".svg")) return "xml";
  if (lower.endsWith(".env") || lower.endsWith(".env.example")) return "shell";
  if (lower.endsWith(".graphql") || lower.endsWith(".gql")) return "graphql";
  if (lower.endsWith(".prisma")) return "prisma";
  if (lower.endsWith(".php")) return "php";
  if (lower.endsWith(".rb")) return "ruby";
  if (lower.endsWith(".swift")) return "swift";
  return "plaintext";
}

// 1. Smart File Filtering: Folders to automatically IGNORE/SKIP
const IGNORED_FOLDERS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  ".vercel",
  "out",
  "coverage",
  // Common build, cache, and editor artifacts
  ".turbo",
  ".cache",
  "__pycache__",
  ".pytest_cache",
  "venv",
  ".venv",
  "vendor",
  ".idea",
  ".vscode",
  ".gradle",
  "target",
  ".terraform"
]);

// 1. Smart File Filtering: Non-text/Binary files to automatically IGNORE/SKIP
const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "ico", "svg", "bmp", "tiff", "avif",
  "pdf", "zip", "tar", "gz", "tgz", "rar", "7z", "bz2", "xz", "iso", "dmg",
  "mp4", "mp3", "wav", "ogg", "m4a", "flac", "aac", "avi", "mov", "webm", "mkv", "wmv",
  "ttf", "woff", "woff2", "eot", "otf",
  "exe", "dll", "so", "dylib", "bin", "wasm", "class", "jar", "pyc",
  "doc", "docx", "xls", "xlsx", "ppt", "pptx"
]);

// Large lockfiles to skip (prevent megabytes of minified package hashes)
const IGNORED_LOCKFILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lock",
  "bun.lockb",
  "composer.lock",
  "cargo.lock",
  "gemfile.lock",
  "poetry.lock"
]);

// 2. Supported Code Extensions: Only process text-based source files
const SUPPORTED_CODE_EXTENSIONS = new Set([
  // JavaScript & TypeScript
  "js", "jsx", "ts", "tsx", "mjs", "cjs", "mts", "cts",
  // Data & Configuration
  "json", "json5", "jsonc",
  "html", "htm",
  "css", "scss", "sass", "less",
  "md", "markdown", "mdx",
  "sql",
  "yml", "yaml",
  "prisma",
  "xml", "toml", "ini", "graphql", "gql",
  // Additional core languages
  "py", "pyw", "go", "rs", "c", "h", "cpp", "hpp", "cc", "cxx",
  "java", "kt", "kts", "swift", "rb", "php", "sh", "bash", "zsh", "txt"
]);

/**
 * Check if the entry is inside an ignored directory.
 */
export function isIgnoredDirectory(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  const segments = normalized.split("/");
  // Check any directory segment preceding the file name
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i].toLowerCase();
    if (IGNORED_FOLDERS.has(seg)) {
      return true;
    }
  }
  return false;
}

/**
 * Determine if a file is a valid text-based source code file to extract.
 */
export function isSupportedCodeFile(relativePath: string): boolean {
  const baseName = relativePath.split("/").pop() || relativePath;
  const lowerBase = baseName.toLowerCase();

  // Check ignored lockfiles
  if (IGNORED_LOCKFILES.has(lowerBase)) return false;

  // Check binary extensions
  const ext = lowerBase.includes(".") ? lowerBase.split(".").pop() || "" : "";
  if (BINARY_EXTENSIONS.has(ext)) return false;

  // Supported special configuration files and dotfiles
  if (
    lowerBase === ".env.example" ||
    lowerBase === ".env" ||
    lowerBase === ".env.local" ||
    lowerBase === ".gitignore" ||
    lowerBase === "dockerfile" ||
    lowerBase === "makefile"
  ) {
    return true;
  }

  // Configuration files like tailwind.config.js, next.config.ts, vite.config.js, etc.
  if (
    lowerBase.includes(".config.") ||
    lowerBase.endsWith(".config.js") ||
    lowerBase.endsWith(".config.ts") ||
    lowerBase.endsWith(".config.mjs")
  ) {
    return true;
  }

  // Check text source extension
  return SUPPORTED_CODE_EXTENSIONS.has(ext);
}

/**
 * Optimized client-side codebase extractor for 700+ files.
 * Offloads all JSZip parsing, decoding, and extraction to a dedicated Web Worker,
 * keeping the main UI thread at a smooth 60 FPS without layout or input freezes.
 */
export async function processZipFile(
  file: File,
  onProgress?: (msg: string, stats?: ZipProgressStats) => void
): Promise<ExtractedCodebase> {
  onProgress?.("Offloading ZIP archive to background Web Worker...");

  // 1. Check for Web Worker availability
  if (typeof window !== "undefined" && typeof Worker !== "undefined") {
    try {
      const arrayBuffer = await file.arrayBuffer();

      return await new Promise<ExtractedCodebase>((resolve, reject) => {
        let worker: Worker | null = null;
        try {
          worker = new Worker("/zipWorker.js");
        } catch (workerInitErr) {
          reject(workerInitErr);
          return;
        }

        const msgId = "zip_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);

        worker.onmessage = (e: MessageEvent) => {
          const data = e.data;
          if (!data || data.id !== msgId) return;

          if (data.type === "PROGRESS") {
            onProgress?.(data.message, {
              totalFilesCount: data.totalFilesCount || 0,
              validFilesCount: data.validFilesCount || 0
            });
          } else if (data.type === "SUCCESS") {
            if (worker) {
              worker.terminate();
              worker = null;
            }
            resolve(data.result);
          } else if (data.type === "ERROR") {
            if (worker) {
              worker.terminate();
              worker = null;
            }
            reject(new Error(data.error || "Web Worker failed to process ZIP"));
          }
        };

        worker.onerror = (err) => {
          if (worker) {
            worker.terminate();
            worker = null;
          }
          reject(new Error(err.message || "Web Worker execution error"));
        };

        // Transfer arrayBuffer to worker thread for zero-copy high performance
        worker.postMessage(
          {
            id: msgId,
            type: "PROCESS_ZIP",
            arrayBuffer,
            fileName: file.name
          },
          [arrayBuffer]
        );
      });
    } catch (workerErr) {
      console.warn("Web Worker processing failed, falling back to main-thread async fallback:", workerErr);
    }
  }

  // 2. Main-thread asynchronous fallback (if Worker is unavailable or fails)
  onProgress?.("Unpacking ZIP archive in memory...");
  const arrayBuffer = await file.arrayBuffer();

  const zip = await JSZip.loadAsync(arrayBuffer);
  const entries = Object.keys(zip.files);

  const validFiles: ExtractedCodeFile[] = [];
  let totalFilesCount = 0;

  const textDecoder = new TextDecoder("utf-8", { fatal: false });
  const MAX_SINGLE_FILE_BYTES = 1024 * 1024; // 1 MB limit

  for (const relativePath of entries) {
    const zipEntry = zip.files[relativePath];
    if (zipEntry.dir) continue;

    totalFilesCount++;

    if (isIgnoredDirectory(relativePath) || !isSupportedCodeFile(relativePath)) {
      continue;
    }

    try {
      const uncompressedSize = (zipEntry as any)._data?.uncompressedSize;
      if (typeof uncompressedSize === "number" && uncompressedSize > MAX_SINGLE_FILE_BYTES) {
        continue;
      }

      const uint8 = await zipEntry.async("uint8array");
      if (!uint8 || uint8.byteLength === 0 || uint8.byteLength > MAX_SINGLE_FILE_BYTES) {
        continue;
      }

      const content = textDecoder.decode(uint8);
      if (!content || content.trim().length === 0) {
        continue;
      }

      const baseName = relativePath.split("/").pop() || relativePath;
      const lang = detectLanguageFromPath(relativePath);

      validFiles.push({
        name: baseName,
        path: relativePath,
        size: content.length,
        content: content,
        language: lang
      });
    } catch {
      continue;
    }

    if (totalFilesCount % 20 === 0) {
      onProgress?.(
        `📦 Analyzed ${totalFilesCount} files (Extracted ${validFiles.length} core code files)...`,
        { totalFilesCount, validFilesCount: validFiles.length }
      );
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  onProgress?.(
    `📦 Analyzed ${totalFilesCount} files (Extracted ${validFiles.length} core code files)...`,
    { totalFilesCount, validFilesCount: validFiles.length }
  );

  let formattedContext = "";
  for (const f of validFiles) {
    formattedContext += `// File: ${f.path}\n${f.content}\n\n`;
  }

  const totalSizeKb = Math.round(validFiles.reduce((acc, curr) => acc + curr.size, 0) / 1024);

  return {
    fileName: file.name,
    totalFiles: validFiles.length,
    totalScanned: totalFilesCount,
    totalSizeKb,
    files: validFiles,
    formattedContext
  };
}

/**
 * Single file processor with unified header format.
 */
export async function processSingleFile(file: File): Promise<ExtractedCodebase> {
  const text = await file.text();
  const lang = detectLanguageFromPath(file.name);
  const size = text.length;

  const validFiles: ExtractedCodeFile[] = [
    {
      name: file.name,
      path: file.name,
      size,
      content: text,
      language: lang
    }
  ];

  // Concatenate cleanly with file header
  const formattedContext = `// File: ${file.name}\n${text}\n\n`;

  return {
    fileName: file.name,
    totalFiles: 1,
    totalScanned: 1,
    totalSizeKb: Math.max(1, Math.round(size / 1024)),
    files: validFiles,
    formattedContext
  };
}
