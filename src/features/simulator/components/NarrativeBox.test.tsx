/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NarrativeBox } from "./NarrativeBox";

const baseProps = {
  round: 0,
  narrative: null,
  newAdoptions: 0,
  blockedAttempts: 0,
  totalReward: 0,
  isLoading: false,
};

describe("NarrativeBox", () => {
  it("renders the empty-state copy when round is null", () => {
    render(<NarrativeBox {...baseProps} round={null} />);
    expect(screen.getByText(/Press/)).toBeInTheDocument();
    expect(screen.getByText(/Idle/)).toBeInTheDocument();
  });

  it("renders the round number, adoptions, and reward stats", () => {
    render(
      <NarrativeBox
        round={3}
        narrative="A round happened."
        newAdoptions={2}
        blockedAttempts={4}
        totalReward={0.75}
        isLoading={false}
      />,
    );
    expect(screen.getByText("3")).toBeInTheDocument(); // round
    expect(screen.getByText("2")).toBeInTheDocument(); // adoptions
    expect(screen.getByText("0.75")).toBeInTheDocument(); // reward
    expect(screen.getByText("A round happened.")).toBeInTheDocument();
  });

  it("renders the loading state when narrating", () => {
    render(<NarrativeBox {...baseProps} round={1} narrative={null} isLoading />);
    expect(screen.getByText(/Narrating round 1/)).toBeInTheDocument();
  });

  it("mentions blocked attempts when present", () => {
    render(
      <NarrativeBox
        {...baseProps}
        round={2}
        narrative="ok"
        newAdoptions={1}
        blockedAttempts={5}
      />,
    );
    expect(screen.getByText(/5 attempts stalled/)).toBeInTheDocument();
  });

  it("hides the blocked attempts line when there are none", () => {
    render(<NarrativeBox {...baseProps} round={2} narrative="ok" newAdoptions={1} blockedAttempts={0} />);
    expect(screen.queryByText(/attempts stalled/)).not.toBeInTheDocument();
  });
});
