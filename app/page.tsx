import { SceneLoader } from "@/components/SceneLoader";
import { ScrollDriver } from "@/components/ScrollDriver";
import { Header } from "@/components/ui/Header";
import { SocialRail } from "@/components/ui/Socials";
import { Story } from "@/components/ui/Story";
import { FullStory } from "@/components/ui/FullStory";
import { Achievements } from "@/components/ui/Achievements";
import { Footer } from "@/components/ui/Footer";

export default function Home() {
  return (
    <>
      <span id="top" />
      <SceneLoader />
      <Header />
      <SocialRail />
      <Story />
      <FullStory />
      <Achievements />
      <Footer />
      <ScrollDriver />
    </>
  );
}
