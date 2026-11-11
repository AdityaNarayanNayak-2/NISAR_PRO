import { Composition } from "remotion";
import { Intro, TOTAL } from "./Intro";

export const Root = () => (
  <>
    <Composition id="Intro" component={Intro} durationInFrames={TOTAL} fps={30} width={1920} height={1080} />
    <Composition id="IntroSquare" component={Intro} durationInFrames={TOTAL} fps={30} width={1080} height={1080} />
  </>
);
