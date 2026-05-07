/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EventLog } from "./EventLog";
import * as fx from "../../../../tests/fixtures/graph";
import type { GraphNode, RoundResult } from "@/lib/graph/types";

const nodes: GraphNode[] = [
  fx.expert({ id: "e_a", name: "Dr. Test" }),
  fx.farmer({ id: "f1", name: "Wanjiru" }),
  fx.farmer({ id: "f2", name: "Kamau" }),
  fx.practice({ id: "p1", name: "Drip irrigation" }),
];

describe("EventLog", () => {
  it("shows an empty-state hint when result is null", () => {
    render(<EventLog result={null} nodes={nodes} />);
    expect(screen.getByText(/Event log will populate/)).toBeInTheDocument();
  });

  it("renders the round number in the header", () => {
    const result: RoundResult = {
      round: 4,
      events: [],
      newAdoptions: 0,
      blockedAttempts: 0,
      totalRewardDistributed: 0,
      topExpertId: null,
      deepestChainLength: 0,
      narrative: "",
    };
    render(<EventLog result={result} nodes={nodes} />);
    expect(screen.getByText(/round 4/i)).toBeInTheDocument();
  });

  it("renders an 'adopt' line for each adopted event with named entities", () => {
    const result: RoundResult = {
      round: 1,
      events: [
        {
          kind: "adopted",
          farmerId: "f1",
          practiceId: "p1",
          via: "advises",
          sourceId: "e_a",
          hopsFromExpert: 0,
          expertAncestorId: "e_a",
        },
      ],
      newAdoptions: 1,
      blockedAttempts: 0,
      totalRewardDistributed: 0,
      topExpertId: "e_a",
      deepestChainLength: 1,
      narrative: "",
    };
    render(<EventLog result={result} nodes={nodes} />);
    expect(screen.getByText("adopt")).toBeInTheDocument();
    expect(screen.getByText("Wanjiru")).toBeInTheDocument();
    expect(screen.getByText("Drip irrigation")).toBeInTheDocument();
  });

  it("renders relay events with the source farmer and hop count", () => {
    const result: RoundResult = {
      round: 2,
      events: [
        {
          kind: "adopted",
          farmerId: "f2",
          practiceId: "p1",
          via: "relay",
          sourceId: "f1",
          hopsFromExpert: 1,
          expertAncestorId: "e_a",
        },
      ],
      newAdoptions: 1,
      blockedAttempts: 0,
      totalRewardDistributed: 0,
      topExpertId: null,
      deepestChainLength: 2,
      narrative: "",
    };
    render(<EventLog result={result} nodes={nodes} />);
    expect(screen.getByText(/from peer Wanjiru/)).toBeInTheDocument();
    expect(screen.getByText(/hop 1/)).toBeInTheDocument();
  });

  it("renders rewarded events with abbreviated tx hash", () => {
    const result: RoundResult = {
      round: 1,
      events: [
        {
          kind: "rewarded",
          adoptionEdgeId: "ad_x",
          expertId: "e_a",
          farmerId: "f_wanjiru",
          amount: 1,
          txHash: "abcdef1234567890fedcba0987654321",
          hops: 0,
        },
      ],
      newAdoptions: 0,
      blockedAttempts: 0,
      totalRewardDistributed: 1,
      topExpertId: "e_a",
      deepestChainLength: 0,
      narrative: "",
    };
    render(<EventLog result={result} nodes={nodes} />);
    expect(screen.getByText("paid")).toBeInTheDocument();
    expect(screen.getByText(/abcdef…4321/)).toBeInTheDocument();
  });

  it("renders blocked events with the reason", () => {
    const result: RoundResult = {
      round: 1,
      events: [
        {
          kind: "blocked",
          fromId: "f1",
          toId: "f2",
          practiceId: "p1",
          reason: "low-trust",
        },
      ],
      newAdoptions: 0,
      blockedAttempts: 1,
      totalRewardDistributed: 0,
      topExpertId: null,
      deepestChainLength: 0,
      narrative: "",
    };
    render(<EventLog result={result} nodes={nodes} />);
    expect(screen.getByText("blocked")).toBeInTheDocument();
    expect(screen.getByText(/low-trust/)).toBeInTheDocument();
  });
});
