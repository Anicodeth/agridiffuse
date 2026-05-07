import { BlobCharacter } from "@/components/illustrations/BlobCharacter";

export function GraphLegend() {
  const items: Array<{ color: "violet" | "meadow" | "sky" | "flamingo" | "sunburst"; label: string }> = [
    { color: "violet", label: "Expert" },
    { color: "meadow", label: "Adopted farmer" },
    { color: "sky", label: "Reachable farmer" },
    { color: "flamingo", label: "Resistant farmer" },
    { color: "sunburst", label: "Practice" },
  ];

  return (
    <div className="card-inset flex flex-wrap items-center gap-x-4 gap-y-2 rounded-cards px-3 py-2 text-[12px]">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <BlobCharacter color={item.color} size={20} />
          <span className="text-graphite" style={{ letterSpacing: "-0.14px" }}>
            {item.label}
          </span>
        </div>
      ))}
      <div className="bg-stone-surface mx-1 h-3 w-px" />
      <LegendEdge color="#9f4fff" label="recommends" />
      <LegendEdge color="#0090ff" label="advises" dashed />
      <LegendEdge color="#848281" label="knows" />
      <LegendEdge color="#ff3e00" label="adopted (rewarded)" />
      <LegendEdge color="#00ca48" label="adopted (peer)" />
    </div>
  );
}

function LegendEdge({ color, label, dashed = false }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <svg width="20" height="6" aria-hidden>
        <line
          x1="0"
          y1="3"
          x2="20"
          y2="3"
          stroke={color}
          strokeWidth="2"
          strokeDasharray={dashed ? "3 2" : undefined}
        />
      </svg>
      <span className="text-graphite text-[12px]" style={{ letterSpacing: "-0.14px" }}>
        {label}
      </span>
    </div>
  );
}
