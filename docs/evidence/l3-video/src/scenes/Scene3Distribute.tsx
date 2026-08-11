import { useCurrentFrame, interpolate, Easing } from "remotion";
import { BrowserFrame } from "../BrowserFrame";
import { Caption } from "../Caption";
import { colors } from "../theme";

const COMMITMENTS = [
  "8f2a…c19e",
  "3b7d…4a02",
  "e610…9f5c",
];

export const Scene3Distribute: React.FC = () => {
  const frame = useCurrentFrame();
  const proving = frame < 140;
  const scaleIn = interpolate(frame, [140, 165], [0.92, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const successOpacity = interpolate(frame, [140, 160], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <BrowserFrame url="eclipse-private-payroll.netlify.app/employer">
      <h1 style={{ fontSize: 44, margin: "0 0 24px", color: colors.fg }}>Employer</h1>

      {proving ? (
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Spinner frame={frame} />
          <span style={{ fontSize: 30, color: colors.accent }}>
            Proving &amp; distributing…
          </span>
        </div>
      ) : (
        <div style={{ opacity: successOpacity, scale: scaleIn, transformOrigin: "left top" }}>
          <p style={{ fontSize: 30, color: colors.ok, marginBottom: 24 }}>
            Distributed. Private amounts cleared from this view.
          </p>
          <div
            style={{
              border: `1px solid ${colors.line}`,
              borderRadius: 8,
              backgroundColor: colors.bg1,
              padding: 24,
              fontSize: 22,
            }}
          >
            <div style={{ color: colors.muted }}>
              Status: <span style={{ color: colors.fg }}>Distributed</span>
            </div>
            <div style={{ color: colors.muted, marginTop: 6 }}>
              Deposit total: <span style={{ color: colors.fg }}>1000</span>
            </div>
            <div style={{ color: colors.muted, marginTop: 18 }}>
              Commitments (public, opaque)
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                marginTop: 8,
                fontFamily: "monospace",
                fontSize: 18,
              }}
            >
              {COMMITMENTS.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      <Caption>
        Status flips to Distributed, opaque commitments are listed, and the amount inputs are
        gone from the form.
      </Caption>
    </BrowserFrame>
  );
};

const Spinner: React.FC<{ frame: number }> = ({ frame }) => (
  <div
    style={{
      width: 32,
      height: 32,
      borderRadius: "50%",
      border: `4px solid ${colors.line}`,
      borderTopColor: colors.accent,
      rotate: `${(frame * 12) % 360}deg`,
    }}
  />
);
