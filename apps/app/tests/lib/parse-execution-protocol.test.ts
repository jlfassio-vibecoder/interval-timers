/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unit tests for Execution Protocol extraction from deep dive HTML.
 * Covers body-only search, strict heading + list (A), broad heading (B),
 * text-then-list (C), longest-list fallback (D), numbered-paragraph fallback (E).
 */

import { describe, expect, it } from 'vitest';
import { extractExecutionProtocolFromDeepDiveHtml } from '@/lib/parse-execution-protocol';

describe('extractExecutionProtocolFromDeepDiveHtml', () => {
  describe('invalid or empty input', () => {
    it('returns [] for empty string', () => {
      expect(extractExecutionProtocolFromDeepDiveHtml('')).toEqual([]);
    });

    it('returns [] for null/undefined (type guard)', () => {
      expect(extractExecutionProtocolFromDeepDiveHtml(null as unknown as string)).toEqual([]);
      expect(extractExecutionProtocolFromDeepDiveHtml(undefined as unknown as string)).toEqual([]);
    });

    it('returns [] when no Execution Protocol or list is present', () => {
      const html = '<body><h2>Biomechanics</h2><p>Some text.</p></body>';
      expect(extractExecutionProtocolFromDeepDiveHtml(html)).toEqual([]);
    });
  });

  describe('body-only search', () => {
    it('searches inside <body> when present and ignores content outside', () => {
      const html = `
        <head><title>X</title><h2>Execution Protocol</h2><ol><li>Fake</li></ol></head>
        <body>
          <h2>Execution Protocol</h2>
          <ol><li>Setup</li><li>Move</li></ol>
        </body>
      `;
      expect(extractExecutionProtocolFromDeepDiveHtml(html)).toEqual(['Setup', 'Move']);
    });

    it('searches full HTML when no body tag', () => {
      const html = '<h2>Execution Protocol</h2><ol><li>Only step</li></ol>';
      expect(extractExecutionProtocolFromDeepDiveHtml(html)).toEqual(['Only step']);
    });
  });

  describe('Strategy A: strict heading + list', () => {
    it('extracts list after "Execution Protocol" heading', () => {
      const html = `
        <body>
          <h2>Execution Protocol</h2>
          <ol><li>First</li><li>Second</li><li>Third</li></ol>
        </body>
      `;
      expect(extractExecutionProtocolFromDeepDiveHtml(html)).toEqual(['First', 'Second', 'Third']);
    });

    it('extracts list after "Step-by-Step Instructions" heading', () => {
      const html = `
        <body>
          <h3>Step-by-Step Instructions</h3>
          <ul><li>Alpha</li><li>Beta</li></ul>
        </body>
      `;
      expect(extractExecutionProtocolFromDeepDiveHtml(html)).toEqual(['Alpha', 'Beta']);
    });

    it('strips HTML inside list items (text only; label prefixes like "Point 1:" are stripped by UI)', () => {
      const html = `
        <body>
          <h2>Execution Protocol</h2>
          <ol><li><strong>Point 1:</strong> Do this.</li><li>Then that.</li></ol>
        </body>
      `;
      expect(extractExecutionProtocolFromDeepDiveHtml(html)).toEqual([
        'Point 1: Do this.',
        'Then that.',
      ]);
    });
  });

  describe('Strategy B: broad heading match', () => {
    it('extracts list when h2/h3 contains keyword (e.g. "protocol")', () => {
      const html = `
        <body>
          <h2>How to Perform — Protocol</h2>
          <ol><li>Step one</li><li>Step two</li></ol>
        </body>
      `;
      expect(extractExecutionProtocolFromDeepDiveHtml(html)).toEqual(['Step one', 'Step two']);
    });

    it('allows single-step list', () => {
      const html = `
        <body>
          <h3>Execution</h3>
          <ul><li>Single step only</li></ul>
        </body>
      `;
      expect(extractExecutionProtocolFromDeepDiveHtml(html)).toEqual(['Single step only']);
    });
  });

  describe('Strategy C: text then next list', () => {
    it('finds first list after "Execution Protocol" or "Step-by-Step" text', () => {
      const html = `
        <body>
          <p>Below is the Execution Protocol for this exercise.</p>
          <ol><li>A</li><li>B</li></ol>
        </body>
      `;
      expect(extractExecutionProtocolFromDeepDiveHtml(html)).toEqual(['A', 'B']);
    });
  });

  describe('Strategy D: longest-list fallback', () => {
    it('returns longest ol/ul when "Execution" or "Step-by-Step" in region but no list after that text (A/B/C miss)', () => {
      const html = `
        <body>
          <ul><li>Short</li></ul>
          <ol><li>One</li><li>Two</li><li>Three</li></ol>
          <p>Execution mentioned here.</p>
        </body>
      `;
      expect(extractExecutionProtocolFromDeepDiveHtml(html)).toEqual(['One', 'Two', 'Three']);
    });
  });

  describe('Strategy E: numbered-paragraph fallback', () => {
    it('splits numbered steps when block starts with "1. " (no leading whitespace)', () => {
      const html = `
        <body>
          <h2>Execution Protocol</h2>
          <p>1. First step here. 2. Second step here. 3. Third step.</p>
        </body>
      `;
      expect(extractExecutionProtocolFromDeepDiveHtml(html)).toEqual([
        'First step here.',
        'Second step here.',
        'Third step.',
      ]);
    });

    it('splits numbered steps with "1) 2)" style', () => {
      const html = `
        <body>
          <h2>Step-by-Step</h2>
          <div>1) Begin. 2) Then move. 3) Finish.</div>
        </body>
      `;
      const result = extractExecutionProtocolFromDeepDiveHtml(html);
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result[0]).toContain('Begin');
      expect(result[1]).toContain('Then move');
    });

    it('returns at least one step when only one numbered item exists', () => {
      const html = `
        <body>
          <h2>Execution Protocol</h2>
          <p>1. Single step content.</p>
        </body>
      `;
      expect(extractExecutionProtocolFromDeepDiveHtml(html)).toEqual(['Single step content.']);
    });
  });

  describe('strategy order', () => {
    it('prefers Strategy A over later strategies when strict heading + list exist', () => {
      const html = `
        <body>
          <h2>Execution Protocol</h2>
          <ol><li>From list</li></ol>
          <p>1. From paragraph. 2. Also paragraph.</p>
        </body>
      `;
      expect(extractExecutionProtocolFromDeepDiveHtml(html)).toEqual(['From list']);
    });
  });
});
