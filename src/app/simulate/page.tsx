import type { Metadata } from "next";
import { SimulatorPanel } from "@/features/simulator/components/SimulatorPanel";

export const metadata: Metadata = { title: "Spread simulator" };

export default function SimulatePage() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 py-12">
      <header className="mb-8">
        <h1
          className="font-heading-lg text-midnight"
          style={{ fontSize: "44px", letterSpacing: "-1.14px" }}
        >
          Run a <span className="text-ember">round.</span>
        </h1>
        <p
          className="text-graphite mt-2 max-w-[640px]"
          style={{ fontSize: "17px", letterSpacing: "-0.22px" }}
        >
          Each press steps the simulation forward. New adoptions light up, the narrator translates the
          graph diff into language, and Masumi pays the experts whose advice landed.
        </p>
      </header>

      <SimulatorPanel />
    </div>
  );
}
