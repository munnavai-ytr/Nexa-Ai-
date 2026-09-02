/* eslint-disable no-restricted-globals */
// Dedicated Web Worker for background ZIP archive processing
// Offloads all JSZip decoding, text parsing, and string concatenation from main UI thread.

try {
  importScripts('/jszip.min.js');
} catch (e) {
  try {
    importScripts('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');
  } catch (e2) {
    console.error('Failed to load JSZip in Web Worker:', e2);
  }
}

function detectLanguageFromPath(filePath) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'typescript';
  if (lower.endsWith('.js') || lower.endsWith('.jsx') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) return 'javascript';
  if (lower.endsWith('.py') || lower.endsWith('.pyw')) return 'python';
  if (lower.endsWith('.json') || lower.endsWith('.json5') || lower.endsWith('.jsonc')) return 'json';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
  if (lower.endsWith('.css')) return 'css';
  if (lower.endsWith('.scss') || lower.endsWith('.sass') || lower.endsWith('.less')) return 'scss';
  if (lower.endsWith('.md') || lower.endsWith('.markdown') || lower.endsWith('.mdx')) return 'markdown';
  if (lower.endsWith('.rs')) return 'rust';
  if (lower.endsWith('.go')) return 'go';
  if (lower.endsWith('.c') || lower.endsWith('.h')) return 'c';
  if (lower.endsWith('.cpp') || lower.endsWith('.hpp') || lower.endsWith('.cc') || lower.endsWith('.cxx')) return 'cpp';
  if (lower.endsWith('.java')) return 'java';
  if (lower.endsWith('.kt') || lower.endsWith('.kts')) return 'kotlin';
  if (lower.endsWith('.sql')) return 'sql';
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'yaml';
  if (lower.endsWith('.sh') || lower.endsWith('.bash') || lower.endsWith('.zsh')) return 'bash';
  if (lower.endsWith('.toml')) return 'toml';
  if (lower.endsWith('.xml') || lower.endsWith('.svg')) return 'xml';
  if (lower.endsWith('.env') || lower.endsWith('.env.example')) return 'shell';
  if (lower.endsWith('.graphql') || lower.endsWith('.gql')) return 'graphql';
  if (lower.endsWith('.prisma')) return 'prisma';
  if (lower.endsWith('.php')) return 'php';
  if (lower.endsWith('.rb')) return 'ruby';
  if (lower.endsWith('.swift')) return 'swift';
  return 'plaintext';
}

const IGNORED_FOLDERS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', '.vercel', 'out', 'coverage',
  '.turbo', '.cache', '__pycache__', '.pytest_cache', 'venv', '.venv', 'vendor',
  '.idea', '.vscode', '.gradle', 'target', '.terraform'
]);

const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'svg', 'bmp', 'tiff', 'avif',
  'pdf', 'zip', 'tar', 'gz', 'tgz', 'rar', '7z', 'bz2', 'xz', 'iso', 'dmg',
  'mp4', 'mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'avi', 'mov', 'webm', 'mkv', 'wmv',
  'ttf', 'woff', 'woff2', 'eot', 'otf',
  'exe', 'dll', 'so', 'dylib', 'bin', 'wasm', 'class', 'jar', 'pyc',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'
]);

const IGNORED_LOCKFILES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lock', 'bun.lockb',
  'composer.lock', 'cargo.lock', 'gemfile.lock', 'poetry.lock'
]);

const SUPPORTED_CODE_EXTENSIONS = new Set([
  'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'mts', 'cts',
  'json', 'json5', 'jsonc',
  'html', 'htm',
  'css', 'scss', 'sass', 'less',
  'md', 'markdown', 'mdx',
  'sql', 'yml', 'yaml', 'prisma', 'xml', 'toml', 'ini', 'graphql', 'gql',
  'py', 'pyw', 'go', 'rs', 'c', 'h', 'cpp', 'hpp', 'cc', 'cxx',
  'java', 'kt', 'kts', 'swift', 'rb', 'php', 'sh', 'bash', 'zsh', 'txt'
]);

function isIgnoredDirectory(relativePath) {
  const normalized = relativePath.replace(/\\/g, '/');
  const segments = normalized.split('/');
  for (let i = 0; i < segments.length - 1; i++) {
    if (IGNORED_FOLDERS.has(segments[i].toLowerCase())) return true;
  }
  return false;
}

function isSupportedCodeFile(relativePath) {
  const baseName = relativePath.split('/').pop() || relativePath;
  const lowerBase = baseName.toLowerCase();
  if (IGNORED_LOCKFILES.has(lowerBase)) return false;
  const ext = lowerBase.includes('.') ? lowerBase.split('.').pop() || '' : '';
  if (BINARY_EXTENSIONS.has(ext)) return false;
  if (
    lowerBase === '.env.example' || lowerBase === '.env' ||
    lowerBase === '.env.local' || lowerBase === '.gitignore' ||
    lowerBase === 'dockerfile' || lowerBase === 'makefile' ||
    lowerBase.includes('.config.') || lowerBase.endsWith('.config.js') ||
    lowerBase.endsWith('.config.ts') || lowerBase.endsWith('.config.mjs')
  ) {
    return true;
  }
  return SUPPORTED_CODE_EXTENSIONS.has(ext);
}

self.onmessage = async function (e) {
  const { id, type, arrayBuffer, fileName } = e.data;
  if (type !== 'PROCESS_ZIP') return;

  try {
    if (typeof JSZip === 'undefined') {
      throw new Error('JSZip library could not be loaded in Web Worker.');
    }

    self.postMessage({ id, type: 'PROGRESS', message: 'Unpacking ZIP archive in background worker...' });

    const zip = await JSZip.loadAsync(arrayBuffer);
    const entries = Object.keys(zip.files);
    const validFiles = [];
    let totalFilesCount = 0;
    const textDecoder = new TextDecoder('utf-8', { fatal: false });
    const MAX_SINGLE_FILE_BYTES = 1024 * 1024; // 1 MB limit

    for (let i = 0; i < entries.length; i++) {
      const relativePath = entries[i];
      const zipEntry = zip.files[relativePath];
      if (zipEntry.dir) continue;

      totalFilesCount++;

      if (isIgnoredDirectory(relativePath) || !isSupportedCodeFile(relativePath)) {
        continue;
      }

      try {
        const uncompressedSize = zipEntry._data && zipEntry._data.uncompressedSize;
        if (typeof uncompressedSize === 'number' && uncompressedSize > MAX_SINGLE_FILE_BYTES) {
          continue;
        }

        const uint8 = await zipEntry.async('uint8array');
        if (!uint8 || uint8.byteLength === 0 || uint8.byteLength > MAX_SINGLE_FILE_BYTES) {
          continue;
        }

        const content = textDecoder.decode(uint8);
        if (!content || content.trim().length === 0) {
          continue;
        }

        const baseName = relativePath.split('/').pop() || relativePath;
        const lang = detectLanguageFromPath(relativePath);

        validFiles.push({
          name: baseName,
          path: relativePath,
          size: content.length,
          content: content,
          language: lang
        });
      } catch (err) {
        continue;
      }

      // Report progress periodically without spamming main thread
      if (totalFilesCount % 25 === 0) {
        self.postMessage({
          id,
          type: 'PROGRESS',
          message: `📦 Analyzed ${totalFilesCount} files (Extracted ${validFiles.length} core code files)...`,
          totalFilesCount,
          validFilesCount: validFiles.length
        });
      }
    }

    self.postMessage({
      id,
      type: 'PROGRESS',
      message: `📦 Analyzed ${totalFilesCount} files (Extracted ${validFiles.length} core code files)...`,
      totalFilesCount,
      validFilesCount: validFiles.length
    });

    // Concatenate code context in background worker
    let formattedContext = '';
    for (let j = 0; j < validFiles.length; j++) {
      const f = validFiles[j];
      formattedContext += `// File: ${f.path}\n${f.content}\n\n`;
    }

    const totalSizeKb = Math.round(validFiles.reduce((acc, curr) => acc + curr.size, 0) / 1024);

    const result = {
      fileName: fileName || 'archive.zip',
      totalFiles: validFiles.length,
      totalScanned: totalFilesCount,
      totalSizeKb,
      files: validFiles,
      formattedContext
    };

    self.postMessage({ id, type: 'SUCCESS', result });
  } catch (err) {
    self.postMessage({ id, type: 'ERROR', error: err.message || 'Worker extraction failed' });
  }
};
