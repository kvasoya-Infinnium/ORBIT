// components/Sidebar.jsx
// The left rail. Two parts:
//   1. "Add a connector" — the catalog of types. Click one to create a NEW instance
//      (you can make several of the same type, e.g. two Fileshares). It opens that
//      new instance's credential popup right away.
//   2. "Your connectors" — every instance you have. Each tile can be:
//        • dragged onto the canvas (adds it to the orbit),
//        • double-clicked (opens its credential popup),
//        • removed (the trash button).
import React from "react";
import Icon, { connectorIconName } from "./Icon.jsx";

export default function Sidebar({
  connectors, types, orbit,
  onOpenCreds, onAddToOrbit, onAddInstance, onDeleteInstance,
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <div className="sidebar-head">
          <h2>Add a connector</h2>
          <p>Click to add — you can add more than one of a type</p>
        </div>
        <div className="type-catalog">
          {types.map((t) => (
            <button
              key={t.type_id}
              className={"type-chip chip-ttype-" + t.type_id}
              onClick={() => onAddInstance(t.type_id)}
              title={`Add a ${t.name}`}
            >
              <span className={"type-chip-icon ttype-" + t.type_id}><Icon name={connectorIconName(t.type_id)} size={15} /></span>
              <span className="type-name">{t.name}</span>
              <Icon name="plus" size={14} className="type-plus" />
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar-section sidebar-grow">
        <div className="sidebar-head">
          <h2>Your connectors</h2>
          <p>Drag onto the canvas · double-click to connect</p>
        </div>
        <div className="connector-list">
          {connectors.map((c) => {
            const inOrbit = orbit.includes(c.id);
            return (
              <div
                key={c.id}
                className={"connector-tile tile-ttype-" + c.type_id + (inOrbit ? " in-orbit" : "")}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/connector", c.id)}
                onDoubleClick={() => onOpenCreds(c.id)}
                title="Drag to canvas · double-click for credentials"
              >
                <Icon name="grip" size={16} className="tile-grip" />
                <span className={"tile-icon ttype-" + c.type_id}>
                  <Icon name={connectorIconName(c.type_id)} size={17} />
                </span>
                <span className="tile-body">
                  <span className="tile-name">{c.name}</span>
                  <span className="tile-detail">{c.detail || "not configured"}</span>
                </span>
                <span className={"dot " + (c.connected ? "ok" : "warn")} title={c.connected ? "Connected" : "Needs credentials"} />
                <div className="tile-actions">
                  {!inOrbit && (
                    <button className="icon-btn" onClick={() => onAddToOrbit(c.id)} title="Add to orbit">
                      <Icon name="plus" size={15} />
                    </button>
                  )}
                  <button className="icon-btn danger" onClick={() => onDeleteInstance(c.id)} title="Delete connector">
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="sidebar-foot">
        <Icon name="orbit" size={13} />
        <span className="hint">Only connectors in the orbit are searched.</span>
      </div>
    </aside>
  );
}
