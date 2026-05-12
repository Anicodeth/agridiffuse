"use client";

import type { DragEvent } from "react";
import { BlobCharacter, Sprout } from "@/components/illustrations/BlobCharacter";
import type { PaletteKind } from "@/stores/graphStore";

/**
 * Build-mode palette. Each tile is HTML5-draggable; the GraphCanvas's
 * onDrop handler reads the kind via DataTransfer to know what to create.
 *
 * The dataTransfer key is intentionally namespaced so a stray drop from
 * elsewhere on the page (an image, a link) doesn't get misread as a tile.
 */

export const PALETTE_DRAG_TYPE = "application/x-agridiffuse-palette";

interface PaletteTileSpec {
  kind: PaletteKind;
  label: string;
  hint: string;
  icon: () => React.ReactNode;
}

const TILES: PaletteTileSpec[] = [
  {
    kind: "farmer",
    label: "Farmer",
    hint: "Drag onto canvas",
    icon: () => <BlobCharacter color="sky" size={42} />,
  },
  {
    kind: "expert",
    label: "Expert",
    hint: "Drag onto canvas",
    icon: () => <BlobCharacter color="violet" size={42} />,
  },
  {
    kind: "practice",
    label: "Practice",
    hint: "Drag onto canvas",
    icon: () => <Sprout size={42} />,
  },
];

export function NodePalette() {
  return (
    <div className="card-inset rounded-cards p-3 w-[200px]">
      <div
        className="text-ash mb-3 px-1 text-[11px] font-medium uppercase"
        style={{ letterSpacing: "0.04em" }}
      >
        Drag onto canvas
      </div>
      <div className="space-y-2">
        {TILES.map((t) => (
          <PaletteTile key={t.kind} spec={t} />
        ))}
      </div>
      <p
        className="text-ash mt-3 px-1 text-[11px] leading-snug"
        style={{ letterSpacing: "-0.12px" }}
      >
        Then drag from one node&apos;s edge to another to connect them. Edge type is
        inferred from the labels.
      </p>
    </div>
  );
}

function PaletteTile({ spec }: { spec: PaletteTileSpec }) {
  const onDragStart = (e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData(PALETTE_DRAG_TYPE, spec.kind);
    e.dataTransfer.effectAllowed = "copy";
  };
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="bg-warm-canvas hover:bg-stone-surface rounded-cards flex cursor-grab items-center gap-3 px-2.5 py-2 transition active:cursor-grabbing"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center">{spec.icon()}</div>
      <div className="min-w-0">
        <div
          className="text-charcoal font-medium"
          style={{ fontSize: "13px", letterSpacing: "-0.17px" }}
        >
          {spec.label}
        </div>
        <div className="text-ash text-[11px]" style={{ letterSpacing: "-0.12px" }}>
          {spec.hint}
        </div>
      </div>
    </div>
  );
}
