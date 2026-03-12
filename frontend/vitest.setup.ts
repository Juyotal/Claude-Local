/// <reference types="vitest/globals" />
import "@testing-library/jest-dom";

// Mock navigator.clipboard for CodeBlock tests
Object.defineProperty(navigator, "clipboard", {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
  writable: true,
});

// jsdom doesn't implement scrollTo on elements
Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;

// Radix UI components (ScrollArea, etc.) use ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
