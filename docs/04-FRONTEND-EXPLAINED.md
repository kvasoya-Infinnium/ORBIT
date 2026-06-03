# 04 — Frontend explained (every file, plainly)

The frontend is **React + Vite**. It's a single workspace screen styled to look like a
"mission control" for your data. No Tailwind/MUI — just one `styles.css` (fewer things
to install on the day).

```
frontend/
├── index.html               ← the empty page React fills in (loads the Inter font)
├── vite.config.js           ← dev server config (port 5173)
├── package.json             ← JS libraries (react, axios)
└── src/
    ├── main.jsx             ← entry point → renders <App/>
    ├── App.jsx              ← the whole workspace + all the state
    ├── api.js               ← all backend calls live here (axios)
    ├── styles.css           ← the entire dark "space/orbit" theme
    └── components/
        ├── Sidebar.jsx       ← LEFT rail: the connector palette
        ├── OrbitCanvas.jsx   ← CENTER: drop zone + the rotating orbit
        ├── CredentialModal.jsx ← the credential popup (double-click a connector)
        ├── ResultsPanel.jsx  ← answer + citations + evidence + export
        ├── AuditModal.jsx    ← the audit-log popup
        ├── CitationText.jsx  ← turns [fileshare-1] into clickable links
        └── EvidenceCard.jsx  ← one result in the list
```

## The mental model (3 regions)

```
┌─────────────┬───────────────────────────────────────┐
│  SIDEBAR    │             ORBIT CANVAS               │
│ (connectors)│   drag connectors here → they orbit    │
│             │        the glowing ORBIT core          │
│  ⋮          ├───────────────────────────────────────┤
│             │   query bar  →  Run on N sources        │
│             ├───────────────────────────────────────┤
│             │   results: answer + citations + cards  │
└─────────────┴───────────────────────────────────────┘
```

## How the pieces talk

`App.jsx` owns everything and passes it down:
- `connectors` — the full list loaded from `GET /connectors` (includes each one's
  credential `fields` and connection status).
- `orbit` — the array of connector ids you've dragged into the center. **This is the
  list a query searches.**
- `modalId` — which connector's credential popup is open (if any).
- `result` — the last query's answer + items.

## The interactions you asked for

1. **Double-click a connector (Sidebar.jsx)** → `App` sets `modalId` → `CredentialModal`
   opens. It auto-builds a form from that connector's `fields` (so Email shows host/
   user/password, Zoho shows its OAuth fields, etc.). **Save & Connect** calls
   `POST /connectors/{id}/connect`, which stores the credentials on the backend and
   tests them. The status dot updates.

2. **Drag a connector to the center (Sidebar → OrbitCanvas)** → uses the browser's
   native drag-and-drop. `Sidebar` puts the connector id on the drag event; the
   `OrbitCanvas` drop handler calls `onDropConnector(id)`, which adds it to `orbit`.
   (There's also a `＋` button on each tile as a no-drag shortcut.)

3. **The orbit visual (OrbitCanvas.jsx)** → for N connectors, each is placed at an even
   angle on a circle around the core. A slowly rotating ring carries them; each label
   counter-rotates so it stays upright; a "spoke" connects each to the core. Hover a
   node for a × to remove it. Hover the ring to pause the spin.

4. **Run a query (querybar in App.jsx)** → calls `POST /query` with the orbit's ids,
   then shows `ResultsPanel`.

5. **Citations (CitationText.jsx)** → scans the answer for `[source-id]` patterns and
   makes each clickable; clicking scrolls to + highlights the matching `EvidenceCard`.

## Changing things
- Backend on a different host/port? Edit `BASE` in **src/api.js**.
- Orbit size/spacing? `RADIUS` constant in **OrbitCanvas.jsx**.
- Colors, glow, fonts, the whole look? All in **styles.css** (top `:root` variables).
- Spin too fast/slow? The `animation: spin 90s` rules in **styles.css**.

Next: **05-CONNECTORS-SETUP.md** for what to type into each popup.
