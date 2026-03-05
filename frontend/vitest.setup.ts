/// <reference types="vitest/globals" />
import "@testing-library/jest-dom";

// Mock navigator.clipboard for CodeBlock tests
Object.defineProperty(navigator, "clipboard", {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
  writable: true,
});
