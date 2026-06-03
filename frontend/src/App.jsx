// src/App.jsx
// The whole ORBIT workspace. Three regions:
//   - Sidebar (left): the connector palette. Drag a connector to the canvas, or
//     double-click it to open its credential popup.
//   - OrbitCanvas (center): drop connectors here to add them to your ORBIT. The
//     query you run searches exactly the connectors in the orbit.
//   - ResultsPanel (below): the cited answer + evidence + export.
import React, { useEffect, useState, useCallback } from "react";
import { api } from "./api.js";
import Sidebar from "./components/Sidebar.jsx";
import OrbitCanvas from "./components/OrbitCanvas.jsx";
import CredentialModal from "./components/CredentialModal.jsx";
import ResultsPanel from "./components/ResultsPanel.jsx";
import AuditModal from "./components/AuditModal.jsx";
import Icon from "./components/Icon.jsx";

export default function App() {
  const [connectors, setConnectors] = useState([]);   // connector INSTANCES
  const [types, setTypes] = useState([]);             // connector TYPES (add menu)
  const [orbit, setOrbit] = useState([]);             // instance ids placed in the center
  const [modalId, setModalId] = useState(null);       // instance whose popup is open
  const [showAudit, setShowAudit] = useState(false);

  const [question, setQuestion] = useState("Give me employee details for salary 65200");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [abortController, setAbortController] = useState(null);
  const [orbitCollapsed, setOrbitCollapsed] = useState(false);
  const [orbitHeight, setOrbitHeight] = useState(260);   // px, user-resizable via splitter

  function startSplitterDrag(e) {
    e.preventDefault();
    const startY = e.clientY;
    const startH = orbitHeight;
    const onMove = (ev) => {
      const next = Math.max(120, Math.min(window.innerHeight - 280, startH + (ev.clientY - startY)));
      setOrbitHeight(next);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const refresh = useCallback(async () => {
    try {
      setConnectors(await api.listConnectors());
      setApiError(null);
    } catch (e) {
      setApiError(
        `Can't reach the backend at ${api.base}. ` +
        `Make sure it's running with: uvicorn main:app --host 0.0.0.0 --port 8000`
      );
    }
  }, []);

  useEffect(() => {
    refresh();
    api.listTypes().then(setTypes).catch(() => {});
  }, [refresh]);

  const byId = (id) => connectors.find((c) => c.id === id);

  // Drop a TYPE into the orbit: create a fresh instance of that type, add it to
  // the orbit, and open its credential popup. Used by both the sidebar drag-drop
  // and the bottom "Add connector" menu.
  async function addTypeToOrbit(type_id) {
    const created = await api.addConnector(type_id);
    await refresh();
    setOrbit((o) => [...o, created.id]);
    setModalId(created.id);
  }
  // Remove a connector from the orbit AND delete its underlying instance.
  async function removeFromOrbit(id) {
    setOrbit((o) => o.filter((x) => x !== id));
    try { await api.removeConnector(id); } catch (e) { /* best-effort */ }
    await refresh();
  }
  // Pull every connector out of the orbit (and delete the instances).
  async function clearOrbit() {
    const ids = orbit.slice();
    if (ids.length === 0) return;
    setOrbit([]);
    await Promise.all(ids.map((id) => api.removeConnector(id).catch(() => {})));
    await refresh();
  }

  async function runQuery() {
    if (orbit.length === 0) return;
    const controller = new AbortController();
    setAbortController(controller);
    setLoading(true);
    setResult(null);
    try {
      const r = await api.query(question, orbit, { signal: controller.signal });
      setResult(r);
      setOrbitCollapsed(true);
    } catch (e) {
      if (e.name !== "CanceledError" && e.code !== "ERR_CANCELED") {
        alert("Query failed: " + e.message);
      }
    } finally {
      setLoading(false);
      setAbortController(null);
    }
  }

  function stopQuery() {
    if (abortController) {
      abortController.abort();
    }
  }

  const connectedCount = connectors.filter((c) => c.connected).length;

  return (
    <div className="app">
      {/* ---- top bar ---- */}
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><Icon name="orbit" size={22} /></span>
          <span className="brand-name">ORBIT</span>
          <span className="brand-sub">Unified Discovery Agent</span>
        </div>
        <div className="topbar-right">
          <span className="status-pill orbit-pill" title="Connectors currently in the orbit">
            <Icon name="orbit" size={13} />
            <span className="status-pill-count">{orbit.length}</span> in orbit
          </span>
          <span className="status-pill">
            <span className={"dot " + (connectedCount > 0 ? "ok" : "warn")} />
            {connectedCount}/{connectors.length} connected
          </span>
          <button className="ghost" onClick={() => setShowAudit(true)}>
            <Icon name="clipboard" size={16} /> History
          </button>
        </div>
      </header>

      {apiError && (
        <div className="api-error">
          <span className="api-error-msg">{apiError}</span>
          <button className="ghost" onClick={refresh}>
            <Icon name="refresh" size={15} /> Retry
          </button>
        </div>
      )}

      <div className="layout">
        <Sidebar
          connectors={connectors}
          types={types}
          orbit={orbit}
          onAddTypeToOrbit={addTypeToOrbit}
        />

        <main className={"workspace" + (result ? " workspace-has-results" : "")}>
          {result && orbitCollapsed ? (
            <button
              className="orbit-collapsed-bar"
              onClick={() => setOrbitCollapsed(false)}
              title="Expand orbit"
            >
              <span className="orbit-collapsed-mark"><Icon name="orbit" size={16} /></span>
              <span className="orbit-collapsed-text">
                ORBIT · {orbit.length} source{orbit.length === 1 ? "" : "s"}
              </span>
              <span className="orbit-collapsed-spacer" />
              <span className="orbit-collapsed-toggle">
                <Icon name="chevron-down" size={16} /> Expand
              </span>
            </button>
          ) : (
            <>
              <div
                className={"orbit-wrap" + (result ? " orbit-wrap-shrunk" : "")}
                style={result ? { flex: `0 0 ${orbitHeight}px` } : undefined}
              >
                <div className="orbit-toolbar">
                  {orbit.length > 0 && (
                    <button
                      className="orbit-clear-btn"
                      onClick={clearOrbit}
                      title="Remove every connector from the orbit"
                    >
                      <Icon name="trash" size={14} /> Clear all
                    </button>
                  )}
                  {result && (
                    <button
                      className="orbit-collapse-btn"
                      onClick={() => setOrbitCollapsed(true)}
                      title="Collapse orbit"
                    >
                      <Icon name="chevron-up" size={16} /> Collapse
                    </button>
                  )}
                </div>
                <OrbitCanvas
                  connectors={connectors}
                  orbit={orbit}
                  byId={byId}
                  onDropType={addTypeToOrbit}
                  onRemove={removeFromOrbit}
                  onOpenCreds={(id) => setModalId(id)}
                />
              </div>
              {result && (
                <div
                  className="orbit-splitter"
                  onMouseDown={startSplitterDrag}
                  title="Drag to resize orbit"
                  role="separator"
                  aria-orientation="horizontal"
                >
                  <span className="orbit-splitter-handle" />
                </div>
              )}
            </>
          )}

          {/* ---- query bar ---- */}
          <div className="querybar">
            <Icon name="search" size={18} className="querybar-icon" />
            <input
              type="text"
              value={question}
              placeholder="Ask once, search everywhere…"
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runQuery()}
            />
            <button className="primary" disabled={loading || orbit.length === 0} onClick={runQuery}>
              {loading
                ? <><span className="spinner" /> Searching…</>
                : <><Icon name="search" size={16} /> Run on {orbit.length || "—"} source{orbit.length === 1 ? "" : "s"}</>}
            </button>
            {loading && (
              <button className="stop-btn" onClick={stopQuery} title="Stop query">
                <Icon name="stop" size={16} /> Stop
              </button>
            )}
          </div>

          {result && <ResultsPanel result={result} />}
        </main>
      </div>

      {modalId && (
        <CredentialModal
          connector={byId(modalId)}
          onClose={() => setModalId(null)}
          onSaved={async () => { await refresh(); }}
        />
      )}
      {showAudit && <AuditModal onClose={() => setShowAudit(false)} onRebindComplete={(res) => { setResult(res); if (res.question) setQuestion(res.question); setShowAudit(false); }} />}
    </div>
  );
}
