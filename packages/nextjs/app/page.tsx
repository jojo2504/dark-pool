import { CTASection } from "~~/components/darkpool/CTASection";
import { FeaturesSection } from "~~/components/darkpool/FeaturesSection";
import { Hero } from "~~/components/darkpool/Hero";
import { HowItWorks } from "~~/components/darkpool/HowItWorks";
import { StatsSection } from "~~/components/darkpool/StatsSection";

export default function HomePage() {
  return (
    <main className="flex flex-col min-h-screen bg-black">
      <Hero />
      <StatsSection />
      <FeaturesSection />
      <HowItWorks />
      <CTASection />
    </main>
  );
}
