// components/OrbitCanvas.jsx
// The center stage. Connectors dropped here orbit the glowing ORBIT core, joined to
// it by light "spokes". This set is what a query actually searches.
//
// How it works:
//  - The whole area is a drop target (onDragOver + onDrop).
//  - For N connectors we place each at an even angle on a circle of radius R.
//  - The ring slowly rotates (CSS); each node's label counter-rotates to stay upright.
//  - Hover a node to reveal a remove (×) button; double-click opens its credentials.
import React from "react";
import Icon, { connectorIconName } from "./Icon.jsx";

const RADIUS = 168; // px from the core to each connector node

export default function OrbitCanvas({ orbit, byId, onDropConnector, onRemove, onOpenCreds }) {
  const [dragOver, setDragOver] = React.useState(false);

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const id = e.dataTransfer.getData("text/connector");
    if (id) onDropConnector(id);
  }

  const n = orbit.length;

  return (
    <section
      className={"orbit-canvas" + (dragOver ? " drag-over" : "")}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <div className="nebula nebula-1" />
      <div className="nebula nebula-2" />
      <div className="nebula nebula-3" />
      <div className="starfield" />
      <div className="starfield starfield-2" />
      <div className="orbit-glow" />

      {n > 0 && (
        <>
          <div className="energy-ring energy-ring-1" />
          <div className="energy-ring energy-ring-2" />
          <div className="energy-ring energy-ring-3" />
        </>
      )}

      {n === 0 && (
        <div className="orbit-empty">
          <div className="orbit-empty-ring"><Icon name="orbit" size={34} /></div>
          <p>Drag connectors here</p>
          <span>Build your ORBIT, then run a query across all of them at once.</span>
        </div>
      )}

      {n > 0 && (
        <div className="orbit-stage">
          <div className="orbit-guide" style={{ width: RADIUS * 2, height: RADIUS * 2 }} />
          <div className="orbit-guide orbit-guide-inner" style={{ width: RADIUS * 2 - 60, height: RADIUS * 2 - 60 }} />

          <div className="orbit-ring">
            {orbit.map((id, i) => {
              const angle = (360 / n) * i;
              const c = byId(id) || {};
              return (
                <div
                  key={id}
                  className="orbit-node"
                  // place a zero-size point exactly on the circle at this angle
                  style={{ transform: `rotate(${angle}deg) translateX(${RADIUS}px)` }}
                >
                  {/* spoke: a line spanning from the core (x=-R) to this point (x=0).
                      It rotates with the ring, so it always points at the centre. */}
                  <span className="spoke" style={{ left: -RADIUS, width: RADIUS }}>
                    <span className="spoke-pulse" style={{ animationDelay: `${i * 0.6}s` }} />
                  </span>

                  {/* undo the placement angle so the pill sits upright relative to the ring */}
                  <div className="orbit-node-upright" style={{ transform: `rotate(${-angle}deg)` }}>
                    {/* counter the ring's continuous spin so the pill stays screen-upright */}
                    <div className="orbit-node-spin">
                      <div
                        className={"orbit-node-inner ttype-glow-" + c.type_id}
                        onDoubleClick={() => onOpenCreds(id)}
                        title="Double-click for credentials"
                      >
                        <span className={"node-icon ttype-" + c.type_id}>
                          <Icon name={connectorIconName(c.type_id)} size={16} />
                        </span>
                        <span className="node-name">{c.name}</span>
                        <span className={"dot " + (c.connected ? "ok" : "warn")} />
                        <button className="node-remove" onClick={() => onRemove(id)} title="Remove">
                          <Icon name="x" size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="orbit-core">
            <span className="core-halo" />
            <span className="core-halo core-halo-2" />
            <Icon name="orbit" size={30} className="core-mark" />
            <span className="core-label">ORBIT</span>
            <span className="core-count">{n} source{n === 1 ? "" : "s"}</span>
          </div>
        </div>
      )}
    </section>
  );
}
