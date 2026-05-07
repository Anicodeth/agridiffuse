import { PillButton } from "@/components/ui/PillButton";
import { Card, CardBody, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { BlobCharacter, Coin, StarShape, Sprout } from "@/components/illustrations/BlobCharacter";

export default function LandingPage() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-6">
      <Hero />
      <Features />
      <HowItWorks />
      <FinalCta />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative pt-20 pb-32">
      {/* Floating illustration cluster */}
      <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
        <BlobCharacter color="ember" size={92} className="anim-bob absolute top-12 left-2" />
        <BlobCharacter
          color="meadow"
          size={108}
          mood="wink"
          className="anim-bob-slow absolute top-32 right-6"
        />
        <BlobCharacter color="sky" size={76} className="anim-bob absolute right-32 bottom-32" />
        <BlobCharacter
          color="sunburst"
          size={84}
          mood="surprised"
          className="anim-bob-slow absolute bottom-12 left-32"
        />
        <Coin size={56} className="anim-spin-slow absolute top-44 left-44" />
        <Coin size={44} className="anim-spin-slow absolute right-44 bottom-48" />
        <StarShape size={36} className="anim-pulse-soft absolute top-24 right-1/3" />
        <Sprout size={68} className="absolute bottom-8 right-1/4" />
      </div>

      <div className="relative z-10 mx-auto max-w-[760px] text-center">
        <Badge tone="ember" className="mb-6">
          v2 · narrative + agent economy
        </Badge>
        <h1
          className="font-display text-charcoal"
          style={{ fontSize: "clamp(44px, 8vw, 68px)", letterSpacing: "-2.11px" }}
        >
          Knowledge spreads.
          <br />
          <span className="text-ember">Rewards flow back.</span>
        </h1>
        <p
          className="text-graphite mx-auto mt-6 max-w-[520px]"
          style={{ fontSize: "17px", letterSpacing: "-0.22px", lineHeight: 1.47 }}
        >
          AgriDiffuse models how agricultural practices move through a network of experts and farmers — like an
          epidemiological spread, but for ideas. Same graph, three views: structural, narrative, economic.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3">
          <PillButton href="/graph" variant="dark" size="lg">
            Open the graph
          </PillButton>
          <PillButton href="/simulate" variant="light" size="lg">
            Run a round →
          </PillButton>
        </div>
        <p className="text-ash mt-6 text-[13px]">
          Neo4j · Featherless.ai · Masumi.network · Lovable
        </p>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    {
      tone: "ember" as const,
      title: "Structural",
      body: "Three node types, four edge types. Practices move along ADVISES and KNOWS edges; trust weight decides who picks them up.",
      icon: <BlobCharacter color="ember" size={64} />,
    },
    {
      tone: "meadow" as const,
      title: "Narrative",
      body: "Featherless.ai turns each round into a paragraph. One LLM call per round — structured graph events become plain language.",
      icon: <BlobCharacter color="meadow" size={64} mood="wink" />,
    },
    {
      tone: "sky" as const,
      title: "Economic",
      body: "Masumi.network gives experts agent identities. Every adoption with a traceable expert ancestor pays a reward — direct adoption pays 1×, each hop halves it.",
      icon: <BlobCharacter color="sky" size={64} />,
    },
  ];

  return (
    <section className="py-24">
      <div className="mb-12 max-w-[640px]">
        <h2
          className="font-heading-lg text-midnight"
          style={{ fontSize: "44px", letterSpacing: "-1.14px" }}
        >
          The graph carries the story.
        </h2>
        <p className="text-graphite mt-4 text-[17px]" style={{ letterSpacing: "-0.22px" }}>
          One network, three lenses. Each round emits structured events that flow through three layers — what
          happened, what it means, and who got paid.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {items.map((item) => (
          <Card key={item.title}>
            <div className="card-recessed mb-6 flex h-32 items-center justify-center rounded-[12px]">
              {item.icon}
            </div>
            <Badge tone={item.tone} className="mb-3">
              {item.title}
            </Badge>
            <CardTitle className="mb-2">
              {item.title === "Structural"
                ? "Watch the spread."
                : item.title === "Narrative"
                  ? "Hear the story."
                  : "See the value."}
            </CardTitle>
            <CardBody>{item.body}</CardBody>
          </Card>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      label: "Spread",
      body: "Trust-weighted propagation. A farmer's adoption probability = expert credibility × farmer base rate × edge trust.",
    },
    {
      n: "02",
      label: "Trace",
      body: "Every new adoption walks back to its closest expert ancestor along RECOMMENDS · ADOPTED · KNOWS*.",
    },
    {
      n: "03",
      label: "Reward",
      body: "Masumi pays the expert. Direct adoption = 1×. Each peer hop halves the reward, mirroring influence decay.",
    },
    {
      n: "04",
      label: "Narrate",
      body: "Featherless gets a structured event log — returns one paragraph for the simulator's narrative box.",
    },
  ];

  return (
    <section className="py-24">
      <div className="card-recessed grid grid-cols-1 gap-px overflow-hidden rounded-[24px] md:grid-cols-4">
        {steps.map((step, i) => (
          <div
            key={step.n}
            className="bg-warm-canvas p-8"
            style={{
              boxShadow: i === 0 ? "none" : "inset 1px 0 0 var(--color-stone-surface)",
            }}
          >
            <div className="text-ember mb-2 text-[13px] font-medium" style={{ letterSpacing: "-0.17px" }}>
              {step.n}
            </div>
            <div
              className="text-charcoal mb-2 font-medium"
              style={{ fontSize: "19px", letterSpacing: "-0.25px" }}
            >
              {step.label}
            </div>
            <p className="text-graphite text-[14px]" style={{ letterSpacing: "-0.18px", lineHeight: 1.5 }}>
              {step.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative py-32 text-center">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <BlobCharacter color="flamingo" size={64} className="anim-bob absolute top-8 left-1/4" />
        <BlobCharacter
          color="violet"
          size={72}
          mood="wink"
          className="anim-bob-slow absolute top-12 right-1/4"
        />
      </div>
      <h2
        className="font-display text-charcoal relative z-10"
        style={{ fontSize: "clamp(36px, 6vw, 56px)", letterSpacing: "-1.6px" }}
      >
        Ready to see knowledge move?
      </h2>
      <div className="relative z-10 mt-8 flex justify-center gap-3">
        <PillButton href="/graph" variant="dark" size="lg">
          Open the demo
        </PillButton>
      </div>
    </section>
  );
}
