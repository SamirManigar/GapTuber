import Navbar from "@/components/Navbar";
import Hero from "@/components/landing/Hero";
import ProblemSection from "@/components/landing/ProblemSection";
import HowItWorks from "@/components/landing/HowItWorks";
import SampleOutput from "@/components/landing/SampleOutput";
import WhySection from "@/components/landing/WhySection";
import SocialProof from "@/components/landing/SocialProof";
import FinalCta from "@/components/landing/FinalCta";
import Footer from "@/components/landing/Footer";

export default function HomePage() {
  return (
    <main>
      <Navbar />
      <Hero />
      <WhySection />
      <ProblemSection />
      <HowItWorks />
      <SampleOutput />
      <SocialProof />
      <FinalCta />
      <Footer />
    </main>
  );
}
