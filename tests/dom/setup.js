// Test setup for DOM tests
import { beforeEach } from 'vitest';

beforeEach(() => {
  // Reset DOM
  document.body.innerHTML = '';
  
  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  global.localStorage = localStorageMock;
  
  // Mock window properties
  global.window = global;
  global.speechSynthesis = {
    getVoices: () => [],
    speak: vi.fn(),
    cancel: vi.fn(),
  };
});
