import { describe, it, expect, beforeEach } from 'vitest';
import { setupDOM, renderToDOM, hasClass, getTextContent } from './test-helpers.js';

describe('Progress Component', () => {
  let createProgressComponent;

  beforeEach(() => {
    setupDOM();
    const UI = require('../../js/ui-components.js');
    createProgressComponent = UI.createProgressComponent;
  });

  describe('Progress Bar Creation', () => {
    it('should create progress bar with correct percentage', () => {
      const progressHtml = createProgressComponent(75, 'default', 'Test Progress');
      const container = renderToDOM(progressHtml);
      
      const progressComponent = container.querySelector('.progress-component');
      expect(progressComponent).toBeTruthy();
      
      const progressFill = container.querySelector('.progress-component__fill');
      expect(progressFill).toBeTruthy();
      expect(progressFill.style.width).toBe('75%');
      
      const percentageText = container.querySelector('.progress-component__percentage');
      expect(getTextContent(percentageText)).toContain('75%');
      
      const labelText = container.querySelector('.progress-component__label');
      expect(getTextContent(labelText)).toContain('Test Progress');
    });

    it('should handle compact variant correctly', () => {
      const progressHtml = createProgressComponent(50, 'compact', 'Compact Progress');
      const container = renderToDOM(progressHtml);
      
      const progressBar = container.querySelector('.progress-component__bar--compact');
      expect(progressBar).toBeTruthy();
      
      const percentage = container.querySelector('.progress-component__percentage--compact');
      expect(percentage).toBeTruthy();
      
      expect(getTextContent(percentage)).toContain('50%');
    });

    it('should handle edge case percentages correctly', () => {
      const zeroProgress = createProgressComponent(0, 'default', 'Zero Progress');
      const zeroContainer = renderToDOM(zeroProgress);
      const zeroFill = zeroContainer.querySelector('.progress-component__fill');
      expect(zeroFill.style.width).toBe('0%');
      const zeroPercentage = zeroContainer.querySelector('.progress-component__percentage');
      expect(getTextContent(zeroPercentage)).toContain('0%');

      const fullProgress = createProgressComponent(100, 'default', 'Full Progress');
      const fullContainer = renderToDOM(fullProgress);
      const fullFill = fullContainer.querySelector('.progress-component__fill');
      expect(fullFill.style.width).toBe('100%');
      const fullPercentage = fullContainer.querySelector('.progress-component__percentage');
      expect(getTextContent(fullPercentage)).toContain('100%');
    });

    it('should clamp invalid percentages and show sane values', () => {
      const negativeProgress = createProgressComponent(-10, 'default', 'Negative');
      const negativeContainer = renderToDOM(negativeProgress);
      const negativeFill = negativeContainer.querySelector('.progress-component__fill');
      expect(negativeFill.style.width).toBe('0%');

      const overProgress = createProgressComponent(150, 'default', 'Over 100');
      const overContainer = renderToDOM(overProgress);
      const overFill = overContainer.querySelector('.progress-component__fill');
      expect(overFill.style.width).toBe('100%');

      const nanProgress = createProgressComponent(NaN, 'default', 'NaN');
      const nanContainer = renderToDOM(nanProgress);
      const nanFill = nanContainer.querySelector('.progress-component__fill');
      expect(nanFill.style.width).toBe('0%');
    });
  });

  describe('Progress Component Structure', () => {
    it('should have proper DOM structure', () => {
      const progressHtml = createProgressComponent(60, 'default', 'Structure Test');
      const container = renderToDOM(progressHtml);
      
      const component = container.querySelector('.progress-component');
      const bar = component.querySelector('.progress-component__bar');
      const fill = bar.querySelector('.progress-component__fill');
      const label = component.querySelector('.progress-component__label');
      const percentage = component.querySelector('.progress-component__percentage');
      
      expect(component).toBeTruthy();
      expect(bar).toBeTruthy();
      expect(fill).toBeTruthy();
      expect(label).toBeTruthy();
      expect(percentage).toBeTruthy();
    });

    it('should apply correct CSS classes for variants', () => {
      const defaultProgress = createProgressComponent(50, 'default', 'Default');
      const defaultContainer = renderToDOM(defaultProgress);
      
      const defaultBar = defaultContainer.querySelector('.progress-component__bar');
      expect(hasClass(defaultBar, 'progress-component__bar')).toBe(true);
      expect(hasClass(defaultBar, 'progress-component__bar--compact')).toBe(false);
      
      const compactProgress = createProgressComponent(50, 'compact', 'Compact');
      const compactContainer = renderToDOM(compactProgress);
      
      const compactBar = compactContainer.querySelector('.progress-component__bar--compact');
      expect(compactBar).toBeTruthy();
    });
  });
});

describe('Status Badge Component', () => {
  let createStatusBadge;

  beforeEach(() => {
    setupDOM();
    const UI = require('../../js/ui-components.js');
    createStatusBadge = UI.createStatusBadge;
  });

  describe('Status Badge Creation', () => {
    it('should create correct badge for new words (0% progress)', () => {
      const badgeHtml = createStatusBadge(0);
      const container = renderToDOM(badgeHtml);
      
      const badge = container.querySelector('.status-badge--new');
      expect(badge).toBeTruthy();
      expect(getTextContent(badge)).toContain('New');
    });

    it('should create correct badge for learning words (1-49% progress)', () => {
      const badgeHtml = createStatusBadge(25);
      const container = renderToDOM(badgeHtml);
      
      const badge = container.querySelector('.status-badge--learning');
      expect(badge).toBeTruthy();
      expect(getTextContent(badge)).toContain('Learning');
    });

    it('should create correct badge for familiar words (50-79% progress)', () => {
      const badgeHtml = createStatusBadge(60);
      const container = renderToDOM(badgeHtml);
      
      const badge = container.querySelector('.status-badge--familiar');
      expect(badge).toBeTruthy();
      expect(getTextContent(badge)).toContain('Familiar');
    });

    it('should create correct badge for mastered words (80%+ progress)', () => {
      const badgeHtml = createStatusBadge(85);
      const container = renderToDOM(badgeHtml);
      
      const badge = container.querySelector('.status-badge--mastered');
      expect(badge).toBeTruthy();
      expect(getTextContent(badge)).toContain('Mastered');
    });

    it('should handle edge cases correctly', () => {
      // Test exact boundaries
      const learning49 = createStatusBadge(49);
      const learning49Container = renderToDOM(learning49);
      expect(learning49Container.querySelector('.status-badge--learning')).toBeTruthy();
      
      const familiar50 = createStatusBadge(50);
      const familiar50Container = renderToDOM(familiar50);
      expect(familiar50Container.querySelector('.status-badge--familiar')).toBeTruthy();
      
      const familiar79 = createStatusBadge(79);
      const familiar79Container = renderToDOM(familiar79);
      expect(familiar79Container.querySelector('.status-badge--familiar')).toBeTruthy();
      
      const mastered80 = createStatusBadge(80);
      const mastered80Container = renderToDOM(mastered80);
      expect(mastered80Container.querySelector('.status-badge--mastered')).toBeTruthy();
    });
  });

  describe('Status Badge Behavior', () => {
    it('should have proper accessibility attributes', () => {
      const badgeHtml = createStatusBadge(75);
      const container = renderToDOM(badgeHtml);
      
      const badge = container.querySelector('.status-badge');
      expect(badge).toBeTruthy();
      
      // Should have role or aria-label for accessibility
      const hasAccessibility = badge.getAttribute('role') || 
                              badge.getAttribute('aria-label') || 
                              badge.getAttribute('title');
      expect(hasAccessibility).toBeTruthy();
    });

    it('should handle invalid progress values gracefully', () => {
      // Test negative progress
      const negativeBadge = createStatusBadge(-10);
      const negativeContainer = renderToDOM(negativeBadge);
      expect(negativeContainer.querySelector('.status-badge')).toBeTruthy();
      
      // Test over 100% progress
      const overBadge = createStatusBadge(150);
      const overContainer = renderToDOM(overBadge);
      expect(overContainer.querySelector('.status-badge')).toBeTruthy();
    });
  });
});
