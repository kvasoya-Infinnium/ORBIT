// components/CitationText.jsx
// Takes the agent's answer text and turns every [source-id] like [fileshare-1] into
// a clickable link that scrolls to / highlights the matching Evidence card.
// This is what makes citations REAL instead of decorative.
import React from "react";

export default function CitationText({ text, onCite }) {
  const parts = [];
  const regex = /\[([a-z0-9_]+-\d+)\]/g;   // matches [fileshare_1-1], [email_2-3], ...
  let last = 0;
  let m;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const id = m[1];
    parts.push(
      <span key={m.index} className="cite" onClick={() => onCite(id)}>
        [{id}]
      </span>
    );
    last = regex.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <div className="answer">{parts}</div>;
}
