// components/CredentialModal.jsx
// The popup that opens when you double-click a connector. It auto-builds its form
// from the connector's `fields` (sent by the backend), lets you type credentials,
// and on Save sends them to POST /connectors/{id}/connect, which stores them and
// tests the connection. Secrets already saved show as ••• and are left untouched
// unless you type a new value.
import React, { useState } from "react";
import { api } from "../api.js";
import Icon, { connectorIconName } from "./Icon.jsx";

function FolderBrowser({ onSelect, onCancel }) {
  const [items, setItems] = useState([]);
  const [current, setCurrent] = useState("");
  const [parent, setParent] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadPath(path = "") {
    setLoading(true);
    try {
      const res = await api.browse(path);
      setItems(res.items.filter((i) => i.is_dir));
      setCurrent(res.current);
      setParent(res.parent || null);
    } catch (e) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { loadPath(""); }, []);

  return (
    <div className="folder-browser">
      <div className="folder-browser-header">
        <span className="folder-browser-path" title={current}>{current || "Select a folder"}</span>
      </div>
      <div className="folder-browser-list">
        {parent && (
          <div className="folder-browser-item folder-browser-parent" onClick={() => loadPath(parent)}>
            <Icon name="folder" size={14} /> ..
          </div>
        )}
        {loading && <p className="hint">Loading…</p>}
        {!loading && items.length === 0 && <p className="hint">No subfolders</p>}
        {items.map((item) => (
          <div key={item.path} className="folder-browser-item" onClick={() => loadPath(item.path)}>
            <Icon name="folder" size={14} /> {item.name}
          </div>
        ))}
      </div>
      <div className="folder-browser-actions">
        <button className="ghost" onClick={onCancel}>Cancel</button>
        <button className="primary" onClick={() => onSelect(current)} disabled={!current}>
          Select this folder
        </button>
      </div>
    </div>
  );
}

export default function CredentialModal({ connector, onClose, onSaved }) {
  const [values, setValues] = useState(() => ({ ...connector.values }));
  const [label, setLabel] = useState(connector.name);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [browsingField, setBrowsingField] = useState(null);

  function setField(key, v) {
    setValues((s) => ({ ...s, [key]: v }));
  }

  function handleBrowseSelect(path) {
    const current = values[browsingField] || "";
    const newVal = current ? `${current}, ${path}` : path;
    setField(browsingField, newVal);
    setBrowsingField(null);
  }

  async function save() {
    setBusy(true);
    setResult(null);
    try {
      const res = await api.connect(connector.id, { ...values, label });
      setResult(res);
      await onSaved();
      if (res.connected) {
        onClose();
      }
    } catch (e) {
      setResult({ connected: false, detail: e.message });
    } finally {
      setBusy(false);
    }
  }

  const isFileshare = connector.type_id === "fileshare";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className={"modal-icon ttype-" + connector.type_id}>
            <Icon name={connectorIconName(connector.type_id)} size={20} />
          </span>
          <div>
            <h3>{connector.name}</h3>
            <p>Enter credentials to connect this source.</p>
          </div>
        </div>

        <div className="modal-body">
          {browsingField ? (
            <FolderBrowser
              onSelect={handleBrowseSelect}
              onCancel={() => setBrowsingField(null)}
            />
          ) : (
            <>
              <label className="field">
                <span className="field-label">Name (how it appears in your orbit)</span>
                <input type="text" value={label} placeholder="e.g. HR Fileshare"
                       onChange={(e) => setLabel(e.target.value)} />
              </label>
              {connector.fields.length === 0 && <p className="hint">No credentials required.</p>}
              {connector.fields.map((f) => (
                <label key={f.key} className="field">
                  <span className="field-label">{f.label}</span>
                  <div className="field-row">
                    <input
                      type={f.type === "password" ? "password" : "text"}
                      value={values[f.key] ?? ""}
                      placeholder={f.placeholder}
                      onChange={(e) => setField(f.key, e.target.value)}
                    />
                    {isFileshare && f.key === "FILESHARE_PATHS" && (
                      <button className="ghost browse-btn" type="button" onClick={() => setBrowsingField(f.key)}>
                        <Icon name="folder" size={14} /> Browse
                      </button>
                    )}
                  </div>
                </label>
              ))}
            </>
          )}
        </div>

        {result && !browsingField && (
          <div className={"connect-result " + (result.connected ? "ok" : "fail")}>
            <Icon name={result.connected ? "orbit" : "x"} size={15} />
            {result.connected ? " Connected — " : " Not connected — "}{result.detail}
          </div>
        )}

        {!browsingField && (
          <div className="modal-foot">
            <button className="primary" onClick={save} disabled={busy}>
              {busy ? "Connecting…" : "Save & Connect"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
