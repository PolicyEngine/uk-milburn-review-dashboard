// Draws public/assets/milburn-review-og.png, the page's Open Graph and
// Twitter card image (src/app/layout.tsx), once: bun scripts/og-image.jsx
// public/assets/milburn-review-og.png. Colours from the chart theme.
import { ImageResponse } from "next/og";
import { writeFileSync } from "node:fs";
import { CHART_COLOURS } from "../src/utils/chartTheme.js";
const C = CHART_COLOURS;
const res = new ImageResponse(
  <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "72px 80px", background: C.surface, borderTop: `24px solid ${C.gain}` }}>
    <div style={{ display: "flex", fontSize: 36, color: C.gainText }}>PolicyEngine UK</div>
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", fontSize: 76, lineHeight: 1.1, color: C.ink }}>Milburn review: young people and work</div>
      <div style={{ display: "flex", marginTop: 28, fontSize: 34, lineHeight: 1.35, color: C.text }}>How the final report's tax and benefit measures change the public finances and household incomes, by age</div>
    </div>
  </div>,
  { width: 1200, height: 630 },
);
writeFileSync(process.argv[2], Buffer.from(await res.arrayBuffer()));
