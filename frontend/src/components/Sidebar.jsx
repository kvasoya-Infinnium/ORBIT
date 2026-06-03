// components/Sidebar.jsx
// The left rail is a *connector palette*. One row per connector TYPE.
//   • Drag a row onto the canvas, or click "Add to orbit" — either way it
//     creates a fresh instance of that type, drops it into the orbit, and pops
//     the credential dialog. You can do this twice for the same type (e.g. an
//     HR fileshare and a Legal fileshare); each lives in the orbit as its own
//     node with its own credentials.
//   • A bottom "Add connector" button opens a popover with the same list — a
//     redundant entry point for users who prefer clicking to dragging.
import React, { useState, useRef, useEffect } from "react";
import Icon from "./Icon.jsx";
import BrandIcon from "./BrandIcon.jsx";

export default function Sidebar({ connectors, types, orbit, onAddTypeToOrbit }) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addBtnRef = useRef(null);
  const addMenuRef = useRef(null);

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

  // count how many instances of a type are currently in the orbit (info only)
  function inOrbitCount(type_id) {
    return connectors.filter((c) => c.type_id === type_id && orbit.includes(c.id)).length;
  }

  async function pickFromMenu(type_id) {
    setShowAddMenu(false);
    await onAddTypeToOrbit(type_id);
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-section sidebar-grow">
        <div className="sidebar-head">
          <h2>Connectors</h2>
          <p>Drag onto the canvas to add it to your ORBIT</p>
        </div>
        <div className="connector-list">
          {types.map((t) => {
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
        </div>
      </div>

      <div className="sidebar-add">
        {showAddMenu && (
          <div ref={addMenuRef} className="add-menu">
            <div className="add-menu-head">Pick a connector</div>
            <div className="add-menu-list">
              {types.map((t) => (
                <button
                  key={t.type_id}
                  className={"add-menu-item chip-ttype-" + t.type_id}
                  onClick={() => pickFromMenu(t.type_id)}
                  title={`Add a ${t.name} to orbit`}
                >
                  <span className={"tile-icon tile-icon-brand ttype-" + t.type_id}>
                    <BrandIcon typeId={t.type_id} size={18} />
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
