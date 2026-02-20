import { Hero } from "~~/components/darkpool/Hero";
import { StatsSection } from "~~/components/darkpool/StatsSection";
import { FeaturesSection } from "~~/components/darkpool/FeaturesSection";
import { HowItWorks } from "~~/components/darkpool/HowItWorks";
import { CTASection } from "~~/components/darkpool/CTASection";

export default function HomePage() {
  return (
    <main className="flex flex-col min-h-screen bg-[#050505]">
      <Hero />
      <StatsSection />
      <FeaturesSection />
      <HowItWorks />
      <CTASection />
    </main>
  );
}
