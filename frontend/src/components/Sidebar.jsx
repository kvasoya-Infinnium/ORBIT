// components/Sidebar.jsx
// The left rail is a *connector palette*. One row per connector TYPE.
//   • Drag a row onto the canvas, or click "+" — either way it creates a fresh
//     instance of that type, drops it into the orbit, and pops the credential
//     dialog.
//   • Below the live connectors is an "Upcoming connectors" showcase — a list
//     of integrations we plan to add. These tiles are visual only (disabled,
//     no drag) so visitors can see the roadmap.
import React from "react";
import Icon from "./Icon.jsx";
import BrandIcon, { hasBrand } from "./BrandIcon.jsx";

// type_ids that exist in the backend but should NOT be offered as active
// connectors (they live in the "Upcoming" section instead).
const DEFERRED_TYPES = new Set(["s3", "notion", "ai_chat"]);

// Showcase-only roadmap. `brand` matches a BrandIcon entry when available;
// otherwise we fall back to a colored letter chip.
const UPCOMING = [
  { id: "s3",          name: "AWS S3",          color: "#FF9900" },
  { id: "notion",      name: "Notion",          color: "#FFFFFF" },
  { id: "ai_chat",     name: "GPT / AI Chat",   color: "#10A37F" },
  { id: "gdrive",      name: "Google Drive",    color: "#1FA463" },
  { id: "dropbox",     name: "Dropbox",         color: "#0061FF" },
  { id: "onedrive",    name: "OneDrive",        color: "#0078D4" },
  { id: "sharepoint",  name: "SharePoint",      color: "#036C70" },
  { id: "confluence",  name: "Confluence",      color: "#2684FF" },
  { id: "jira",        name: "Jira",            color: "#2684FF" },
  { id: "salesforce",  name: "Salesforce",      color: "#00A1E0" },
  { id: "hubspot",     name: "HubSpot",         color: "#FF7A59" },
  { id: "teams",       name: "Microsoft Teams", color: "#5059C9" },
  { id: "discord",     name: "Discord",         color: "#5865F2" },
  { id: "github",      name: "GitHub",          color: "#FFFFFF" },
  { id: "gitlab",      name: "GitLab",          color: "#FC6D26" },
  { id: "box",         name: "Box",             color: "#0061D5" },
  { id: "asana",       name: "Asana",           color: "#F06A6A" },
  { id: "linear",      name: "Linear",          color: "#5E6AD2" },
  { id: "zendesk",     name: "Zendesk",         color: "#03363D" },
  { id: "servicenow",  name: "ServiceNow",      color: "#62D84E" },
];

function UpcomingIcon({ item }) {
  const branded = hasBrand(item.id);
  return (
    <span
      className="tile-icon tile-icon-upcoming"
      style={{ background: hexA(item.color, 0.18) }}
    >
      {branded ? (
        <BrandIcon typeId={item.id} size={18} />
      ) : (
        <span className="upcoming-letter" style={{ color: item.color }}>
          {item.name.charAt(0)}
        </span>
      )}
    </span>
  );
}

// hex+alpha helper — accepts "#RRGGBB", returns "rgba(...)"
function hexA(hex, a) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || "");
  if (!m) return `rgba(255,255,255,${a})`;
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  return `rgba(${r},${g},${b},${a})`;
}

export default function Sidebar({ connectors, types, orbit, onAddTypeToOrbit }) {
  // active types only (filter out deferred ones; they appear in Upcoming)
  const activeTypes = types.filter((t) => !DEFERRED_TYPES.has(t.type_id));

  function inOrbitCount(type_id) {
    return connectors.filter((c) => c.type_id === type_id && orbit.includes(c.id)).length;
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-section sidebar-grow">
        <div className="sidebar-head">
          <h2>Connectors</h2>
          <p>Drag onto the canvas to add it to your ORBIT</p>
        </div>
        <div className="connector-list">
          {activeTypes.map((t) => {
            const count = inOrbitCount(t.type_id);
            return (
              <div
                key={t.type_id}
                className={"connector-tile tile-ttype-" + t.type_id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/connector-type", t.type_id)}
                onDoubleClick={() => onAddTypeToOrbit(t.type_id)}
                title="Drag to canvas · double-click to add"
              >
                <Icon name="grip" size={16} className="tile-grip" />
                <span className={"tile-icon tile-icon-brand ttype-" + t.type_id}>
                  <BrandIcon typeId={t.type_id} size={20} />
                  {count > 0 && <span className="tile-badge">{count}</span>}
                </span>
                <span className="tile-body">
                  <span className="tile-name">{t.name}</span>
                  <span className="tile-detail">
                    {count > 0 ? `${count} in orbit` : "drag to add"}
                  </span>
                </span>
                <div className="tile-actions">
                  <button
                    className="icon-btn"
                    onClick={() => onAddTypeToOrbit(t.type_id)}
                    title={`Add ${t.name} to orbit`}
                  >
                    <Icon name="plus" size={15} />
                  </button>
                </div>
              </div>
            );
          })}

          {/* ---- Upcoming section ---- */}
          <div className="upcoming-divider">
            <span className="upcoming-divider-line" />
            <span className="upcoming-divider-label">Upcoming connectors</span>
            <span className="upcoming-divider-line" />
          </div>

          {UPCOMING.map((item) => (
            <div
              key={item.id}
              className="connector-tile connector-tile-upcoming"
              title="Coming soon"
            >
              <span className="tile-grip" />
              <UpcomingIcon item={item} />
              <span className="tile-body">
                <span className="tile-name">{item.name}</span>
                <span className="tile-detail">coming soon</span>
              </span>
              <span className="upcoming-tag">SOON</span>
            </div>
          ))}
        </div>
      </div>

      <div className="sidebar-foot">
        <Icon name="orbit" size={13} />
        <span className="hint">Only connectors in the orbit are searched.</span>
      </div>
    </aside>
  );
}
