// build_deck.js — builds the 2-slide ORBIT pitch.
// Run with: node build_deck.js

const path = require("path");
process.env.NODE_PATH = "C:\\nvm4w\\nodejs\\node_modules";
require("module").Module._initPaths();

const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const {
  FaSearch, FaQuoteRight, FaPlug, FaShieldAlt,
  FaPuzzlePiece, FaHourglassHalf, FaEyeSlash, FaFileSignature,
} = require("react-icons/fa");

// --- palette (matches the app's dark Ocean / Midnight Executive theme) ---
const C = {
  bg:       "0B1024",
  surface:  "141B36",
  surface2: "1B2347",
  border:   "2A3360",
  text:     "FFFFFF",
  muted:    "A8B0CC",
  faint:    "7A82A6",
  cyan:     "34E3CF",
  accent:   "6E8BFF",
  purple:   "9A7BFF",
  amber:    "FFC83D",
  red:      "FB7185",
};

// helpers ----------------------------------------------------------------
function renderIconSvg(IconComponent, color = "#FFFFFF", size = 256) {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { color, size: String(size) })
  );
}
async function iconPng(IconComponent, color, size = 256) {
  const svg = renderIconSvg(IconComponent, color, size);
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

async function main() {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE"; // 13.3" x 7.5"
  pres.author = "ORBIT Team";
  pres.title = "ORBIT — Unified Discovery Agent";

  // ---------- pre-render icons (each card uses its own brand-color circle)
  const icons = {
    puzzle:   await iconPng(FaPuzzlePiece,    "#FFFFFF"),
    hour:     await iconPng(FaHourglassHalf,  "#FFFFFF"),
    hide:     await iconPng(FaEyeSlash,       "#FFFFFF"),
    sign:     await iconPng(FaFileSignature,  "#FFFFFF"),
    search:   await iconPng(FaSearch,         "#0B1024"),
    quote:    await iconPng(FaQuoteRight,     "#0B1024"),
    plug:     await iconPng(FaPlug,           "#0B1024"),
    shield:   await iconPng(FaShieldAlt,      "#0B1024"),
  };

  // small icon-in-coloured-circle helper. The icon image is white/dark to
  // contrast its circle background.
  function iconChip(slide, { x, y, d, color, icon }) {
    slide.addShape(pres.shapes.OVAL, {
      x, y, w: d, h: d, fill: { color }, line: { color, width: 0 },
    });
    const pad = d * 0.22;
    slide.addImage({
      data: icon, x: x + pad, y: y + pad, w: d - pad * 2, h: d - pad * 2,
    });
  }

  // card helper. accent left rail + body of header + description.
  function card(slide, { x, y, w, h, accent, icon, iconBg, title, body }) {
    // base
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w, h,
      fill: { color: C.surface },
      line: { color: C.border, width: 0.75 },
      shadow: { type: "outer", color: "000000", blur: 18, offset: 6, angle: 90, opacity: 0.35 },
    });
    // accent rail
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 0.08, h,
      fill: { color: accent }, line: { color: accent, width: 0 },
    });
    // icon chip (top-left)
    const d = 0.7;
    iconChip(slide, { x: x + 0.35, y: y + 0.35, d, color: iconBg, icon });
    // header
    slide.addText(title, {
      x: x + 0.35 + d + 0.25, y: y + 0.36, w: w - (0.35 + d + 0.25) - 0.3, h: 0.7,
      fontFace: "Calibri", fontSize: 17, bold: true, color: C.text, valign: "top",
      margin: 0,
    });
    // body
    slide.addText(body, {
      x: x + 0.35, y: y + 0.35 + d + 0.18, w: w - 0.7, h: h - (0.35 + d + 0.18) - 0.3,
      fontFace: "Calibri", fontSize: 13, color: C.muted,
      valign: "top", margin: 0,
    });
  }

  // ---------- SLIDE 1: PROBLEM ----------
  const s1 = pres.addSlide();
  s1.background = { color: C.bg };

  // soft glow blobs in the background for depth
  s1.addShape(pres.shapes.OVAL, { x: -2.5, y: -2.5, w: 6, h: 6,
    fill: { color: C.accent, transparency: 88 }, line: { color: C.accent, width: 0 } });
  s1.addShape(pres.shapes.OVAL, { x: 10, y: 4.5, w: 6, h: 6,
    fill: { color: C.cyan, transparency: 90 }, line: { color: C.cyan, width: 0 } });

  // small slide tag
  s1.addText("01 · THE PROBLEM", {
    x: 0.7, y: 0.55, w: 6, h: 0.35,
    fontFace: "Calibri", fontSize: 11, bold: true, color: C.cyan,
    charSpacing: 5, margin: 0,
  });
  // title
  s1.addText("Every investigation starts with the same wall.", {
    x: 0.7, y: 0.92, w: 11.9, h: 1.0,
    fontFace: "Georgia", fontSize: 36, bold: true, color: C.text,
    margin: 0,
  });
  // subtitle
  s1.addText("Evidence lives in a dozen systems — eDiscovery and corporate investigations burn most of their hours just finding it.", {
    x: 0.7, y: 1.88, w: 11.9, h: 0.7,
    fontFace: "Calibri", fontSize: 15, color: C.muted, margin: 0,
  });

  // 4 problem cards in a 2x2 grid
  const cardW = 5.85, cardH = 1.8;
  const col1 = 0.7, col2 = 7.05;
  const row1 = 2.85, row2 = 4.85;

  card(s1, {
    x: col1, y: row1, w: cardW, h: cardH,
    accent: C.red, iconBg: C.red, icon: icons.puzzle,
    title: "Fragmented sources",
    body: "Fileshares, Email, Slack, CRM, AWS, Azure, Notion — 10+ silos, each with its own UI, vocabulary, and permissions.",
  });
  card(s1, {
    x: col2, y: row1, w: cardW, h: cardH,
    accent: C.amber, iconBg: C.amber, icon: icons.hour,
    title: "Hours of manual hunting",
    body: "Investigators jump tool to tool, grep, export, copy-paste. One question becomes a half-day expedition.",
  });
  card(s1, {
    x: col1, y: row2, w: cardW, h: cardH,
    accent: C.purple, iconBg: C.purple, icon: icons.hide,
    title: "Hidden context",
    body: "A salary in a fileshare, a chat in Slack, a ticket in a CRM — alone they mean nothing; together they tell the story.",
  });
  card(s1, {
    x: col2, y: row2, w: cardW, h: cardH,
    accent: C.cyan, iconBg: C.cyan, icon: icons.sign,
    title: "No defensibility",
    body: "Spreadsheets and screenshots aren't an audit trail. Legal needs to know who searched what, when, with which credentials.",
  });

  // bottom stat strip
  s1.addText("≈ 70% of investigation time is spent finding evidence — not analysing it.", {
    x: 0.7, y: 6.78, w: 11.9, h: 0.42,
    fontFace: "Georgia", fontSize: 14, italic: true, color: C.cyan,
    align: "center", valign: "middle", margin: 0,
  });

  // ---------- SLIDE 2: SOLUTION ----------
  const s2 = pres.addSlide();
  s2.background = { color: C.bg };

  s2.addShape(pres.shapes.OVAL, { x: 9, y: -2.5, w: 7, h: 7,
    fill: { color: C.cyan, transparency: 88 }, line: { color: C.cyan, width: 0 } });
  s2.addShape(pres.shapes.OVAL, { x: -3, y: 4, w: 6, h: 6,
    fill: { color: C.purple, transparency: 90 }, line: { color: C.purple, width: 0 } });

  // tag
  s2.addText("02 · THE SOLUTION", {
    x: 0.7, y: 0.55, w: 6, h: 0.35,
    fontFace: "Calibri", fontSize: 11, bold: true, color: C.cyan,
    charSpacing: 5, margin: 0,
  });
  // title with brand emphasis
  s2.addText([
    { text: "ORBIT", options: { fontFace: "Georgia", fontSize: 38, bold: true, color: C.cyan } },
    { text: " — Ask once. Search everywhere. Cite everything.", options: { fontFace: "Georgia", fontSize: 36, bold: true, color: C.text } },
  ], { x: 0.7, y: 0.92, w: 11.9, h: 1.0, margin: 0 });

  s2.addText("A unified discovery agent that fans your plain-English question across every connector at once and returns a single, fully-cited answer.", {
    x: 0.7, y: 1.88, w: 11.9, h: 0.7,
    fontFace: "Calibri", fontSize: 15, color: C.muted, margin: 0,
  });

  // 4 capability cards (with dark icon-on-bright-circle for variety)
  card(s2, {
    x: col1, y: row1, w: cardW, h: cardH,
    accent: C.cyan, iconBg: C.cyan, icon: icons.search,
    title: "One question, every system",
    body: "Drag connectors into your orbit, ask in plain English. ORBIT plans, fans out in parallel, ranks, and synthesises.",
  });
  card(s2, {
    x: col2, y: row1, w: cardW, h: cardH,
    accent: C.amber, iconBg: C.amber, icon: icons.quote,
    title: "Every claim, cited",
    body: "Each sentence in the answer carries a clickable [source-id] that jumps to the exact document, message, or row.",
  });
  card(s2, {
    x: col1, y: row2, w: cardW, h: cardH,
    accent: C.accent, iconBg: C.accent, icon: icons.plug,
    title: "Real connectors, drag-and-drop",
    body: "Fileshare · Email · Slack · Zoho CRM · Azure Blob — and a roadmap of 20+ more. Multiple instances per type.",
  });
  card(s2, {
    x: col2, y: row2, w: cardW, h: cardH,
    accent: C.purple, iconBg: C.purple, icon: icons.shield,
    title: "Defensible by design",
    body: "Every query, credential snapshot, and result is logged for the audit trail and exportable to CSV or JSON.",
  });

  // bottom workflow strip
  const steps = ["ASK", "PLAN", "FAN-OUT", "SYNTHESISE", "CITE"];
  const flowY = 6.78;
  const flowH = 0.42;
  const flowGap = 0.18;
  const flowTotalW = 11.9;
  const flowW = (flowTotalW - flowGap * (steps.length - 1)) / steps.length;
  steps.forEach((label, i) => {
    const x = 0.7 + i * (flowW + flowGap);
    s2.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y: flowY, w: flowW, h: flowH,
      fill: { color: C.surface }, line: { color: C.border, width: 0.75 },
      rectRadius: 0.18,
    });
    s2.addText(label, {
      x, y: flowY, w: flowW, h: flowH,
      fontFace: "Calibri", fontSize: 12, bold: true, color: C.cyan,
      align: "center", valign: "middle", charSpacing: 4, margin: 0,
    });
  });

  // ---------- save ----------
  const out = path.join(__dirname, "ORBIT-pitch.pptx");
  await pres.writeFile({ fileName: out });
  console.log("WROTE", out);
}

main().catch((e) => { console.error(e); process.exit(1); });
