import { AbsoluteFill } from "remotion";
import { colors, fontStack } from "./theme";

export const BrowserFrame: React.FC<{
  url: string;
  children: React.ReactNode;
}> = ({ url, children }) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg0,
        fontFamily: fontStack,
        padding: 48,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          borderRadius: 14,
          overflow: "hidden",
          border: `1px solid ${colors.line}`,
          boxShadow: "0 40px 120px rgba(0,0,0,0.55)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "16px 24px",
            backgroundColor: colors.bg1,
            borderBottom: `1px solid ${colors.line}`,
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <Dot color="#e5675f" />
            <Dot color="#e6b350" />
            <Dot color="#63c368" />
          </div>
          <div
            style={{
              flex: 1,
              backgroundColor: colors.bg0,
              border: `1px solid ${colors.line}`,
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: 20,
              color: colors.muted,
            }}
          >
            {url}
          </div>
        </div>
        <div
          style={{
            flex: 1,
            backgroundColor: colors.bg0,
            color: colors.fg,
            padding: "36px 56px 176px",
            display: "flex",
            flexDirection: "column",
            position: "relative",
          }}
        >
          {children}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Dot: React.FC<{ color: string }> = ({ color }) => (
  <div
    style={{
      width: 14,
      height: 14,
      borderRadius: "50%",
      backgroundColor: color,
    }}
  />
);
