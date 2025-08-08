# Smart Vocabulary - Test Suite

## Overview

This project uses a modern testing stack with:
- **Vitest** for unit tests (with jsdom environment)
- **Playwright** for end-to-end tests
- **Visual regression testing** for UI consistency

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm run test:unit
```

### Unit Tests with Watch Mode
```bash
npm run test:unit:watch
```

### E2E Tests Only
```bash
npm run test:e2e
```

### E2E Tests with UI
```bash
npm run test:e2e:ui
```

### View E2E Test Report
```bash
npm run test:e2e:report
```

## Test Structure

### Unit Tests (`tests/dom/`)
- **ui-components.test.js** - Tests for UI components and utilities
  - Word card creation and variants
  - Progress components
  - Metadata formatting
  - Translation blocks
  - DOM integration

### E2E Tests (`tests/e2e/`)
- **app.spec.js** - Full application workflow tests
  - Navigation between tabs
  - Adding words
  - Learning flow
  - Responsive design
  - Visual regression tests

## Test Coverage

### Unit Tests Cover:
- ✅ UI component creation and variants
- ✅ Progress bar rendering
- ✅ Metadata formatting with European date format
- ✅ Word card expand/collapse functionality
- ✅ Action button handling
- ✅ DOM integration

### E2E Tests Cover:
- ✅ Complete user workflows
- ✅ Cross-browser compatibility
- ✅ Mobile responsiveness
- ✅ Visual regression (UI consistency)
- ✅ Accessibility (with axe-core)

## Configuration

### Vitest Config (`vitest.config.js`)
- Uses jsdom environment for DOM testing
- Includes setup file for global mocks
- Excludes e2e tests from unit test runs

### Playwright Config (`playwright.config.js`)
- Tests on multiple browsers (Chrome, Firefox, Safari)
- Mobile viewport testing
- Visual regression snapshots
- Accessibility testing integration

## Visual Regression Tests

Visual regression tests ensure UI consistency across changes. If tests fail due to intentional UI changes:

1. Review the diff images in `test-results/`
2. If changes are expected, update snapshots:
   ```bash
   npx playwright test --update-snapshots
   ```

## Adding New Tests

### Unit Tests
Add new test files in `tests/dom/` following the existing pattern:
```javascript
import { describe, it, expect, beforeEach } from 'vitest';

describe('Your Component', () => {
  it('should do something', () => {
    // test implementation
  });
});
```

### E2E Tests
Add new test files in `tests/e2e/` following the existing pattern:
```javascript
const { test, expect } = require('@playwright/test');

test('should do something', async ({ page }) => {
  // test implementation
});
```

## Legacy Tests Migration

The old test system (`run-tests.js`, `final-tests.html`, `test.js`) has been removed. All functionality has been migrated to the new Vitest + Playwright stack with improved coverage and reliability.
