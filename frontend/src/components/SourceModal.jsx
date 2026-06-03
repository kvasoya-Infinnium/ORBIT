// components/SourceModal.jsx
// Opens when you click "Open source" on an evidence card. Shows the full extracted
// content plus its provenance (source, author, time, and the original path/link).
//
// Why a modal instead of a real link? Most sources can't be opened by the browser:
// a Fileshare item is a local path (C:\...\file.txt), Email is imap://, S3 is s3://.
// Browsers block those for security. For eDiscovery the defensible thing is to show
// the exact captured content + where it came from, which is what this does.
import React from "react";
import Icon from "./Icon.jsx";

export default function SourceModal({ item, onClose }) {
  // If it IS a real web link (Slack/Zoho https), offer to open it too.
  const isWeb = item.link && /^https?:\/\//i.test(item.link);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-icon"><Icon name="file" size={20} /></span>
          <div>
            <h3>{item.title}</h3>
            <p>{item.source_label || item.source} · [{item.id}]</p>
          </div>
          <button className="modal-close" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>

        <div className="modal-body">
          <div className="source-meta">
            <div><span>Author</span>{item.author || "unknown"}</div>
            <div><span>Timestamp</span>{item.timestamp || "—"}</div>
            <div><span>Record id</span>{item.record_id || "—"}</div>
            <div className="source-meta-wide">
              <span>Origin</span>
              {isWeb
                ? <a href={item.link} target="_blank" rel="noreferrer">{item.link}</a>
                : <code>{item.link || "—"}</code>}
            </div>
          </div>

          <div className="source-content-label">Captured content</div>
          <pre className="source-content">{item.content || "(no content captured)"}</pre>
        </div>
      </div>
    </div>
  );
}
