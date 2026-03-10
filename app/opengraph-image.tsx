import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Grant Base — Find Government Grants for Your Australian Business";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0F7B6C 0%, #0a5c51 60%, #1A1A2E 100%)",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "80px",
        }}
      >
        {/* Logo text */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 40 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: "rgba(255,255,255,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 32,
          }}>💰</div>
          <span style={{ fontSize: 42, fontWeight: 800, color: "#fff", letterSpacing: "-1px" }}>
            Grant Base
          </span>
        </div>

        {/* Headline */}
        <div style={{
          fontSize: 58,
          fontWeight: 800,
          color: "#fff",
          textAlign: "center",
          lineHeight: 1.15,
          letterSpacing: "-1.5px",
          marginBottom: 24,
          maxWidth: 900,
        }}>
          Find government grants for your Australian business
        </div>

        {/* Subheading */}
        <div style={{
          fontSize: 26,
          color: "rgba(255,255,255,0.75)",
          textAlign: "center",
          maxWidth: 700,
          marginBottom: 48,
        }}>
          Smart matching · Weekly alerts · AI-drafted applications
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 48 }}>
          {[["4,000+", "Grants tracked"], ["$90B+", "Available annually"], ["5 min", "To find matches"]].map(([num, label]) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: "#D4A853" }}>{num}</span>
              <span style={{ fontSize: 16, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
