import { useCurrentFrame, interpolate } from "remotion";
import { BrowserFrame } from "../BrowserFrame";
import { Caption } from "../Caption";
import { colors } from "../theme";

const RECIPIENTS = ["addr1q8m…2c91", "addr1q7k…88bd", "addr1q3n…f102"];
const AMOUNTS = ["420", "310", "270"];

export const Scene2Split: React.FC = () => {
  const frame = useCurrentFrame();
  const showRecipients = frame > 10;
  const showDeposit = frame > 160;
  const showAmounts = frame > 260;

  const typedAmount = (i: number) => {
    const start = 280 + i * 40;
    const chars = Math.floor(
      interpolate(frame, [start, start + 24], [0, AMOUNTS[i].length], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    );
    return AMOUNTS[i].slice(0, chars);
  };

  return (
    <BrowserFrame url="eclipse-private-payroll.netlify.app/employer">
      <h1 style={{ fontSize: 40, margin: "0 0 16px", color: colors.fg }}>Employer</h1>

      {showRecipients ? (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 18, color: colors.muted, marginBottom: 6 }}>
            Recipients (public)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {RECIPIENTS.map((r, i) => (
              <div
                key={r}
                style={{
                  fontFamily: "monospace",
                  fontSize: 19,
                  color: colors.fg,
                  border: `1px solid ${colors.line}`,
                  borderRadius: 6,
                  padding: "7px 12px",
                  backgroundColor: colors.bg1,
                }}
              >
                {r}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {showDeposit ? (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 18, color: colors.muted, marginBottom: 6 }}>
            Deposit total (public)
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 24,
                color: colors.accent,
                border: `1px solid ${colors.line}`,
                borderRadius: 6,
                padding: "7px 12px",
                backgroundColor: colors.bg1,
                width: "fit-content",
              }}
            >
              1000 tNIGHT
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: colors.bg1,
                backgroundColor: colors.accent,
                borderRadius: 999,
                padding: "8px 20px",
              }}
            >
              Deposit tNIGHT
            </div>
          </div>
        </div>
      ) : null}

      {showAmounts ? (
        <div>
          <div style={{ fontSize: 18, color: colors.muted, marginBottom: 6 }}>
            Private amounts — sum must equal 1000
          </div>
          <div style={{ display: "flex", gap: 14 }}>
            {AMOUNTS.map((_, i) => (
              <div
                key={i}
                style={{
                  fontFamily: "monospace",
                  fontSize: 22,
                  color: colors.fg,
                  border: `1px solid ${colors.accent}`,
                  borderRadius: 6,
                  padding: "8px 18px",
                  backgroundColor: colors.bg1,
                  minWidth: 80,
                }}
              >
                {typedAmount(i)}
                <span style={{ opacity: frame % 20 < 10 ? 1 : 0 }}>|</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <Caption>
        Three recipients (N≥3 — below that, the split is inferable). Deposit real tNIGHT —
        the total is public — then enter private amounts summing to it.
      </Caption>
    </BrowserFrame>
  );
};
