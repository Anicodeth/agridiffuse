import type { Metadata } from "next";
import { CypherExplorer } from "@/features/neo4j/components/CypherExplorer";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = { title: "Neo4j explorer" };

export default function Neo4jPage() {
  const live = Boolean(process.env.NEO4J_URI);
  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 py-12">
      <header className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Badge tone={live ? "meadow" : "flamingo"}>
              {live ? "live · neo4j" : "neo4j off"}
            </Badge>
            {live ? (
              <code className="text-ash text-[12px]">{maskUri(process.env.NEO4J_URI!)}</code>
            ) : null}
          </div>
          <h1
            className="font-heading-lg text-midnight"
            style={{ fontSize: "44px", letterSpacing: "-1.14px" }}
          >
            Cypher <span className="text-ember">explorer.</span>
          </h1>
          <p
            className="text-graphite mt-2 max-w-[640px]"
            style={{ fontSize: "17px", letterSpacing: "-0.22px" }}
          >
            The same Bolt connection the simulator writes to, exposed as a tiny query playground.
            Each preset is a real Cypher query — run it, see the rows or the subgraph that came back,
            and the wire latency it took.
          </p>
        </div>
      </header>

      <CypherExplorer />
    </div>
  );
}

function maskUri(uri: string): string {
  // neo4j+s://78ecb86d.databases.neo4j.io → neo4j+s://78ecb86d…neo4j.io
  try {
    const u = new URL(uri);
    const host = u.hostname;
    const head = host.slice(0, 8);
    const tail = host.split(".").slice(-2).join(".");
    return `${u.protocol}//${head}…${tail}`;
  } catch {
    return uri;
  }
}
