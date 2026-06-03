// components/ResultsPanel.jsx
// Shows the agent's output: a per-source status line, the synthesized answer with
// clickable citations, an Export button, and the ranked evidence list.
import React, { useState } from "react";
import { api } from "../api.js";
import CitationText from "./CitationText.jsx";
import EvidenceCard from "./EvidenceCard.jsx";
import SourceModal from "./SourceModal.jsx";
import Icon from "./Icon.jsx";

export default function ResultsPanel({ result }) {
  const [highlight, setHighlight] = useState(null);
  const [openItem, setOpenItem] = useState(null);

  function onCite(id) {
    setHighlight(id);
    const el = document.getElementById(`ev-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function doExport(fmt) {
    const blob = await api.export(result.query_id, fmt);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orbit_review_set.${fmt}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="results">
      <div className="results-status">
        {Object.entries(result.per_connector).map(([id, info]) => (
          <span key={id} className={"chip " + (info.error ? "chip-err" : "")}>
            {id}: {info.error ? "error" : `${info.count}`}
          </span>
        ))}
        <span className="results-spacer" />
        <button className="ghost" onClick={() => doExport("csv")}><Icon name="download" size={15} /> CSV</button>
        <button className="ghost" onClick={() => doExport("json")}><Icon name="download" size={15} /> JSON</button>
      </div>

      <CitationText text={result.answer} onCite={onCite} />

      <div className="results-list-head">
        {result.items.length} evidence items
        {result.synth_count != null && result.items.length > result.synth_count && (
          <span className="results-note"> · AI summary based on the top {result.synth_count}</span>
        )}
      </div>
      {result.items.map((it) => (
        <EvidenceCard key={it.id} item={it} highlighted={highlight === it.id} onOpen={setOpenItem} />
      ))}

      {openItem && <SourceModal item={openItem} onClose={() => setOpenItem(null)} />}
    </div>
  );
}
