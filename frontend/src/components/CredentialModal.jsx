// components/CredentialModal.jsx
// The popup that opens when you double-click a connector. It auto-builds its form
// from the connector's `fields` (sent by the backend), lets you type credentials,
// and on Save sends them to POST /connectors/{id}/connect, which stores them and
// tests the connection. Secrets already saved show as ••• and are left untouched
// unless you type a new value.
import React, { useState } from "react";
import { api } from "../api.js";
import Icon, { connectorIconName } from "./Icon.jsx";

export default function CredentialModal({ connector, onClose, onSaved }) {
  const [values, setValues] = useState(() => ({ ...connector.values }));
  const [label, setLabel] = useState(connector.name);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [browsing, setBrowsing] = useState(false);

  function setField(key, v) {
    setValues((s) => ({ ...s, [key]: v }));
  }

  async function handleBrowse(fieldKey) {
    setBrowsing(true);
    try {
      const res = await api.browse();
      if (res.path) {
        const current = values[fieldKey] || "";
        const newVal = current ? `${current}, ${res.path}` : res.path;
        setField(fieldKey, newVal);
      }
    } catch (e) {
      // User cancelled or no folder selected — do nothing
    } finally {
      setBrowsing(false);
    }
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
                  <button className="ghost browse-btn" type="button" onClick={() => handleBrowse(f.key)} disabled={browsing}>
                    <Icon name="folder" size={14} /> {browsing ? "…" : "Browse"}
                  </button>
                )}
              </div>
            </label>
          ))}
        </div>

        {result && (
          <div className={"connect-result " + (result.connected ? "ok" : "fail")}>
            <Icon name={result.connected ? "orbit" : "x"} size={15} />
            {result.connected ? " Connected — " : " Not connected — "}{result.detail}
          </div>
        )}

        <div className="modal-foot">
          <button className="primary" onClick={save} disabled={busy}>
            {busy ? "Connecting…" : "Save & Connect"}
          </button>
        </div>
      </div>
    </div>
  );
}
