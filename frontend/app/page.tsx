import { Hero } from "@/components/Hero";
import { StatsSection } from "@/components/StatsSection";
import { FeaturesSection } from "@/components/FeaturesSection";
import { HowItWorks } from "@/components/HowItWorks";
import { CTASection } from "@/components/CTASection";
import { FooterSection } from "@/components/FooterSection";

export default function HomePage() {
  return (
    <main className="flex flex-col min-h-screen bg-[#050505]">
      <Hero />
      <StatsSection />
      <FeaturesSection />
      <HowItWorks />
      <CTASection />
      <FooterSection />
    </main>
  );
}
