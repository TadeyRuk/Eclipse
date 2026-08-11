import { useCurrentFrame, interpolate, Easing } from "remotion";
import { BrowserFrame } from "../BrowserFrame";
import { Caption } from "../Caption";
import { colors } from "../theme";

export const Scene1Connect: React.FC = () => {
  const frame = useCurrentFrame();
  const connected = frame > 90;
  const buttonPress = interpolate(frame, [80, 92], [1, 0.94], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const labelOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <BrowserFrame url="eclipse-private-payroll.netlify.app/employer">
      <div
        style={{
          opacity: labelOpacity,
          fontSize: 22,
          color: colors.accent,
          letterSpacing: 2,
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        Illustrated walkthrough — recreated from docs/evidence/l3-demo-storyboard.md
      </div>
      <h1 style={{ fontSize: 46, margin: "6px 0 4px", color: colors.fg }}>Employer</h1>
      <p style={{ fontSize: 22, color: colors.muted, marginBottom: 24 }}>
        Create → fund → distribute. Individual amounts stay private; only status and
        commitments become public.
      </p>

      <div
        style={{
          display: "flex",
          gap: 24,
          fontSize: 18,
          textTransform: "uppercase",
          letterSpacing: 1.5,
          color: colors.muted,
          marginBottom: 28,
        }}
      >
        <span style={{ color: colors.accent }}>recipients</span>
        <span>deposit</span>
        <span>amounts</span>
        <span>prove</span>
      </div>

      <button
        style={{
          alignSelf: "flex-start",
          scale: buttonPress,
          backgroundColor: connected ? colors.ok : colors.accent,
          color: colors.bg0,
          border: "none",
          borderRadius: 8,
          padding: "18px 36px",
          fontSize: 28,
          fontWeight: 600,
          fontFamily: "inherit",
        }}
      >
        {connected ? "Connected — Preprod" : "Connect Lace"}
      </button>

      {connected ? (
        <div
          style={{
            marginTop: 24,
            fontSize: 22,
            color: colors.muted,
            fontFamily: "monospace",
          }}
        >
          addr1q9x…f47a3d
        </div>
      ) : null}

      <Caption>Connect Lace on Preprod — the wallet address appears in the shell.</Caption>
    </BrowserFrame>
  );
};
