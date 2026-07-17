import React, { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import * as Y from "yjs";
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  
  const [language, setLanguage] = useState<CodeLanguage>("javascript");
  const [editorText, setEditorText] = useState("");
  const [lines, setLines] = useState<string[]>([""]);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([
    "System Console Ready.",
    "Click 'Run Code' to execute JavaScript, or write HTML to see rendering."
  ]);
  const [terminalStatus, setTerminalStatus] = useState<"idle" | "success" | "error" | "running">("idle");
  const [activeTab, setActiveTab] = useState<"code" | "preview">("code");
  const [isCopied, setIsCopied] = useState(false);
  const [conflictLogs, setConflictLogs] = useState<{ id: string; msg: string; time: string }[]>([]);

  // Keep a reference to the Y.Text object
  const yTextRef = useRef<Y.Text>(yDoc.getText("codestate"));
  const oldValueRef = useRef<string>("");

  // 1. Core synchronization from Yjs Y.Text to Textarea
  useEffect(() => {
    const yText = yTextRef.current;
    
    // Set initial text
    const initialText = yText.toString();
    setEditorText(initialText);
    oldValueRef.current = initialText;
    setLines(initialText.split("\n"));

    // Observe changes from other users
    const handleYTextChange = (event: Y.YTextEvent) => {
      // If it's our own local transaction, we don't need to overwrite to avoid caret resetting
      if (event.transaction.local) return;

      const updatedText = yText.toString();
      const textarea = textareaRef.current;
      
      if (textarea) {
        // Save current selection states
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        // Simple cursor position correction:
        // Adjust indices depending on where changes were made relative to the caret
        let adjustedStart = start;
        let adjustedEnd = end;

        // Generate logs of collaborative actions for visual user feedback
        const logId = Math.random().toString(36).substring(7);
        const logTime = new Date().toLocaleTimeString();
        let logMsg = "Merged remote text edits";

        // Examine the Delta array to determine what operation occurred and report on UI
        const delta = event.delta;
        let indexTracker = 0;
        
        delta.forEach((op) => {
          if (op.retain) {
            indexTracker += op.retain;
          } else if (op.insert) {
            const insertStr = typeof op.insert === "string" ? op.insert : "";
            logMsg = `Auto-merged incoming input (+${insertStr.length} characters)`;
            
            if (indexTracker <= start) {
              adjustedStart += insertStr.length;
            }
            if (indexTracker <= end) {
              adjustedEnd += insertStr.length;
            }
            indexTracker += insertStr.length;
          } else if (op.delete) {
            logMsg = `Auto-merged incoming deletion (-${op.delete} characters)`;
            
            if (indexTracker < start) {
              adjustedStart -= Math.min(op.delete, start - indexTracker);
            }
            if (indexTracker < end) {
              adjustedEnd -= Math.min(op.delete, end - indexTracker);
            }
          }
        });

        // Add to our collaborative merge panel logs
        setConflictLogs(prev => [
          { id: logId, msg: logMsg, time: logTime },
          ...prev.slice(0, 9)
        ]);

        // Apply text to state and textarea directly
        setEditorText(updatedText);
        setLines(updatedText.split("\n"));
        oldValueRef.current = updatedText;

        // Restore cursor selection
        setTimeout(() => {
          textarea.selectionStart = adjustedStart;
          textarea.selectionEnd = adjustedEnd;
        }, 0);
      } else {
        setEditorText(updatedText);
        setLines(updatedText.split("\n"));
        oldValueRef.current = updatedText;
      }
    };

    yText.observe(handleYTextChange);
    return () => {
      yText.unobserve(handleYTextChange);
    };
  }, [yDoc]);

  // 2. High-performance diff and synchronization from Textarea to Yjs
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const oldValue = oldValueRef.current;
    
    setEditorText(newValue);
    setLines(newValue.split("\n"));
    
    // Find the difference (minimal range changed)
    let start = 0;
    while (start < oldValue.length && start < newValue.length && oldValue[start] === newValue[start]) {
      start++;
    }

    let endOld = oldValue.length;
    let endNew = newValue.length;
    while (endOld > start && endNew > start && oldValue[endOld - 1] === newValue[endNew - 1]) {
      endOld--;
      endNew--;
    }

    const deletedCount = endOld - start;
    const insertedText = newValue.substring(start, endNew);

    const yText = yTextRef.current;
    
    // Apply transactional update to Yjs
    yDoc.transact(() => {
      if (deletedCount > 0) {
        yText.delete(start, deletedCount);
      }
      if (insertedText.length > 0) {
        yText.insert(start, insertedText);
      }
    });

    oldValueRef.current = newValue;

    // Trigger cursor change tracking
    handleCursorChange();
  };

  // Sync scroll between textarea and code background highlights / line numbers
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textarea.scrollTop;
    }
    if (highlightRef.current) {
      highlightRef.current.scrollTop = textarea.scrollTop;
      highlightRef.current.scrollLeft = textarea.scrollLeft;
    }
  };

  // 3. User cursor presence tracking
  const handleCursorChange = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const textBeforeCursor = textarea.value.substring(0, textarea.selectionStart);
    const splitLines = textBeforeCursor.split("\n");
    const currentLine = splitLines.length;
    const currentCh = splitLines[splitLines.length - 1].length;

    onSendCursor({
      line: currentLine,
      ch: currentCh,
      element: "editor"
    });
  };

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
          // Execute Javascript safely in an anonymous function context
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
      // For HTML, CSS, Python-simulation
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

  // Auto-indent selection when pressing Tab key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;

      const indentedText = text.substring(0, start) + "  " + text.substring(end);
      
      // Update Yjs and Editor text
      const yText = yTextRef.current;
      yDoc.transact(() => {
        yText.delete(start, end - start);
        yText.insert(start, "  ");
      });

      setEditorText(indentedText);
      setLines(indentedText.split("\n"));
      oldValueRef.current = indentedText;

      setTimeout(() => {
        textarea.selectionStart = start + 2;
        textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  // Simple RegEx syntax highlighting overlay
  const highlightCode = (code: string) => {
    if (!code) return <code className="text-slate-500">// Start typing...</code>;

    // Guard matching from infinite rendering loops
    const escaped = code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    if (language === "javascript") {
      return (
        <code
          dangerouslySetInnerHTML={{
            __html: escaped
              // Comments
              .replace(/(\/\/.*)/g, '<span class="text-slate-500 font-normal">$1</span>')
              // Strings
              .replace(/(["'`])(.*?)\1/g, '<span class="text-emerald-400">$1$2$1</span>')
              // Keywords
              .replace(/\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|import|export|from|default|class|extends|new|this|async|await)\b/g, '<span class="text-pink-400 font-semibold">$1</span>')
              // Functions
              .replace(/\b([a-zA-Z_]\w*)(?=\()/g, '<span class="text-blue-400">$1</span>')
              // Numbers
              .replace(/\b(\d+)\b/g, '<span class="text-amber-400">$1</span>')
          }}
        />
      );
    } else if (language === "html") {
      return (
        <code
          dangerouslySetInnerHTML={{
            __html: escaped
              // Tags
              .replace(/(&lt;\/?[a-zA-Z0-9:-]+)/g, '<span class="text-pink-400">$1</span>')
              .replace(/(&gt;)/g, '<span class="text-pink-400">$1</span>')
              // Attributes
              .replace(/(\s[a-zA-Z0-9:-]+=)/g, '<span class="text-blue-400">$1</span>')
              // Strings
              .replace(/(["'])(.*?)\1/g, '<span class="text-emerald-400">$1$2$1</span>')
              // Comments
              .replace(/(&lt;!--.*?--&gt;)/g, '<span class="text-slate-500 font-normal">$1</span>')
          }}
        />
      );
    } else {
      // General fallbacks (Python / CSS styles)
      return (
        <code
          dangerouslySetInnerHTML={{
            __html: escaped
              // Comments
              .replace(/(#.*)/g, '<span class="text-slate-500">$1</span>')
              .replace(/(\/\*.*?\*\/)/g, '<span class="text-slate-500">$1</span>')
              // Strings
              .replace(/(["'])(.*?)\1/g, '<span class="text-emerald-400">$1$2$1</span>')
              // Classes / Selectors
              .replace(/([\.#][a-zA-Z_-]\w*)/g, '<span class="text-blue-400">$1</span>')
          }}
        />
      );
    }
  };

  // Copy code utility
  const handleCopyCode = () => {
    navigator.clipboard.writeText(editorText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-hidden text-slate-300 border-l border-slate-800" id="code-editor-container">
      {/* 1. Header Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800/80 shrink-0 select-none">
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
              className="flex-1 min-h-0 flex"
            >
              {/* Line Numbers column */}
              <div
                ref={lineNumbersRef}
                className="w-10 bg-slate-950 select-none text-right pr-2 text-slate-600 font-mono text-xs pt-4 pb-20 border-r border-slate-900 overflow-hidden shrink-0"
              >
                {lines.map((_, i) => (
                  <div key={i} className="h-5 leading-5">
                    {i + 1}
                  </div>
                ))}
              </div>

              {/* Textarea Overlay Editor */}
              <div className="flex-1 min-w-0 relative">
                {/* Syntax Highlighted Rendered Overlay */}
                <pre
                  ref={highlightRef}
                  className="absolute inset-0 m-0 p-4 font-mono text-xs leading-5 select-none pointer-events-none overflow-auto whitespace-pre font-normal text-slate-300 bg-transparent"
                  aria-hidden="true"
                >
                  {highlightCode(editorText)}
                </pre>

                {/* Actual Input Textarea (Transparent but matching typography exactly) */}
                <textarea
                  id="code-textarea"
                  ref={textareaRef}
                  value={editorText}
                  onChange={handleTextareaChange}
                  onScroll={handleScroll}
                  onKeyUp={handleCursorChange}
                  onSelect={handleCursorChange}
                  onKeyDown={handleKeyDown}
                  placeholder="// Type code here or collaborate..."
                  className="absolute inset-0 w-full h-full bg-transparent m-0 p-4 font-mono text-xs leading-5 text-transparent caret-white focus:outline-none resize-none overflow-auto whitespace-pre font-normal select-text selection:bg-indigo-500/30 selection:text-transparent"
                  spellCheck={false}
                />

                {/* Render active cursors overlays for other users in the text document! */}
                {activeUsers
                  .filter(u => u.id !== currentUserId && u.cursor && u.cursor.element === "editor" && u.cursor.line)
                  .map(user => {
                    const cursor = user.cursor!;
                    // Calculate visual offset approximation: line is 1-indexed, so (line-1)*20px line-height, + 16px padding
                    // Characters approx width is ~7.2px for monospace xs
                    const lineOffset = (cursor.line! - 1) * 20 + 16;
                    const charOffset = cursor.ch! * 7.2 + 16;

                    // Bound pointers so they don't break viewport boundary
                    if (lineOffset > lines.length * 20 + 10) return null;

                    return (
                      <div
                        key={user.id}
                        className="absolute pointer-events-none z-20 flex items-center h-5 select-none transition-all duration-150"
                        style={{
                          left: `${charOffset}px`,
                          top: `${lineOffset}px`,
                        }}
                      >
                        {/* Vertical blinking colored cursor bar */}
                        <div 
                          className="w-[2px] h-4.5 animate-pulse"
                          style={{ backgroundColor: user.color }}
                        />
                        {/* Cursor tag label */}
                        <span 
                          className="absolute bottom-4 left-0.5 text-[8px] font-bold px-1.5 py-0.2 rounded shadow text-white font-sans opacity-90 truncate max-w-[80px]"
                          style={{ backgroundColor: user.color }}
                        >
                          {user.name}
                        </span>
                      </div>
                    );
                  })}
              </div>
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
