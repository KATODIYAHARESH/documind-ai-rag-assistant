import { getSessionUser } from "@/lib/auth";
import { Ambient } from "@/components/ambient";
import { Navbar } from "@/components/marketing/navbar";
import { Hero } from "@/components/marketing/hero";
import { Features, HowItWorks, RagSection, Stack, Why } from "@/components/marketing/sections";
import { Footer } from "@/components/marketing/footer";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const user = await getSessionUser();
  const authenticated = Boolean(user);

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <Ambient intensity="strong" />
      <Navbar authenticated={authenticated} />
      <main>
        <Hero authenticated={authenticated} />
        <HowItWorks />
        <Features />
        <RagSection />
        <Why />
        <Stack />
      </main>
      <Footer />
    </div>
  );
}
