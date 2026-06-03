// components/AuditModal.jsx
// A popup table of every query that was ever run — the "defensibility" view.
import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import Icon from "./Icon.jsx";

export default function AuditModal({ onClose }) {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.audit().then(setRows); }, []);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-icon"><Icon name="clipboard" size={20} /></span>
          <div>
            <h3>Audit log</h3>
            <p>Every query is recorded — who, when, what, and how many results.</p>
          </div>
          <button className="modal-close" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div className="modal-body">
          <table className="audit-table">
            <thead>
              <tr><th>Time</th><th>User</th><th>Question</th><th>Sources</th><th>#</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.query_id}>
                  <td>{(r.created_at || "").slice(0, 19).replace("T", " ")}</td>
                  <td>{r.user}</td>
                  <td>{r.question}</td>
                  <td>{r.connectors}</td>
                  <td>{r.result_count}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} className="hint">No queries yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
