import { useCurrentFrame, interpolate, Easing } from "remotion";
import { BrowserFrame } from "../BrowserFrame";
import { Caption } from "../Caption";
import { colors } from "../theme";

export const Scene5Claim: React.FC = () => {
  const frame = useCurrentFrame();
  const claimed = frame > 150;
  const buttonPress = interpolate(frame, [140, 152], [1, 0.94], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const checkOpacity = interpolate(frame, [155, 175], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <BrowserFrame url="eclipse-private-payroll.netlify.app/employee">
      <h1 style={{ fontSize: 44, margin: "0 0 8px", color: colors.fg }}>Employee</h1>
      <p style={{ fontSize: 22, color: colors.muted, marginBottom: 32 }}>
        Prove you're owed your committed amount — without ever stating it.
      </p>

      <div
        style={{
          border: `1px solid ${colors.line}`,
          borderRadius: 8,
          backgroundColor: colors.bg1,
          padding: 28,
          maxWidth: 560,
        }}
      >
        <div style={{ fontFamily: "monospace", fontSize: 20, color: colors.muted }}>
          Slot 1 · addr1q8m…2c91
        </div>
        <div style={{ fontSize: 22, color: colors.fg, marginTop: 10 }}>
          Commitment: <span style={{ fontFamily: "monospace" }}>8f2a…c19e</span>
        </div>

        <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 20 }}>
          <button
            style={{
              scale: buttonPress,
              backgroundColor: claimed ? colors.ok : colors.accent,
              color: colors.bg0,
              border: "none",
              borderRadius: 8,
              padding: "16px 32px",
              fontSize: 26,
              fontWeight: 600,
              fontFamily: "inherit",
            }}
          >
            {claimed ? "Claimed" : "Claim"}
          </button>
          {claimed ? (
            <span style={{ fontSize: 26, color: colors.ok, opacity: checkOpacity }}>
              ✓ proof accepted
            </span>
          ) : null}
        </div>

        {claimed ? (
          <div
            style={{
              marginTop: 20,
              fontSize: 20,
              color: colors.accent,
              opacity: checkOpacity,
            }}
          >
            Amount: never displayed. Never was.
          </div>
        ) : null}
      </div>

      <Caption>
        Claim succeeds — and the amount is never displayed. This is the beat the L2 video
        couldn't show.
      </Caption>
    </BrowserFrame>
  );
};
