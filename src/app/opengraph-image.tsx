import { ImageResponse } from "next/og";

export const alt = "Graphwake, inspect how knowledge changes state";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        position: "relative",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "58px 64px",
        color: "#151719",
        backgroundColor: "#dcebe5",
        backgroundImage:
          "linear-gradient(rgba(21,23,25,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(21,23,25,.12) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 22, letterSpacing: 5 }}>
        <div style={{ display: "flex", position: "relative", width: 54, height: 42 }}>
          <div style={{ position: "absolute", left: 0, top: 4, width: 13, height: 13, border: "3px solid #151719", borderRadius: 20, background: "#16735a" }} />
          <div style={{ position: "absolute", left: 21, top: 26, width: 13, height: 13, border: "3px solid #151719", transform: "rotate(45deg)" }} />
          <div style={{ position: "absolute", right: 0, top: 3, width: 15, height: 15, border: "3px solid #151719", borderRadius: 20, background: "#2b50d6" }} />
        </div>
        GRAPHWAKE
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ color: "#2b50d6", fontSize: 18, letterSpacing: 4 }}>CONTEXT BECOMES INSPECTABLE</span>
          <span style={{ maxWidth: 830, marginTop: 16, fontSize: 92, fontWeight: 700, letterSpacing: -7, lineHeight: 0.88 }}>
            See knowledge change state.
          </span>
        </div>
        <span style={{ color: "#2b50d6", fontFamily: "monospace", fontSize: 26 }}>S0 + e17 → S1</span>
      </div>
    </div>,
    size,
  );
}
