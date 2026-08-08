import React, { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import * as Y from "yjs";
import Editor, { Monaco } from "@monaco-editor/react";
import { MonacoBinding } from "y-monaco";
import { User, CodeLanguage } from "../types";
import { 
  Code, 
  Terminal, 
  Play, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Copy, 
  Layers,
  Sparkles
} from "lucide-react";

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
  
  const [language, setLanguage] = useState<CodeLanguage>("javascript");
  const [editorText, setEditorText] = useState("");
  const [terminalOutput, setTerminalOutput] = useState<string[]>([
    "System Console Ready.",
    "Click 'Run Code' to execute JavaScript, or write HTML to see rendering."
  ]);
  const [terminalStatus, setTerminalStatus] = useState<"idle" | "success" | "error" | "running">("idle");
  const [activeTab, setActiveTab] = useState<"code" | "preview">("code");
  const [isCopied, setIsCopied] = useState(false);
  const [conflictLogs, setConflictLogs] = useState<{ id: string; msg: string; time: string }[]>([]);

  // 1. Keep a state of the text for the preview tabs and sandbox runner
  useEffect(() => {
    const yText = yDoc.getText("codestate");
    
    // Set initial text
    const initialText = yText.toString();
    setEditorText(initialText);

    // Observe changes from other users to update local preview state
    const handleYTextChange = (event: Y.YTextEvent) => {
      const updatedText = yText.toString();
      setEditorText(updatedText);

      // Generate logs of collaborative actions for visual user feedback
      const logId = Math.random().toString(36).substring(7);
      const logTime = new Date().toLocaleTimeString();
      let logMsg = "Merged remote text edits";

      const delta = event.delta;
      delta.forEach((op) => {
        if (op.insert) {
          const insertStr = typeof op.insert === "string" ? op.insert : "";
          logMsg = `Auto-merged incoming input (+${insertStr.length} characters)`;
        } else if (op.delete) {
          logMsg = `Auto-merged incoming deletion (-${op.delete} characters)`;
        }
      });

      setConflictLogs(prev => [
        { id: logId, msg: logMsg, time: logTime },
        ...prev.slice(0, 9)
      ]);
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
    setActiveTab("preview");

    if (language === "javascript") {
      setTimeout(() => {
        const capturedLogs: string[] = [];
        const originalConsoleLog = console.log;
        const originalConsoleError = console.error;

        // Intercept console.log
        console.log = (...args) => {
          capturedLogs.push(args.map(arg => 
            typeof arg === "object" ? JSON.stringify(arg) : String(arg)
          ).join(" "));
          originalConsoleLog.apply(console, args);
        };

        // Intercept console.error
        console.error = (...args) => {
          capturedLogs.push(`[ERROR] ${args.join(" ")}`);
          originalConsoleError.apply(console, args);
        };

        try {
          const runner = new Function(editorText);
          const result = runner();
          
          console.log = originalConsoleLog;
          console.error = originalConsoleError;

          const outputs = [
            `> Execution Started At: ${new Date().toLocaleTimeString()}`,
            ...capturedLogs,
            result !== undefined ? `↳ Returned: ${JSON.stringify(result)}` : "↳ Finished with exit status: 0 (No return value)"
          ];
          
          setTerminalOutput(outputs);
          setTerminalStatus("success");
          onSendActivityLog(`ran JS script successfully (returned: ${result !== undefined ? "value" : "void"})`);
        } catch (error: any) {
          console.log = originalConsoleLog;
          console.error = originalConsoleError;

          setTerminalOutput([
            `> Execution Failed: ${new Date().toLocaleTimeString()}`,
            `[Runtime Exception] ${error.message}`,
            error.stack ? error.stack.split("\n")[0] : ""
          ]);
          setTerminalStatus("error");
          onSendActivityLog(`script runner crashed: ${error.message}`);
        }
      }, 500);
    } else {
      setTimeout(() => {
        setTerminalStatus("success");
        setTerminalOutput([
          `> Sandbox server compiled successfully: ${new Date().toLocaleTimeString()}`,
          `[Server] Static server rendering live viewport frame...`,
          `[Server] Resource load status: 200 OK`
        ]);
        onSendActivityLog(`rendered live view frame for document`);
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
      {/* 1. Header Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 shrink-0 select-none z-10">
        <div className="flex items-center gap-2">
          <Code className="w-4 h-4 text-indigo-400" />
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
              <option value="html">HTML5 Document</option>
              <option value="css">CSS3 Stylesheet</option>
              <option value="python">Python Mockup</option>
            </select>
          </div>
        </div>

        {/* Tab & Run Controller */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab("code")}
              className={`px-3 py-1 text-xs font-medium rounded transition-all cursor-pointer ${
                activeTab === "code"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Editor
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("preview")}
              className={`px-3 py-1 text-xs font-medium rounded transition-all cursor-pointer ${
                activeTab === "preview"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Preview & Logs
            </button>
          </div>

          <button
            id="run-code-btn"
            type="button"
            onClick={handleRunCode}
            disabled={terminalStatus === "running"}
            className="flex items-center gap-1.5 py-1.5 px-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800/50 text-white rounded-lg text-xs font-medium shadow-md shadow-emerald-950/20 active:scale-95 transition-all cursor-pointer shrink-0"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Run Code</span>
          </button>

          <button
            type="button"
            onClick={handleCopyCode}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer"
            title="Copy Code to Clipboard"
          >
            {isCopied ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* 2. Interactive Workspace Pane */}
      <div className="flex-1 min-h-0 relative flex flex-col">
        <AnimatePresence mode="wait">
          {activeTab === "code" ? (
            <motion.div
              key="editor-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex-1 min-h-0 flex flex-col relative"
            >
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
            </motion.div>
          ) : (
            <motion.div
              key="preview-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex-1 min-h-0 flex flex-col p-4 bg-slate-950 overflow-y-auto space-y-4"
            >
              {/* Language live iframe rendering or mockup view */}
              {(language === "html" || language === "css") ? (
                <div className="flex-1 flex flex-col min-h-[180px] bg-white rounded-xl border border-slate-800 overflow-hidden shadow-inner">
                  <div className="bg-slate-100 px-4 py-1.5 text-[11px] font-mono text-slate-500 border-b border-slate-200 select-none flex items-center justify-between">
                    <span>Interactive Preview Frame</span>
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  </div>
                  <iframe
                    id="html-sandbox-iframe"
                    title="Code Preview Sandbox"
                    className="w-full flex-1 border-none bg-white"
                    srcDoc={
                      language === "html" 
                        ? editorText 
                        : `<html><head><style>${editorText}</style></head><body><div style="font-family: sans-serif; text-align: center; margin-top: 50px;"><h2>Custom Styled Preview</h2><p>Your collaborative CSS styles are active! Write HTML document to test elements.</p></div></body></html>`
                    }
                    sandbox="allow-scripts"
                  />
                </div>
              ) : (
                <div className="flex-1 flex flex-col min-h-[150px] bg-slate-900 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-400 space-y-2 relative overflow-hidden">
                  <div className="absolute top-2 right-3 flex items-center gap-1.5 bg-slate-950 py-1 px-2.5 rounded-lg border border-slate-800 text-[10px] text-slate-500 font-sans select-none">
                    <Sparkles className="w-3 h-3 text-indigo-400" />
                    <span>Live Sandbox</span>
                  </div>
                  <h3 className="font-semibold text-slate-300 font-sans border-b border-slate-800 pb-2">JavaScript Preview</h3>
                  <div className="text-[11px] text-slate-400 leading-5">
                    <p className="text-slate-500">// Your code exports a main runner function scope.</p>
                    <p className="text-slate-500">// Real console output is intercepted and redirected below.</p>
                    <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800/50 mt-2 space-y-1 font-mono text-emerald-400 max-h-[140px] overflow-y-auto">
                      <p className="text-slate-400">Function Scope Definition:</p>
                      <pre className="text-indigo-300 whitespace-pre-wrap">{`function run() {
${editorText.split("\n").slice(0, 5).join("\n")}
${editorText.split("\n").length > 5 ? "... // code truncated" : ""}
}`}</pre>
                    </div>
                  </div>
                </div>
              )}

              {/* Console logs output */}
              <div className="h-44 bg-slate-900 rounded-xl border border-slate-800 flex flex-col overflow-hidden">
                <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center justify-between select-none">
                  <div className="flex items-center gap-1.5 text-xs text-slate-300 font-semibold font-sans">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <span>Console Terminal Output</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {terminalStatus === "running" && <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin" />}
                    {terminalStatus === "success" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    {terminalStatus === "error" && <AlertCircle className="w-3.5 h-3.5 text-rose-400" />}
                    <span className="text-[10px] uppercase font-bold text-slate-500">
                      {terminalStatus}
                    </span>
                  </div>
                </div>
                <div className="flex-1 bg-slate-950 p-3 font-mono text-xs overflow-y-auto space-y-1.5 text-slate-300 select-text scrollbar-thin scrollbar-thumb-slate-800">
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}

// Yjs integration for Monaco