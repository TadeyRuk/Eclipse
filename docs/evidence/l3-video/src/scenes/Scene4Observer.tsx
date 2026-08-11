import { useCurrentFrame, interpolate } from "remotion";
import { BrowserFrame } from "../BrowserFrame";
import { Caption } from "../Caption";
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
  ["Claimed 1", "false"],
  ["Claimed 2", "false"],
  ["Claimed 3", "false"],
];

export const Scene4Observer: React.FC = () => {
  const frame = useCurrentFrame();
  const rowsVisible = Math.floor(
    interpolate(frame, [10, 130], [0, ROWS.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  return (
    <BrowserFrame url="eclipse-private-payroll.netlify.app/observer">
      <h1 style={{ fontSize: 44, margin: "0 0 8px", color: colors.fg }}>Observer</h1>
      <p style={{ fontSize: 22, color: colors.muted, marginBottom: 28 }}>
        Public ledger only — no amount fields exist in this route.
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
        {ROWS.slice(0, rowsVisible).map(([label, value]) => (
          <div
            key={label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              borderBottom: `1px solid ${colors.line}`,
              paddingBottom: 8,
            }}
          >
            <span style={{ color: colors.muted }}>{label}</span>
            <span
              style={{
                color: value === "—" ? colors.accent : colors.fg,
                fontWeight: value === "—" ? 700 : 400,
              }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>

      <Caption>
        No per-recipient amount exists anywhere in this view — not hidden, never written.
      </Caption>
    </BrowserFrame>
  );
};
