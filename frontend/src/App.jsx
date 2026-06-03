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

  function addToOrbit(id) {
    setOrbit((o) => (o.includes(id) ? o : [...o, id]));
  }
  function removeFromOrbit(id) {
    setOrbit((o) => o.filter((x) => x !== id));
  }

  // Create a new instance of a type (e.g. a second Fileshare), then open its popup.
  async function addInstance(type_id) {
    const created = await api.addConnector(type_id);
    await refresh();
    setModalId(created.id);
  }
  // Delete an instance and pull it out of the orbit if present.
  async function deleteInstance(id) {
    await api.removeConnector(id);
    removeFromOrbit(id);
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
          onOpenCreds={(id) => setModalId(id)}
          onAddToOrbit={addToOrbit}
          onAddInstance={addInstance}
          onDeleteInstance={deleteInstance}
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
            <div className={"orbit-wrap" + (result ? " orbit-wrap-shrunk" : "")}>
              {result && (
                <button
                  className="orbit-collapse-btn"
                  onClick={() => setOrbitCollapsed(true)}
                  title="Collapse orbit"
                >
                  <Icon name="chevron-up" size={16} /> Collapse
                </button>
              )}
              <OrbitCanvas
                connectors={connectors}
                orbit={orbit}
                byId={byId}
                onDropConnector={addToOrbit}
                onRemove={removeFromOrbit}
                onOpenCreds={(id) => setModalId(id)}
              />
            </div>
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
