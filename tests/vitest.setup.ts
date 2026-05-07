import "@testing-library/jest-dom/vitest";
import { afterEach, beforeAll, afterAll, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Reset RTL mounts between tests.
afterEach(() => {
  cleanup();
});

// Polyfill `matchMedia` for happy-dom.
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => true,
    }),
  });

  // happy-dom doesn't ship a ResizeObserver — React Flow needs it.
  class MockResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(window, "ResizeObserver", {
    writable: true,
    value: MockResizeObserver,
  });

  // Silence harmless console noise that comes from React Flow + happy-dom.
  const origError = console.error;
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    const msg = String(args[0] ?? "");
    if (msg.includes("Could not parse CSS stylesheet")) return;
    origError(...args);
  });
});

afterAll(() => {
  vi.restoreAllMocks();
});
