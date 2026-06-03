// components/EvidenceCard.jsx
// One result in the ranked list. Shows the source badge, title, author/date,
// snippet, and a link to the original. Gets highlighted when its citation is clicked.
import React from "react";
import Icon from "./Icon.jsx";
import BrandIcon from "./BrandIcon.jsx";

export default function EvidenceCard({ item, index = 0, highlighted, onOpen }) {
  return (
    <div
      className={"card card-ttype-" + item.source + (highlighted ? " card-highlighted" : "")}
      id={`ev-${item.id}`}
      style={{ animationDelay: `${Math.min(index, 12) * 0.05}s` }}
    >
      <div className="row">
        <span className={"ev-icon ev-icon-brand ttype-" + item.source}>
          <BrandIcon typeId={item.source} size={16} />
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
