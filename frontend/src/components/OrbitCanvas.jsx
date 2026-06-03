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
const ZOOM_MIN = 0.35;
const ZOOM_MAX = 2.0;
const ZOOM_STEP = 0.15;
// the orbit at zoom=1 needs roughly this much space (radius + half a connector pill)
const NATURAL_SIZE = (RADIUS + 60) * 2;

// auto-fit zoom: shrink the orbit to fit the container, with a small extra factor for crowded rings
function autoFit(n, w, h) {
  const dim = Math.min(w || NATURAL_SIZE, h || NATURAL_SIZE);
  const crowding = n <= 4 ? 1 : n <= 6 ? 0.92 : n <= 8 ? 0.85 : n <= 10 ? 0.78 : 0.7;
  const fit = (dim / NATURAL_SIZE) * crowding;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, fit));
}

export default function OrbitCanvas({ orbit, byId, onDropType, onRemove, onOpenCreds }) {
  const [dragOver, setDragOver] = React.useState(false);
  const [zoom, setZoom] = React.useState(1);
  const [userZoomed, setUserZoomed] = React.useState(false);
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  const canvasRef = React.useRef(null);

  // observe canvas size so auto-fit can react to layout changes (e.g. collapse)
  React.useEffect(() => {
    if (!canvasRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(canvasRef.current);
    return () => ro.disconnect();
  }, []);

  // auto-fit when orbit count or container size changes (unless the user has manually zoomed)
  React.useEffect(() => {
    if (!userZoomed) setZoom(autoFit(orbit.length, size.w, size.h));
  }, [orbit.length, size.w, size.h, userZoomed]);

  const clampZoom = (z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
  const zoomIn  = () => { setUserZoomed(true); setZoom((z) => clampZoom(z + ZOOM_STEP)); };
  const zoomOut = () => { setUserZoomed(true); setZoom((z) => clampZoom(z - ZOOM_STEP)); };
  const zoomFit = () => { setUserZoomed(false); setZoom(autoFit(orbit.length, size.w, size.h)); };

  function handleWheel(e) {
    // only zoom with Ctrl/Cmd held, so normal page scroll still works elsewhere
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setUserZoomed(true);
    setZoom((z) => clampZoom(z + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)));
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const typeId = e.dataTransfer.getData("text/connector-type");
    if (typeId) onDropType?.(typeId);
  }

  const n = orbit.length;

  return (
    <section
      ref={canvasRef}
      className={"orbit-canvas" + (dragOver ? " drag-over" : "")}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onWheel={handleWheel}
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
        <div className="orbit-zoom-controls" onWheel={(e) => e.stopPropagation()}>
          <button className="orbit-zoom-btn" onClick={zoomOut} disabled={zoom <= ZOOM_MIN + 0.001} title="Zoom out (Ctrl + scroll)">
            <Icon name="minus" size={16} />
          </button>
          <button className="orbit-zoom-fit" onClick={zoomFit} title="Auto-fit">
            {Math.round(zoom * 100)}%
          </button>
          <button className="orbit-zoom-btn" onClick={zoomIn} disabled={zoom >= ZOOM_MAX - 0.001} title="Zoom in (Ctrl + scroll)">
            <Icon name="plus" size={16} />
          </button>
        </div>
      )}

      {n > 0 && (
        <div className="orbit-stage" style={{ transform: `scale(${zoom})` }}>
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
