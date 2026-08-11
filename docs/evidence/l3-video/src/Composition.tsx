import { AbsoluteFill, Composition, Sequence } from "remotion";
import { Scene1Connect } from "./scenes/Scene1Connect";
import { Scene2Split } from "./scenes/Scene2Split";
import { Scene3Distribute } from "./scenes/Scene3Distribute";
import { Scene4Observer } from "./scenes/Scene4Observer";
import { Scene5Claim } from "./scenes/Scene5Claim";
import { Scene6ProofLands } from "./scenes/Scene6ProofLands";

// Beat timing mirrors docs/evidence/l3-demo-storyboard.md exactly (60s @ 30fps = 1800 frames).
const BEATS = [
  { from: 0, duration: 240, Scene: Scene1Connect }, // 0:00–0:08 connect
  { from: 240, duration: 420, Scene: Scene2Split }, // 0:08–0:22 private split
  { from: 660, duration: 360, Scene: Scene3Distribute }, // 0:22–0:34 distribute
  { from: 1020, duration: 300, Scene: Scene4Observer }, // 0:34–0:44 observer
  { from: 1320, duration: 360, Scene: Scene5Claim }, // 0:44–0:56 claim
  { from: 1680, duration: 120, Scene: Scene6ProofLands }, // 0:56–1:00 proof lands
] as const;

const TOTAL_FRAMES = 1800;

export const EclipseL3Demo: React.FC = () => {
  return (
    <AbsoluteFill>
      {BEATS.map(({ from, duration, Scene }, i) => (
        <Sequence key={i} from={from} durationInFrames={duration}>
          <Scene />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const RootComposition = () => {
  return (
    <Composition
      id="eclipse-l3-demo"
      component={EclipseL3Demo}
      durationInFrames={TOTAL_FRAMES}
      fps={30}
      width={1280}
      height={720}
    />
  );
};
