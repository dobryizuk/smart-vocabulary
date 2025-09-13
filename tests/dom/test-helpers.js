import { vi } from 'vitest';

// Basic test helpers needed by DOM tests (no UI mocks)

export function setupDOM() {
  document.body.innerHTML = '';

  // Ensure globals
  global.window = global;
  global.DataManager = {
    vocabulary: [],
    userProgress: {}
  };

  // Minimal SpacedRepetition progress helper used by some tests
  global.SpacedRepetition = {
    calculateLearningProgress: (easeFactor) => Math.round(((easeFactor - 1.3) / (3.5 - 1.3)) * 100)
  };
}

export function createTestWord(overrides = {}) {
  return {
    id: 'test-word-' + Math.random().toString(36).substr(2, 9),
    original: 'test',
    translation: 'тест',
    definition: 'A trial or examination',
    phonetic: '/test/',
    synonyms: ['trial', 'exam'],
    examples: ['This is a test', 'Test your knowledge'],
    repetition: 0,
    easeFactor: 1.3,
    createdAt: new Date().toISOString(),
    ...overrides
  };
}

export function createTestProgress(overrides = {}) {
  return {
    repetitions: 3,
    reviewStatus: 'Ready for review',
    isReady: true,
    addedDate: new Date('2024-01-01'),
    correctCount: 5,
    totalAttempts: 7,
    lastSeen: Date.now() - (1000 * 60 * 60 * 24),
    ...overrides
  };
}

export function renderToDOM(htmlString) {
  const container = document.createElement('div');
  container.innerHTML = htmlString;
  document.body.appendChild(container);
  return container;
}

export function hasClass(element, className) {
  if (!element || !element.classList) return false;
  return element.classList.contains(className);
}

export function getTextContent(element) {
  if (!element) return '';
  return element.textContent.trim();
}

export function mockLocalStorage() {
  const store = {};
  const mockStorage = {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = value; }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { Object.keys(store).forEach(key => delete store[key]); })
  };

  Object.defineProperty(global, 'localStorage', { value: mockStorage, writable: true });
  Object.defineProperty(window, 'localStorage', { value: mockStorage, writable: true });
  return mockStorage;
}

export function mockMatchMedia(prefersDark = false) {
  return vi.fn().mockImplementation(query => ({
    matches: query === '(prefers-color-scheme: dark)' ? prefersDark : !prefersDark,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

export function nextTick() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

export function setupThemeManagerDOM() {
  document.body.innerHTML = `
    <div id="dataManagement">
      <h4>Data Management</h4>
    </div>
  `;

  const metaThemeColor = document.createElement('meta');
  metaThemeColor.name = 'theme-color';
  document.head.appendChild(metaThemeColor);
  return metaThemeColor;
}

 