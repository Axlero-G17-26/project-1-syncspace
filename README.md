G17-Axlero Solutions : Updating the weekly status of project.

# Monaco Editor Integration
SyncSpace Enhancements: Monaco Editor Integration & Whiteboard Session Replay
=============================================================================

This document explains how Monaco Editor has been integrated and how the Whiteboard Session Replay feature was implemented.

1. MONACO EDITOR & YJS INTEGRATION
---------------------------------
To achieve standard, highly performant collaborative code editing, we replaced the basic textarea-based editor with Microsoft's Monaco Editor (via `@monaco-editor/react`) and bound it directly to the Yjs Conflict-Free Replicated Data Type (CRDT) shared string.

- Binding Mechanism:
  We initialize the Monaco Editor component in uncontrolled mode. When the editor mounts, we invoke `MonacoBinding` from `y-monaco`:
  
      const binding = new MonacoBinding(
        yText,               // Y.Text object containing code state
        editor.getModel(),    // Monaco Editor text model
        new Set([editor])    // Active editor instances
      );

  This binding automatically handles the two-way real-time synchronization:
    a) Local keypresses computed in Monaco are sent to Yjs as differential operations (insert/delete at offset).
    b) Incoming WebSocket Yjs updates are merged into the Monaco model automatically without clearing selections, cursor position, or history states.

- Dynamic Custom Theming:
  To make Monaco Editor blend seamlessly into the dark glassmorphic design system of SyncSpace, we define a custom theme on mount:
  
      monaco.editor.defineTheme("syncspace-theme", {
        base: "vs-dark",
        inherit: true,
        colors: {
          "editor.background": "#020617",         // Slate-950
          "editor.lineHighlightBackground": "#0f172a" // Slate-900
        }
      });

- Real-Time Cursor & Selection Presence:
  We leverage Monaco's Delta Decorations API to paint other users' cursors dynamically on the editor screen.
  We watch the `activeUsers` state and construct `monaco.Range` objects corresponding to their line and column.
  To style these ranges, we dynamically generate a `<style>` stylesheet block containing custom styles matching the user's color:
  
      .remote-cursor-widget-USERID {
        border-left: 2px solid USER_COLOR;
        animation: cursorBlink 1s infinite;
      }
      .remote-cursor-widget-USERID::after {
        content: "USER_NAME";
        background-color: USER_COLOR;
      }

  The vertical colored blinking bar and user name label hover exactly above their caret, adjusting automatically as text wraps or columns shift.


2. WHITEBOARD SESSION REPLAY (SCRUBBING HISTORY)
-----------------------------------------------
The whiteboard drawing history consists of an array of `Stroke` objects containing coordinate coordinates, width, color, and creator data.

- Scrubber Rendering Cycle:
  We introduce a local boolean state `isReplayMode` and index pointer `replayIndex`.
  When `isReplayMode` is active, the Canvas paint effect renders a sliced subset of the historical strokes instead of all:
  
      const visibleStrokes = isReplayMode ? strokes.slice(0, replayIndex) : strokes;
      visibleStrokes.forEach(stroke => { ... draw stroke ... });

- Drawing Interlock:
  To prevent canvas contamination while scrubbing history, drawings start and hover events are disabled when `isReplayMode` is active:
  
      const handleStartDrawing = (e) => {
        if (isReplayMode) return;
        ...
      }

- Timeline Scrubber Overlay UI:
  A clean, floating glassmorphic dashboard panel mounts at the bottom of the canvas when entering replay mode.
  It includes:
    - A Play/Pause toggle which animates drawing step-by-step.
    - A range slider scrubbing from 0 (empty canvas) to `strokes.length` (fully completed drawing).
    - Speed multiplier settings (1x, 2x, 5x, 10x) that adjust the interval frequency dynamically:
    
          const intervalMs = Math.max(40, 600 / playbackSpeed);

    - Indicator details informing the reviewer who drew the current stroke (e.g. "drawn by Alice").

# YJS Working
1. CRDT Core concept:
   Yjs operates as a CRDT. It allows multiple clients to edit the same document concurrently without requiring a central authority to resolve conflicts. Edits are merged deterministically on all clients, ensuring they arrive at the exact same document state.

2. Document Initialization:
   - On the backend Express server, room states are kept in memory. Each room has a unique `Y.Doc` document instance:
     `const yDoc = new Y.Doc();`
   - When the first user joins, the document is initialized with a default text template.
   - When any user joins later, the backend encodes the full state of the Yjs document:
     `const docState = Y.encodeStateAsUpdate(room.yDoc);`
     This state is converted into a hex string and sent to the client as an `init:code` message. The client applies this update to initialize its local document instance.

3. Live Syncing (Keystroke-by-keystroke):
   - In the frontend, the editor binds its operations to the local `Y.Doc`.
   - The frontend listens to local Yjs document updates:
     `yDoc.on("update", (update, origin) => { ... })`
   - If the update originated from a local keystroke (not from a remote sync), the client converts the binary update array into a hex string:
     `const updateHex = uint8ArrayToHex(update);`
     It then transmits this to the backend server via WebSocket:
     `type: "code:update", payload: { update: updateHex }`

4. Backend Propagation:
   - The backend server receives the `code:update` message.
   - It decodes the hex string back to a binary buffer and applies it directly to the server's in-memory `Y.Doc` using:
     `Y.applyUpdate(room.yDoc, updateBuffer);`
     This updates the server's copy of the document.
   - Finally, the server broadcasts the exact same update hex string to all other users in the room.

5. Client-Side Application:
   - Remote clients receive the `code:update` message.
   - They decode the hex string and apply the binary update to their local `Y.Doc` using:
     `Y.applyUpdate(yDoc, updateBytes, "remote");`
   - Applying this update triggers the editor UI to automatically update the text to reflect the remote changes without overriding local cursors or concurrently typed text.
