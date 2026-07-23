import "@testing-library/jest-dom";
import { expect, afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => {
    const listeners: ((event: any) => void)[] = [];
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: (listener: (event: any) => void) => {
        listeners.push(listener);
      },
      removeListener: (listener: (event: any) => void) => {
        const index = listeners.indexOf(listener);
        if (index > -1) listeners.splice(index, 1);
      },
      addEventListener: (type: string, listener: (event: any) => void) => {
        if (type === "change") listeners.push(listener);
      },
      removeEventListener: (type: string, listener: (event: any) => void) => {
        if (type === "change") {
          const index = listeners.indexOf(listener);
          if (index > -1) listeners.splice(index, 1);
        }
      },
      dispatchEvent: () => true,
    };
  },
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
