// components/ResultsPanel.jsx
// Shows the agent's output in a tabbed layout: AI Summary, Evidence Items, and Sources.
import React, { useState } from "react";
import { api } from "../api.js";
import CitationText from "./CitationText.jsx";
import EvidenceCard from "./EvidenceCard.jsx";
import SourceModal from "./SourceModal.jsx";
import Icon from "./Icon.jsx";

const TABS = [
  { id: "summary", label: "AI Summary", icon: "sparkles" },
  { id: "evidence", label: "Evidence", icon: "file" },
  { id: "sources", label: "Sources", icon: "plug" },
];

export default function ResultsPanel({ result }) {
  const [activeTab, setActiveTab] = useState("summary");
  const [highlight, setHighlight] = useState(null);
  const [openItem, setOpenItem] = useState(null);

  function onCite(id) {
    setHighlight(id);
    setActiveTab("evidence");
    setTimeout(() => {
      const el = document.getElementById(`ev-${id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
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
      {/* Tab bar */}
      <div className="results-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={"results-tab " + (activeTab === tab.id ? "results-tab--active" : "")}
            onClick={() => setActiveTab(tab.id)}
          >
            <Icon name={tab.icon} size={15} />
            {tab.label}
            {tab.id === "evidence" && <span className="results-tab-badge">{result.items.length}</span>}
          </button>
        ))}
        <span className="results-spacer" />
        <button className="ghost" onClick={() => doExport("csv")}><Icon name="download" size={15} /> CSV</button>
        <button className="ghost" onClick={() => doExport("json")}><Icon name="download" size={15} /> JSON</button>
      </div>

      {/* Tab content */}
      <div className="results-tab-content">
        {activeTab === "summary" && (
          <div className="results-summary-tab">
            <CitationText text={result.answer} onCite={onCite} />
            {result.synth_count != null && result.items.length > result.synth_count && (
              <p className="results-note">AI summary based on the top {result.synth_count} of {result.items.length} items</p>
            )}
          </div>
        )}

        {activeTab === "evidence" && (
          <div className="results-evidence-tab">
            <div className="results-list-head">
              {result.items.length} evidence items
            </div>
            {result.items.map((it, i) => (
              <EvidenceCard key={it.id} item={it} index={i} highlighted={highlight === it.id} onOpen={setOpenItem} />
            ))}
          </div>
        )}

        {activeTab === "sources" && (
          <div className="results-sources-tab">
            {Object.entries(result.per_connector).map(([id, info]) => (
              <div key={id} className="results-source-row">
                <span className={"chip " + (info.error ? "chip-err" : "")}>
                  {id}
                </span>
                <span className="results-source-detail">
                  {info.error ? <span className="text-err">Error: {info.error}</span> : `${info.count} items returned`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {openItem && <SourceModal item={openItem} onClose={() => setOpenItem(null)} />}
    </div>
  );
}
