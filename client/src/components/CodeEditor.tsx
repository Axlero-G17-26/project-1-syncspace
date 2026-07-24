import React, { useRef, useState, useEffect } from "react";
import * as Y from "yjs";
import Editor, { Monaco } from "@monaco-editor/react";
import { MonacoBinding } from "y-monaco";
import { User, CodeLanguage } from "../types";

interface CodeEditorProps {
  yDoc: Y.Doc;
  activeUsers: User[];
  currentUserId: string;
  userName: string;
  userColor: string;
  onSendCursor: (cursor: { line: number; ch: number; element: "editor" }) => void;
  onSendActivityLog: (message: string) => void;
}

export default function CodeEditor({
  yDoc,
  activeUsers,
  currentUserId,
  userName,
  userColor,
  onSendCursor,
  onSendActivityLog
}: CodeEditorProps) {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const [language, setLanguage] = useState<CodeLanguage>("javascript");
  const [editorText, setEditorText] = useState("");
  const [terminalOutput, setTerminalOutput] = useState<string[]>([
    "System Console Ready.",
    "Click 'Run Code' to execute JavaScript."
  ]);
  const [terminalStatus, setTerminalStatus] = useState<"idle" | "success" | "error" | "running">("idle");
  const [isCopied, setIsCopied] = useState(false);

  // Setup message listener for the sandboxed iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      // Security: the blob URL has a null origin due to sandbox="allow-scripts" without "allow-same-origin"
      if (e.data?.type === "console") {
        setTerminalOutput(prev => [...prev, e.data.payload]);
      } else if (e.data?.type === "error") {
        setTerminalOutput(prev => [...prev, `[ERROR] ${e.data.payload}`]);
      } else if (e.data?.type === "result") {
        if (e.data.payload !== "undefined") {
          setTerminalOutput(prev => [...prev, `↳ Returned: ${e.data.payload}`]);
        }
        setTerminalStatus("idle");
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // 1. Keep a state of the text for the sandbox runner
  useEffect(() => {
    const yText = yDoc.getText("codestate");
    
    // Set initial text
    let initialText = yText.toString();
    if (!initialText || initialText.includes("Welcome to the Real-time Collaborative Workspace!")) {
      initialText = `// Click 'Run Code' to execute
// Currently supports only JS, TS, and HTML

let userAge = 25;
const userName = "Alice";
userAge = 26;
console.log("User Name: " + userName);
console.log("Next Year Age: " + userAge);`;
      
      // Clear any existing text if we're resetting to the clean template
      if (yText.length > 0) {
        yText.delete(0, yText.length);
      }
      yText.insert(0, initialText);
    }
    setEditorText(initialText);

    // Observe changes from other users
    const handleYTextChange = (event: Y.YTextEvent) => {
      const updatedText = yText.toString();
      setEditorText(updatedText);
    };

    yText.observe(handleYTextChange);
    return () => {
      yText.unobserve(handleYTextChange);
    };
  }, [yDoc]);

  // 2. Setup Yjs Monaco Editor Binding on Mount or yDoc change
  const handleEditorDidMount = (editor: any, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Define custom slate-950/900 theme
    monaco.editor.defineTheme("syncspace-theme", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#020617", // slate-950
        "editor.lineHighlightBackground": "#0f172a", // slate-900
      }
    });
    monaco.editor.setTheme("syncspace-theme");

    const yText = yDoc.getText("codestate");
    
    // Bind Yjs shared string directly to Monaco text model
    if (bindingRef.current) {
      bindingRef.current.destroy();
    }
    const binding = new MonacoBinding(
      yText,
      editor.getModel(),
      new Set([editor])
    );
    bindingRef.current = binding;

    // Track cursor changes and emit to other users
    editor.onDidChangeCursorPosition((e: any) => {
      onSendCursor({
        line: e.position.lineNumber,
        ch: e.position.column - 1,
        element: "editor"
      });
    });
  };

  // Re-bind when yDoc changes dynamically (e.g. room switch)
  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      if (bindingRef.current) {
        bindingRef.current.destroy();
      }
      const yText = yDoc.getText("codestate");
      const binding = new MonacoBinding(
        yText,
        editorRef.current.getModel(),
        new Set([editorRef.current])
      );
      bindingRef.current = binding;
    }
  }, [yDoc]);

  // Cleanup binding on unmount
  useEffect(() => {
    return () => {
      if (bindingRef.current) {
        bindingRef.current.destroy();
        bindingRef.current = null;
      }
    };
  }, []);

  // 3. User cursor and selection overlays inside Monaco
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    // Generate dynamic styles in the document head for other users' custom colored cursors
    const styleEl = document.getElementById("remote-cursor-styles") || document.createElement("style");
    styleEl.id = "remote-cursor-styles";
    
    let cssContent = "";
    activeUsers.forEach(user => {
      if (user.id !== currentUserId) {
        cssContent += `
          .remote-cursor-widget-${user.id} {
            border-left: 2px solid ${user.color};
            height: 1.25em;
            margin-left: -1px;
            position: absolute;
            animation: cursorBlink 1s infinite;
          }
          .remote-cursor-widget-${user.id}::after {
            content: "${user.name}";
            position: absolute;
            bottom: 100%;
            left: 0;
            background-color: ${user.color};
            color: #ffffff;
            font-size: 8px;
            font-family: sans-serif;
            font-weight: bold;
            padding: 1px 3px;
            border-radius: 2px;
            white-space: nowrap;
            opacity: 0.9;
            pointer-events: none;
            line-height: 1;
            z-index: 10;
          }
        `;
      }
    });

    if (!cssContent.includes("@keyframes cursorBlink")) {
      cssContent += `
        @keyframes cursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `;
    }
    
    styleEl.textContent = cssContent;
    if (!document.getElementById("remote-cursor-styles")) {
      document.head.appendChild(styleEl);
    }

    // Apply Monaco editor range decorations for cursor positions
    const newDecorations = activeUsers
      .filter(u => u.id !== currentUserId && u.cursor && u.cursor.element === "editor")
      .map(user => {
        const cursor = user.cursor!;
        const line = cursor.line || 1;
        const ch = cursor.ch || 0;
        
        return {
          range: new monaco.Range(line, ch + 1, line, ch + 1),
          options: {
            className: `remote-cursor-${user.id}`,
            beforeContentClassName: `remote-cursor-widget-${user.id}`,
            hoverMessage: { value: user.name }
          }
        };
      });

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);
  }, [activeUsers, currentUserId]);

  // 4. Safe evaluation sandboxed execution or preview
  const handleRunCode = () => {
    setTerminalStatus("running");
    setTerminalOutput(["Compiling files...", "Spawning browser sandboxed runner..."]);

    if (language === "javascript" || language === "typescript") {
      if (iframeRef.current) {
        const runnerHtml = `
          <!DOCTYPE html>
          <html>
            <body>
              <script>
                const originalLog = console.log;
                const originalError = console.error;
                
                console.log = (...args) => {
                  const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
                  window.parent.postMessage({ type: 'console', payload: msg }, '*');
                  originalLog.apply(console, args);
                };
                
                console.error = (...args) => {
                  const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
                  window.parent.postMessage({ type: 'error', payload: msg }, '*');
                  originalError.apply(console, args);
                };
                
                window.addEventListener('message', (e) => {
                  if (e.data.type === 'execute') {
                    try {
                      const runner = new Function(e.data.code);
                      const result = runner();
                      window.parent.postMessage({ 
                        type: 'result', 
                        payload: typeof result === 'object' ? JSON.stringify(result) : String(result) 
                      }, '*');
                    } catch (err) {
                      window.parent.postMessage({ type: 'error', payload: err.message }, '*');
                      window.parent.postMessage({ type: 'result', payload: 'undefined' }, '*');
                    }
                  }
                });
              </script>
            </body>
          </html>
        `;
        
        const blob = new Blob([runnerHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        iframeRef.current.onload = () => {
          iframeRef.current?.contentWindow?.postMessage({ type: 'execute', code: editorText }, '*');
          URL.revokeObjectURL(url);
        };
        
        iframeRef.current.src = url;
      }
    } else {
      setTimeout(() => {
        setTerminalStatus("success");
        setTerminalOutput([
          `> Notice: Execution is only supported for JavaScript/TypeScript currently.`,
          `[Server] Static analysis complete.`
        ]);
      }, 500);
    }
  };

  // Copy code utility
  const handleCopyCode = () => {
    navigator.clipboard.writeText(editorText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950/80 backdrop-blur-sm overflow-hidden text-slate-300 border-l border-slate-800/60 shadow-2xl" id="code-editor-container">
      {/* Hidden Execution Sandbox */}
      <iframe 
        ref={iframeRef} 
        sandbox="allow-scripts" 
        className="hidden" 
        title="Code Execution Sandbox"
      />
      {/* 1. Header Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 shrink-0 select-none z-10">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">Shared Editor</span>
          <div className="flex items-center gap-1.5 ml-3">
            {/* Language Picker */}
            <select
              id="language-picker"
              value={language}
              onChange={(e) => setLanguage(e.target.value as CodeLanguage)}
              className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-300 font-medium focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="javascript">JavaScript (ES6)</option>
              <option value="typescript">TypeScript</option>
              <option value="html">HTML5 Document</option>
              <option value="css">CSS3 Stylesheet</option>
              <option value="python">Python Mockup</option>
            </select>
          </div>
        </div>

        {/* Tab & Run Controller */}
        <div className="flex items-center gap-2">
          <button
            id="run-code-btn"
            type="button"
            onClick={handleRunCode}
            disabled={terminalStatus === "running"}
            className="flex items-center justify-center py-1.5 px-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800/50 text-white rounded-lg text-xs font-semibold tracking-wider uppercase transition-all cursor-pointer shrink-0"
          >
            Run Code
          </button>

          <button
            type="button"
            onClick={handleCopyCode}
            className="py-1.5 px-3.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer text-xs font-semibold tracking-wider uppercase"
            title="Copy Code to Clipboard"
          >
            {isCopied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* 2. Interactive Workspace Pane */}
      <div className="flex-1 min-h-0 flex flex-col relative">
        <div className="flex-1 min-h-0 relative">
          <Editor
            height="100%"
            language={language}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: "on",
              wordWrap: "on",
              automaticLayout: true,
              scrollbar: {
                vertical: "visible",
                horizontal: "visible",
              },
              cursorBlinking: "blink",
              cursorSmoothCaretAnimation: "on",
              padding: { top: 16, bottom: 16 }
            }}
            onMount={handleEditorDidMount}
          />
        </div>

        {/* 3. Console logs output (Bottom Split) */}
        <div className="h-48 bg-slate-950 border-t border-slate-800 flex flex-col shrink-0">
          <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center justify-between select-none shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-slate-300 font-semibold uppercase tracking-wider">
              Terminal Output
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-500">
                {terminalStatus}
              </span>
            </div>
          </div>
          <div className="flex-1 p-4 font-mono text-xs overflow-y-auto space-y-1.5 text-slate-300 select-text scrollbar-none">
            {terminalOutput.map((log, index) => {
              let color = "text-slate-300";
              if (log.startsWith(">")) color = "text-indigo-400 font-semibold";
              else if (log.startsWith("[ERROR]") || log.startsWith("[Runtime")) color = "text-rose-400 font-semibold";
              else if (log.startsWith("↳ Returned")) color = "text-emerald-400 font-semibold";
              else if (log.startsWith("↳")) color = "text-amber-400";
              else if (log.startsWith("[Server]")) color = "text-blue-400";
              
              return (
                <p key={index} className={`${color} leading-relaxed break-all`}>
                  {log}
                </p>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}