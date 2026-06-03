// components/AuditModal.jsx
// History panel showing all past queries with an eye button to view full details.
import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import Icon from "./Icon.jsx";

function DetailView({ detail, onBack }) {
  const perConnector = detail.per_connector ? JSON.parse(detail.per_connector) : {};
  const [rebinding, setRebinding] = useState(false);
  const [rebindMsg, setRebindMsg] = useState("");

  async function handleRebind() {
    setRebinding(true);
    setRebindMsg("");
    try {
      const res = await api.rebind(detail.query_id);
      setRebindMsg(`✓ Re-applied credentials for: ${res.rebound.join(", ")}`);
    } catch (e) {
      setRebindMsg("✗ " + (e.response?.data?.detail || e.message));
    } finally {
      setRebinding(false);
    }
  }

  return (
    <div className="history-detail">
      <button className="ghost history-back" onClick={onBack}>
        ← Back to history
      </button>

      <div className="history-detail-section">
        <h4>Query</h4>
        <p className="history-detail-question">{detail.question}</p>
      </div>

      <div className="history-detail-section">
        <h4>AI Summary</h4>
        <div className="history-detail-answer">{detail.answer || "No AI summary available"}</div>
      </div>

      <div className="history-detail-section">
        <h4>Sources</h4>
        <div className="history-detail-sources">
          {Object.entries(perConnector).map(([id, info]) => (
            <div key={id} className="history-source-chip">
              <span className="chip">{id}</span>
              <span>{info.error ? <span className="text-err">{info.error}</span> : `${info.count} items`}</span>
            </div>
          ))}
          {Object.keys(perConnector).length === 0 && (
            <span className="hint">Connectors: {detail.connectors}</span>
          )}
        </div>
      </div>

      <div className="history-detail-section">
        <h4>Metadata</h4>
        <table className="audit-table">
          <tbody>
            <tr><td><strong>Query ID</strong></td><td>{detail.query_id}</td></tr>
            <tr><td><strong>User</strong></td><td>{detail.user}</td></tr>
            <tr><td><strong>Time</strong></td><td>{(detail.created_at || "").replace("T", " ")}</td></tr>
            <tr><td><strong>Results</strong></td><td>{detail.result_count} evidence items</td></tr>
          </tbody>
        </table>
      </div>

      {detail.credentials_used && Object.keys(detail.credentials_used).length > 0 && (
        <div className="history-detail-section">
          <h4>Credentials Used</h4>
          <div className="history-creds-list">
            {Object.entries(detail.credentials_used).map(([connId, creds]) => (
              <div key={connId} className="history-cred-item">
                <span className="chip">{connId}</span>
                <span className="history-cred-keys">{Object.keys(creds).join(", ")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="history-detail-section">
        <button className="primary rebind-btn" onClick={handleRebind} disabled={rebinding}>
          <Icon name="refresh" size={15} />
          {rebinding ? "Re-applying…" : "Rebind Credentials"}
        </button>
        {rebindMsg && <p className={"rebind-msg " + (rebindMsg.startsWith("✓") ? "rebind-ok" : "rebind-err")}>{rebindMsg}</p>}
      </div>
    </div>
  );
}

export default function AuditModal({ onClose }) {
  const [rows, setRows] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loadingId, setLoadingId] = useState(null);

  useEffect(() => { api.audit().then(setRows); }, []);

  async function viewDetail(query_id) {
    setLoadingId(query_id);
    try {
      const data = await api.historyDetail(query_id);
      setDetail(data);
    } catch (e) {
      alert("Could not load details: " + e.message);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-icon"><Icon name="clipboard" size={20} /></span>
          <div>
            <h3>Query History</h3>
            <p>All past queries — click the eye icon to view full details.</p>
          </div>
          <button className="modal-close" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div className="modal-body">
          {detail ? (
            <DetailView detail={detail} onBack={() => setDetail(null)} />
          ) : (
            <table className="audit-table">
              <thead>
                <tr><th>Time</th><th>User</th><th>Question</th><th>Sources</th><th>#</th><th></th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.query_id}>
                    <td>{(r.created_at || "").slice(0, 19).replace("T", " ")}</td>
                    <td>{r.user}</td>
                    <td className="history-question-cell">{r.question}</td>
                    <td>{r.connectors}</td>
                    <td>{r.result_count}</td>
                    <td>
                      <button
                        className="history-eye-btn"
                        onClick={() => viewDetail(r.query_id)}
                        title="View details"
                        disabled={loadingId === r.query_id}
                      >
                        <Icon name="eye" size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={6} className="hint">No queries yet.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
