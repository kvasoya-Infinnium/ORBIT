// components/EvidenceCard.jsx
// One result in the ranked list. Shows the source badge, title, author/date,
// snippet, and a link to the original. Gets highlighted when its citation is clicked.
import React from "react";
import Icon, { connectorIconName } from "./Icon.jsx";

export default function EvidenceCard({ item, highlighted, onOpen }) {
  return (
    <div
      className="card"
      id={`ev-${item.id}`}
      style={highlighted ? { borderColor: "#38bdf8", boxShadow: "0 0 0 2px #38bdf8" } : {}}
    >
      <div className="row">
        <span className={"ev-icon ttype-" + item.source}>
          <Icon name={connectorIconName(item.source)} size={15} />
        </span>
        <span className="badge">{item.source}</span>
        <strong className="ev-title">{item.title}</strong>
        <span style={{ flex: 1 }} />
        <button className="link-btn" onClick={() => onOpen(item)}>
          <Icon name="file" size={14} /> Open source
        </button>
        <span className="meta ev-id">[{item.id}]</span>
      </div>
      <div className="snippet">{item.snippet}</div>
      <div className="meta">
        {item.author || "unknown author"} · {item.timestamp || "no date"}
        {item.link && <> · <span className="provenance">{item.link}</span></>}
      </div>
    </div>
  );
}
