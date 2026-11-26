import { vi } from 'vitest';

// Basic test helpers needed by DOM tests (no UI mocks)

export function setupDOM() {
  document.body.innerHTML = '';

  // Ensure globals and SV namespace
  global.window = global;
  global.SV = global.SV || {};
  global.SV.DataManager = {
    vocabulary: []
  };

  // Mock toggleWordCard for tests
  global.SV.UIComponents = global.SV.UIComponents || {};
  global.SV.UIComponents.toggleWordCard = (cardId) => {
    const card = document.getElementById(cardId);
    if (card) {
      card.classList.toggle('word-card--expanded');
      const toggle = card.querySelector('.word-card__toggle');
      if (toggle) {
        const isExpanded = card.classList.contains('word-card--expanded');
        toggle.setAttribute('aria-expanded', isExpanded.toString());
        toggle.textContent = isExpanded ? '▲' : '▼';
      }
    }
  };
}

export function createTestWord(overrides = {}) {
  return {
    id: 'test-word-' + (overrides.id || 'fixed'),
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

// In-memory Storage for injecting into modules; `data` exposes the raw stored strings
export function createMemoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: vi.fn((key) => (key in data ? data[key] : null)),
    setItem: vi.fn((key, value) => { data[key] = String(value); }),
    removeItem: vi.fn((key) => { delete data[key]; })
  };
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

export function setupThemeManagerDOM() {
  document.body.innerHTML = '';

  const metaThemeColor = document.createElement('meta');
  metaThemeColor.name = 'theme-color';
  document.head.appendChild(metaThemeColor);
  return metaThemeColor;
}

 