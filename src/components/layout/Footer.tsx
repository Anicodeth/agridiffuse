export function Footer() {
  return (
    <footer className="border-t border-stone-surface mt-32 py-12">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-6 md:flex-row md:items-center md:justify-between">
        <p className="text-fog text-[13px]" style={{ letterSpacing: "-0.17px" }}>
          AgriDiffuse — knowledge spread + agent economy. Built on Neo4j, Featherless.ai, Masumi.network.
        </p>
        <div className="text-ash flex gap-6 text-[13px]">
          <a href="https://neo4j.com" target="_blank" rel="noreferrer" className="hover:text-charcoal">
            Neo4j
          </a>
          <a
            href="https://featherless.ai"
            target="_blank"
            rel="noreferrer"
            className="hover:text-charcoal"
          >
            Featherless
          </a>
          <a
            href="https://masumi.network"
            target="_blank"
            rel="noreferrer"
            className="hover:text-charcoal"
          >
            Masumi
          </a>
        </div>
      </div>
    </footer>
  );
}
