import { useCurrentFrame, interpolate, Easing } from "remotion";
import { colors, fontStack } from "./theme";

export const Caption: React.FC<{ children: React.ReactNode; delay?: number }> = ({
  children,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [delay, delay + 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const translateY = interpolate(frame, [delay, delay + 15], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <div
      style={{
        position: "absolute",
        bottom: 36,
        left: 48,
        right: 48,
        opacity,
        translate: `0px ${translateY}px`,
        fontFamily: fontStack,
        fontSize: 30,
        lineHeight: 1.4,
        color: colors.fg,
        backgroundColor: "rgba(20,32,26,0.92)",
        border: `1px solid ${colors.line}`,
        borderRadius: 10,
        padding: "18px 26px",
      }}
    >
      {children}
    </div>
  );
};
