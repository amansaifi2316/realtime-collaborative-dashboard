# PRD: Flowroom (real-time collaborative flowchart)

College mini project. A teacher creates a room, shares the link, and students join. Everyone edits one flowchart live. Styled like the Liveblocks flowchart example, but with our own simple WebSocket backend.

## 0. Rules for the AI agent (read first)
- Read ONLY this file. Do not scan, analyse or summarise the repo. Start from an empty folder.
- Do not ask questions. Pick the simplest reasonable option and continue.
- JavaScript only (no TypeScript). No tests, no extra docs, no Dockerfile. Only the libraries listed below.
- Keep code short and readable. One-line comments only where needed.
- Build in the order of Section 8. After the last step run `npm run build` once, fix errors, then reply with a 5-line summary. Nothing more.
- Later edits: touch only the files named in the request.

## 1. Stack
- client: React 18 + Vite, `@xyflow/react` (React Flow v12), `socket.io-client`, `react-router-dom`, `lucide-react`, `html-to-image@1.11.11`, `jspdf`. Plain CSS with CSS variables (no Tailwind).
- server: Node + Express + `socket.io`. In-memory state only.
- WebSocket-only: set `transports: ['websocket']` in BOTH the server `new Server(...)` options and the client `io(...)` options. No long-polling, so DevTools > Network > WS shows a pure WebSocket connection.
- root: `concurrently` for `npm run dev`.
- NO database, NO JWT, NO login, NO authorization.

## 2. Structure
```
flowroom/
  package.json            (scripts: dev, build, start)
  server/
    package.json
    index.js
  client/
    package.json, vite.config.js, index.html
    src/
      main.jsx, App.jsx, styles.css, socket.js
      pages/Landing.jsx, pages/Room.jsx
      components/Toolbar.jsx, Cursors.jsx, AvatarStack.jsx, ShapeNodes.jsx, JoinModal.jsx, Toast.jsx, WsInspector.jsx, ChatPanel.jsx, LabeledEdge.jsx
      utils/exportPdf.js
```

## 3. Backend (server/index.js)
- Express serves `client/dist` in production, with a fallback to `index.html` for any other route. Listens on `process.env.PORT || 3001`, host `0.0.0.0`. Socket.IO CORS origin `*`.
- State: `rooms = Map<roomId, { nodes: [], edges: [], users: Map<socketId, {id, name, color, isHost}> }>`.
- A room is created on first join. The first user in a room has `isHost: true`. Delete the room when it becomes empty.
- Assign each user a colour from a fixed 6-colour palette, in join order.
- Events (client to server):
  - `join-room {roomId, name}`: join the socket.io room, then emit `room-state {nodes, edges, users}` to that socket only, and `users-update [users]` to everyone in the room.
  - `flow-update {nodes, edges}`: save it and broadcast to the others in the room (last write wins).
  - `cursor-move {x, y}` (flow coordinates): broadcast `cursor-move {id, name, color, x, y}` to the others.
  - `disconnect`: remove the user, emit `users-update` and `cursor-leave id`.
  - `latency-check` (with ack callback): call the callback immediately. The client uses it to measure round-trip time.

## 4. Pages
Routes: `/` (Landing) and `/room/:roomId` (Room).

### Landing (must look polished)
- Top bar: wordmark "Flowroom" on the left. Nothing else.
- Hero (centred, max-width 720px): headline "Draw flowcharts together, live." Subtext: "Create a room, share the link, and everyone edits the same canvas in real time. No sign-up."
- Card with: name input, primary button "Create room" (generates a 6-character uppercase code and goes to `/room/CODE`). Under it a divider "or join with a code", a code input, and a secondary button "Join".
- Below the card: a static mini flowchart preview built with CSS/SVG (not an image file), plus three short feature lines: Live cursors / Instant sync / No sign-up.
- Small footer: "Built as a college mini project".
- Save the entered name in `localStorage`.

### Room
- If opened via a shared link with no saved name, show `JoinModal` (name input, "Join room"). Block the canvas until a name is entered.
- Top bar: wordmark, room code chip, then on the right a live chip "WebSocket · 24ms" (green dot; click opens the inspector, see 4a), `AvatarStack`, the button "Copy invite link" (copies the current URL and shows a toast "Link copied"), and a small connection dot (green connected, grey reconnecting).
- Canvas: React Flow with a dotted background, controls (zoom), and a MiniMap at the bottom right. Starts with a sample chart: Start, Process, Decision, End, connected. The host's first join seeds it. Others receive it through `room-state`.
- Floating toolbar, bottom centre: Rectangle, Circle, Diamond (click adds a node at the viewport centre), a divider, Undo, Redo, Delete selected, Fit view. Use lucide icons and tooltips.
- Nodes: three custom types (rect, circle, diamond), white fill, 1px border, label editable on double-click. One `Handle` of `type="source"` on each of the 4 sides, and set `connectionMode="loose"` so any handle can connect to any other.
- Edges: smoothstep with an arrow marker. Selected node/edge gets the accent outline.
- Live cursors: on mouse move, throttled to 30ms, emit flow coordinates via `screenToFlowPosition`. Render other users' cursors in `Cursors.jsx` using `flowToScreenPosition`, and re-render on viewport change via `useViewport`, so cursors stay on the right spot while panning or zooming. Show an arrow plus a name pill in the user's colour. Remove it on `cursor-leave`.
- Sync: on any node/edge change emit `flow-update`, throttled to 50ms while dragging. Apply remote updates using a `isRemote` ref so we never re-emit what we just received.
- Undo/redo: local snapshot stack (max 50). A new local change clears the redo stack. Undo/redo applies the snapshot and emits `flow-update`. Support Ctrl+Z and Ctrl+Shift+Z.
- Presence: `AvatarStack` shows up to 5 circles with initials in the user's colour plus a "+N" overflow. The host has a small "Host" label in the tooltip. Show a toast "X joined" / "X left".
- Must work with 2 to 5 users at the same time.

### 4a. WebSocket Inspector (so the teacher can SEE the WebSocket working)
A right-side drawer (width 360px, slides in over the canvas, closable), opened from the top-bar chip. Two tabs: "Live" and "How it works".

**Live tab**
- Status card with rows: Status (Connected / Reconnecting), Transport (read `socket.io.engine.transport.name`, must show `websocket`), Server URL shown as `ws://host:port` (or `wss://` when the page is https), Socket ID, Round-trip latency in ms (emit `latency-check` with an ack every 2s), Users in room.
- Counters: messages sent, messages received, approx data transferred (sum of `JSON.stringify(payload).length`), and messages/sec over the last 5s.
- Event log, newest on top, max 50 rows, monospace font. Each row: time (HH:MM:SS.mmm), direction arrow (up = sent, down = received), event name, short payload note (e.g. "2 nodes, 1 edge", "x:312 y:140") and size in bytes. Use `socket.onAny` for received and `socket.onAnyOutgoing` for sent. Colour only the arrow (sent = accent, received = green).
- Controls: Pause/Resume, Clear, and a "Hide cursor-move" checkbox (checked by default, but the counters still count them).
- Performance: keep the log in a ref and flush to state every 250ms so the log never slows the canvas.
- Small hint at the bottom: "Open browser DevTools > Network > WS > Messages to see the raw frames."

**How it works tab** (static, plain language, short)
- A 5-box diagram built with CSS/SVG: Browser A -> WebSocket -> Server -> WebSocket -> Browser B, with the line "One connection stays open. Either side can send any time."
- Three steps: 1) You move a node. 2) The browser sends `flow-update` over the open WebSocket. 3) The server forwards it to everyone else in the room, instantly.
- A two-column mini comparison: HTTP polling (client keeps asking "anything new?", delay, wasted requests) vs WebSocket (server pushes when something changes, instant, one connection).
- One line: "Built with Socket.IO, running in WebSocket-only mode."

Design: same tokens as Section 5, 1px left border, no heavy shadow, monospace font = `ui-monospace, "JetBrains Mono", Menlo, monospace` at 12px.

### 4b. Extra features (build in this order)

**1) Host view-only mode**
- Host rule (overrides Section 3): the client keeps a `hostKey` in `localStorage` under `flowroom-host-<roomId>` (create one with `crypto.randomUUID()` if missing) and sends it in `join-room {roomId, name, hostKey}`. The first user to join a room sets `room.hostKey`. Any later join with the same key is also the host (so the teacher can refresh and stay host). Everyone else is a student. Send `isHost` in the users list.
- Server: room has `viewOnly` (default false). `room-state` also includes `viewOnly`. New event `set-view-only {value}`: ignore unless the sender is the host, else set `room.viewOnly` and broadcast `view-only {value}` to the whole room. When `viewOnly` is true, the server must IGNORE `flow-update` from non-hosts (enforce on the server, not only in the UI).
- Host UI: a switch in the top bar, label "Editing" with states "On" / "View only".
- Student UI while view-only: React Flow `nodesDraggable`, `nodesConnectable`, `elementsSelectable` = false, no label editing, no colour palette, toolbar edit buttons disabled (greyed), Undo/Redo and Delete shortcuts disabled. Pan, zoom, cursors and chat still work. Show a slim banner under the top bar: "View only. The host has turned off editing." The host is never restricted.
- Toast to everyone when it changes: "Editing turned off by host" / "Editing turned on".

**2) Node colours**
- When a node is selected (and editing is allowed), show a small `NodeToolbar` above it with 6 round swatches: white (default), red, amber, green, blue, grey. Clicking applies to all selected nodes.
- Store as `node.data.color` (so it syncs through the normal `flow-update`). Use soft fills with a slightly darker 1px border: `#FEE2E2/#FCA5A5`, `#FEF3C7/#FCD34D`, `#D1FAE5/#6EE7B7`, `#DBEAFE/#93C5FD`, `#F3F4F6/#D1D5DB`, default `#FFFFFF/#E7E5E4`. Apply in `ShapeNodes.jsx`. Colour must survive undo/redo.

**3) Edge labels**
- Custom edge type `labeled` (smoothstep path + arrow marker) in `LabeledEdge.jsx`. All new edges use it, and the sample chart edges too.
- Double-click an edge to edit its label in a small inline input (`EdgeLabelRenderer`), with two quick chips "Yes" and "No". Enter or blur saves, Esc cancels. Empty label removes the pill.
- Store as `edge.data.label`. Show it as a small white pill with a 1px border on the edge centre. Syncs through `flow-update`.

**4) Room chat**
- A chat icon button in the top bar opens a right drawer (360px, same style as the inspector). Only one drawer (chat or inspector) is open at a time. Show an unread count badge on the button while the drawer is closed.
- Event `chat-message {text}`: the server trims it, ignores empty text, cuts it at 500 characters, builds `{id, userId, name, color, text, ts}`, keeps the last 100 per room (`room.chat`), and broadcasts to EVERYONE in the room including the sender. `room-state` also includes `chat`.
- UI: message list (name in the user's colour, text, time HH:MM), auto-scroll to the newest, input at the bottom, Enter sends, Shift+Enter adds a new line. Empty state text: "No messages yet."
- The Inspector log will naturally show `chat-message` rows. Keep that, it is good for the demo.

Known limit: if the host never returns while view-only is on, the room stays view-only.

### 4c. Sticky note and PDF export

**Sticky note**
- New custom node type `sticky` in `ShapeNodes.jsx`, added to the floating toolbar with the lucide `StickyNote` icon (click adds one at the viewport centre, like the other shapes).
- Look: pale yellow fill `#FEF3C7`, 1px border `#FCD34D`, radius 4px, very subtle shadow, 14px Inter text, padding 12px, default size 180x140. No connection handles (stickies are not connectable).
- Content: a `<textarea>` with placeholder "Write a note..." inside the node, stored in `node.data.text`. Autofocus a newly created sticky. Add the classes `nodrag nowheel` to the textarea so typing and scrolling do not move the canvas. Stop key propagation (`onKeyDown`) so Backspace/Delete does not delete the node and Ctrl+Z does not trigger the canvas undo while typing.
- Resizable with React Flow's `NodeResizer` when selected (min 120x90). The size must sync like any other node change.
- Sync typing through the normal `flow-update`, debounced to 150ms. Include it in undo/redo only on blur (not on every keystroke).
- The node colour palette from 4b also works on stickies. In view-only mode the textarea is `readOnly`.

**PDF export (client-side only, no server, no database)**
- Button "Download PDF" in the top bar (icon `Download`, hide the label on narrow screens). Every user, including students and view-only users, can use it.
- Put the logic in `client/src/utils/exportPdf.js` as `exportRoomPdf({ roomId, nodes, users, chat })`.
- Step 1, capture the chart: use `getNodesBounds` and `getViewportForBounds` from `@xyflow/react` (padding 0.15, image size 1600x1000), then `toPng(document.querySelector('.react-flow__viewport'), { backgroundColor: '#ffffff', width: 1600, height: 1000, style: { width: '1600px', height: '1000px', transform: 'translate(Xpx, Ypx) scale(Z)' } })`. This follows React Flow's official "download image" example. Edge labels and sticky notes must be included.
- Step 2, build the PDF with `jsPDF` (A4, landscape). Page 1: title "Flowroom", a line "Room CODE, DD Mon YYYY, HH:MM", and the chart image fitted inside the margins. Next page(s): heading "Participants" with names, then heading "Chat" with one line per message "[HH:MM] Name: text" (use `splitTextToSize`, add pages when needed; if there is no chat, write "No messages."). Characters outside Latin-1 (for example Devanagari or emoji) are replaced with "?" because the default PDF font cannot draw them.
- File name `flowroom-CODE.pdf`. If there are no nodes, show a toast "Nothing to export yet" and stop. After saving show a toast "PDF downloaded".
- The chart image must not include cursors, minimap, controls or the toolbar.

## 5. Design (light mode only, minimal, must not look AI-generated)
- Style reference: Linear / Vercel / Notion. Clean and quiet.
- Tokens: bg `#FAFAF9`, surface `#FFFFFF`, border `#E7E5E4`, text `#1C1917`, muted `#78716C`, accent `#2563EB` (the only accent). Cursor/avatar palette: `#EF4444 #F59E0B #10B981 #06B6D4 #8B5CF6 #EC4899`.
- Font: Inter (Google Fonts), fallback system-ui. Spacing in multiples of 4px. Radius 8px for cards and buttons, 999px for pills.
- Shadows only on the floating toolbar and the card (very subtle). Transitions 150ms.
- Forbidden: gradients, glassmorphism, emoji as icons, dark mode, neon glows, bouncing animations, lorem ipsum, centred text walls.
- Buttons: primary = solid accent with white text, secondary = white with 1px border. Visible focus ring. Responsive down to tablet width; the Landing page must also work on mobile.

## 6. Dev and run
- `npm run dev` runs server (3001) and client (5173) together.
- The client connects to `http://<window.location.hostname>:3001` in dev, and to the same origin in production. This lets other devices on the same Wi-Fi join using the host's IP.
- `npm run build` builds the client. `npm start` runs the server, which serves `client/dist`. This single process is what gets deployed (for example on Render).
- README: at most 10 lines, covering install, dev, build and start.

## 7. Out of scope
Authentication, database, comments, version history, roles, file export, dark mode, mobile editing.

## 8. Build order (checklist)
1. Root + server skeleton, all socket events working.
2. Client skeleton: routing, socket.js, styles.css tokens.
3. Landing page.
4. Room: canvas, custom nodes, toolbar, add/delete/connect/edit label.
5. Sync (`room-state`, `flow-update`), then presence and avatars, then live cursors.
6. Undo/redo, toasts, copy invite link, MiniMap.
7. WebSocket Inspector (Section 4a) and the top-bar chip.
8. Extra features (Section 4b), in order: view-only mode, node colours, edge labels, chat.
9. Sticky note and PDF export (Section 4c).
10. Production build and static serving. Final summary.

## 9. Done when
- [ ] Open the room in 3 browser tabs. Moving a node in one tab updates the others within about 100ms.
- [ ] Cursors with names show up and track correctly even after panning/zooming.
- [ ] A late joiner sees the current chart.
- [ ] The invite link opens straight into the room, after asking for a name.
- [ ] Refreshing a tab rejoins the same room.
- [ ] `npm run build && npm start` works as one process on one port.
- [ ] The inspector shows Transport = websocket, a live latency number, and new log rows when a node is moved in another tab.
- [ ] DevTools > Network > WS shows one connection with frames, and no polling requests.
- [ ] Host turns on View only: a student cannot move, connect or edit anything (also not by keyboard), and the banner shows. Turning it off restores editing.
- [ ] Colour change on a node shows on all screens. Edge label (e.g. Yes) shows on all screens.
- [ ] Chat message sent by one user appears for all users, and the unread badge works.
- [ ] A sticky note can be added, typed in (Backspace does not delete the node), resized, and its text shows on all screens.
- [ ] Download PDF gives a landscape PDF: page 1 has the full chart (with stickies and edge labels), the next page has participants and chat.
