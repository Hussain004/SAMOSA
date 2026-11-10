/**
 * The landing page.
 *
 * The structure follows the plan: a hero with the ASCII samosa, the agent
 * demo, six feature cards with live mocks, a playful divider, the hall of
 * bugs, five deep dives, the menu, the install tabs and the footer.
 * This file only composes; every section lives in sections/.
 */
import { Header } from './sections/Header.tsx';
import { Hero } from './sections/Hero.tsx';
import { Intro } from './sections/Intro.tsx';
import { AgentDemo } from './sections/AgentDemo.tsx';
import { Tour } from './sections/Tour.tsx';
import { Features } from './sections/Features.tsx';
import { Divider } from './sections/Divider.tsx';
import { HallOfBugs } from './sections/HallOfBugs.tsx';
import { LedgerSection } from './sections/LedgerSection.tsx';
import { DeepDives } from './sections/DeepDives.tsx';
import { MenuSection } from './sections/MenuSection.tsx';
import { Install } from './sections/Install.tsx';
import { Changelog } from './sections/Changelog.tsx';
import { CoverageCurve } from './sections/CoverageCurve.tsx';
import { Footer } from './sections/Footer.tsx';

export function Landing() {
  return (
    <div className="min-h-screen bg-[var(--color-ink)] text-[var(--color-text)]">
      <Header />
      <main>
        <Hero />
        <Intro />
        <AgentDemo />
        <Tour />
        <Features />
        <Divider />
        <HallOfBugs />
        <LedgerSection />
        <DeepDives />
        <MenuSection />
        <Install />
        <Changelog />
        <CoverageCurve />
      </main>
      <Footer />
    </div>
  );
}

