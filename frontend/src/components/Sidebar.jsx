// components/Sidebar.jsx
// The left rail.
//   • "Your connectors" — every instance you have, grouped by type. When a type
//     has more than one instance (e.g. two Fileshares), the group is collapsible
//     and the children show as individual rows. Single-instance types render as
//     a regular tile. Each row can be dragged onto the canvas, double-clicked to
//     open its credential popup, or removed.
//   • "Add connector" (bottom) — opens a popover with the connector catalog.
//     Picking a type creates a new instance and opens its credential popup.
import React, { useState, useRef, useEffect } from "react";
import Icon, { connectorIconName } from "./Icon.jsx";

function ConnectorRow({ c, inOrbit, nested, onOpenCreds, onAddToOrbit, onDeleteInstance }) {
  return (
    <div
      className={
        "connector-tile tile-ttype-" + c.type_id +
        (inOrbit ? " in-orbit" : "") +
        (nested ? " connector-tile-nested" : "")
      }
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
}

export default function Sidebar({
  connectors, types, orbit,
  onOpenCreds, onAddToOrbit, onAddInstance, onDeleteInstance,
}) {
  const [openGroups, setOpenGroups] = useState({});   // type_id -> bool
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addBtnRef = useRef(null);
  const addMenuRef = useRef(null);

  // close add-menu on outside click
  useEffect(() => {
    if (!showAddMenu) return;
    function onDocClick(e) {
      if (addMenuRef.current?.contains(e.target)) return;
      if (addBtnRef.current?.contains(e.target)) return;
      setShowAddMenu(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showAddMenu]);

  // group connectors by type_id, preserving the type order from `types` (catalog)
  const groups = [];
  const seen = new Set();
  for (const t of types) {
    const items = connectors.filter((c) => c.type_id === t.type_id);
    if (items.length === 0) continue;
    groups.push({ type: t, items });
    seen.add(t.type_id);
  }
  // any orphan types (instance exists but type missing from catalog) — fall back
  for (const c of connectors) {
    if (seen.has(c.type_id)) continue;
    groups.push({ type: { type_id: c.type_id, name: c.name, icon: c.icon }, items: [c] });
    seen.add(c.type_id);
  }

  function toggleGroup(type_id) {
    setOpenGroups((g) => ({ ...g, [type_id]: !g[type_id] }));
  }

  async function handleAddInstance(type_id) {
    setShowAddMenu(false);
    // ensure the group will be open so the new instance is visible
    setOpenGroups((g) => ({ ...g, [type_id]: true }));
    await onAddInstance(type_id);
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-section sidebar-grow">
        <div className="sidebar-head">
          <h2>Your connectors</h2>
          <p>Drag onto the canvas · double-click to connect</p>
        </div>
        <div className="connector-list">
          {groups.map(({ type, items }) => {
            if (items.length === 1) {
              const c = items[0];
              return (
                <ConnectorRow
                  key={c.id}
                  c={c}
                  inOrbit={orbit.includes(c.id)}
                  onOpenCreds={onOpenCreds}
                  onAddToOrbit={onAddToOrbit}
                  onDeleteInstance={onDeleteInstance}
                />
              );
            }
            const open = !!openGroups[type.type_id];
            const connected = items.filter((c) => c.connected).length;
            return (
              <div key={type.type_id} className={"connector-group" + (open ? " open" : "")}>
                <button
                  className={"connector-group-head tile-ttype-" + type.type_id}
                  onClick={() => toggleGroup(type.type_id)}
                  title={open ? "Hide instances" : "Show instances"}
                >
                  <Icon
                    name={open ? "chevron-down" : "chevron-right"}
                    size={14}
                    className="group-caret"
                  />
                  <span className={"tile-icon ttype-" + type.type_id}>
                    <Icon name={connectorIconName(type.type_id)} size={17} />
                  </span>
                  <span className="tile-body">
                    <span className="tile-name">{type.name}</span>
                    <span className="tile-detail">{items.length} instances · {connected} connected</span>
                  </span>
                  <span
                    className="icon-btn group-add"
                    onClick={(e) => { e.stopPropagation(); handleAddInstance(type.type_id); }}
                    title={`Add another ${type.name}`}
                    role="button"
                  >
                    <Icon name="plus" size={15} />
                  </span>
                </button>
                {open && (
                  <div className="connector-group-body">
                    {items.map((c) => (
                      <ConnectorRow
                        key={c.id}
                        c={c}
                        inOrbit={orbit.includes(c.id)}
                        nested
                        onOpenCreds={onOpenCreds}
                        onAddToOrbit={onAddToOrbit}
                        onDeleteInstance={onDeleteInstance}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="sidebar-add">
        {showAddMenu && (
          <div ref={addMenuRef} className="add-menu">
            <div className="add-menu-head">Pick a connector type</div>
            <div className="add-menu-list">
              {types.map((t) => (
                <button
                  key={t.type_id}
                  className={"add-menu-item chip-ttype-" + t.type_id}
                  onClick={() => handleAddInstance(t.type_id)}
                  title={`Add a ${t.name}`}
                >
                  <span className={"tile-icon ttype-" + t.type_id}>
                    <Icon name={connectorIconName(t.type_id)} size={15} />
                  </span>
                  <span className="add-menu-name">{t.name}</span>
                  <Icon name="plus" size={14} className="type-plus" />
                </button>
              ))}
            </div>
          </div>
        )}
        <button
          ref={addBtnRef}
          className={"add-connector-btn" + (showAddMenu ? " active" : "")}
          onClick={() => setShowAddMenu((v) => !v)}
        >
          <Icon name="plus" size={16} />
          <span>Add connector</span>
        </button>
      </div>

      <div className="sidebar-foot">
        <Icon name="orbit" size={13} />
        <span className="hint">Only connectors in the orbit are searched.</span>
      </div>
    </aside>
  );
}
