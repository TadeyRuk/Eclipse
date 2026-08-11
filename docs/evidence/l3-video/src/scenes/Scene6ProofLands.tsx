import { useCurrentFrame, interpolate, Easing } from "remotion";
import { BrowserFrame } from "../BrowserFrame";
import { colors } from "../theme";

const ROWS = [
  ["Status", "Distributed"],
  ["Deposit total", "1000"],
  ["Recipient 1", "addr1q8m…2c91"],
  ["Recipient 2", "addr1q7k…88bd"],
  ["Recipient 3", "addr1q3n…f102"],
  ["Amount 1", "—"],
  ["Amount 2", "—"],
  ["Amount 3", "—"],
  ["Claimed 1", "true"],
  ["Claimed 2", "false"],
  ["Claimed 3", "false"],
];

export const Scene6ProofLands: React.FC = () => {
  const frame = useCurrentFrame();
  const lineOpacity = interpolate(frame, [40, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <BrowserFrame url="eclipse-private-payroll.netlify.app/observer">
      <h1 style={{ fontSize: 44, margin: "0 0 8px", color: colors.fg }}>Observer</h1>
      <p style={{ fontSize: 22, color: colors.muted, marginBottom: 28 }}>
        Refreshed after the claim.
      </p>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          fontFamily: "monospace",
          fontSize: 22,
        }}
      >
        {ROWS.map(([label, value]) => {
          const isClaimedRow = label === "Claimed 1";
          return (
            <div
              key={label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                borderBottom: `1px solid ${colors.line}`,
                paddingBottom: 8,
                backgroundColor: isClaimedRow
                  ? `rgba(111,191,141,${lineOpacity * 0.12})`
                  : "transparent",
              }}
            >
              <span style={{ color: colors.muted }}>{label}</span>
              <span
                style={{
                  color: value === "—" ? colors.accent : isClaimedRow ? colors.ok : colors.fg,
                  fontWeight: value === "—" || isClaimedRow ? 700 : 400,
                }}
              >
                {value}
              </span>
            </div>
          );
        })}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 36,
          left: 48,
          right: 48,
          opacity: lineOpacity,
          fontSize: 30,
          lineHeight: 1.4,
          color: colors.fg,
          backgroundColor: "rgba(20,32,26,0.92)",
          border: `1px solid ${colors.line}`,
          borderRadius: 10,
          padding: "18px 26px",
          fontStyle: "italic",
        }}
      >
        "The chain now knows the payroll balanced and that this recipient claimed their share.
        It has never known, and cannot compute, what that share was."
      </div>
    </BrowserFrame>
  );
};
