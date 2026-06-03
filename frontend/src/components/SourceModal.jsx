// components/SourceModal.jsx
// Opens when you click "Open source" on an evidence card. Shows the full extracted
// content plus its provenance (source, author, time, and the original path/link).
//
// Why a modal instead of a real link? Most sources can't be opened by the browser:
// a Fileshare item is a local path (C:\...\file.txt), Email is imap://, S3 is s3://.
// Browsers block those for security. For eDiscovery the defensible thing is to show
// the exact captured content + where it came from, which is what this does.
import React, { useMemo, useEffect, useRef } from "react";
import Icon from "./Icon.jsx";

// Stopwords we won't bother highlighting (too generic, just noise).
const STOPWORDS = new Set([
  "the","a","an","and","or","but","is","are","was","were","be","been","being",
  "of","to","in","on","for","with","at","by","from","as","into","about","that",
  "this","these","those","it","its","i","me","my","you","your","we","our",
  "give","show","find","tell","get","please","need","want","what","when",
  "where","why","how","who","whom","whose","do","does","did","details",
  "info","information","data","record","records","employee","person",
]);

// Pull out the words/phrases we want to highlight. We pull from BOTH the
// structured planner query AND the raw question so single-term plans don't
// leave the document looking unmarked.
function collectTerms(query) {
  const out = new Set();
  if (!query) return [];
  const push = (v) => {
    if (!v) return;
    const s = String(v).trim();
    if (s.length >= 2) out.add(s);
  };
  if (Array.isArray(query.keywords)) query.keywords.forEach(push);
  push(query.person);
  push(query.exact_value);
  if (typeof query.question === "string") {
    query.question.split(/\s+/).forEach((w) => {
      const cleaned = w.replace(/[^\w\-]/g, "");
      if (cleaned.length < 3) return;
      if (STOPWORDS.has(cleaned.toLowerCase())) return;
      push(cleaned);
    });
  }
  // longer terms first so multi-word phrases beat their substrings
  return [...out].sort((a, b) => b.length - a.length);
}

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// Renders `text` with each occurrence of any term wrapped in <mark>.
function Highlighted({ text, terms }) {
  if (!text) return null;
  if (!terms || terms.length === 0) return <>{text}</>;
  const pattern = new RegExp("(" + terms.map(escapeRegex).join("|") + ")", "gi");
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1
          ? <mark key={i} className="hl">{part}</mark>
          : <React.Fragment key={i}>{part}</React.Fragment>
      )}
    </>
  );
}

export default function SourceModal({ item, query, onClose }) {
  const isWeb = item.link && /^https?:\/\//i.test(item.link);
  const meta = item.metadata || {};
  const metaKeys = Object.keys(meta).filter(k => k !== "root");
  const terms = useMemo(() => collectTerms(query), [query]);

  // jump to the first highlighted match when the modal opens
  const contentRef = useRef(null);
  useEffect(() => {
    const first = contentRef.current?.querySelector("mark.hl");
    if (first) first.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [item.id, terms]);

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

          {metaKeys.length > 0 && (
            <>
              <div className="source-content-label">File Metadata</div>
              <div className="source-metadata-grid">
                {metaKeys.map((key) => (
                  <div key={key} className="source-metadata-item">
                    <span className="source-metadata-key">{key.replace(/_/g, " ")}</span>
                    <span className="source-metadata-value">{String(meta[key])}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="source-content-label">
            Captured content
            {terms.length > 0 && (
              <span className="source-hl-hint">
                · highlighting{" "}
                {terms.map((t, i) => (
                  <React.Fragment key={t}>
                    <span className="source-hl-chip">{t}</span>
                    {i < terms.length - 1 ? " " : ""}
                  </React.Fragment>
                ))}
              </span>
            )}
          </div>
          <pre className="source-content" ref={contentRef}>
            {item.content
              ? <Highlighted text={item.content} terms={terms} />
              : "(no content captured)"}
          </pre>
        </div>
      </div>
    </div>
  );
}
