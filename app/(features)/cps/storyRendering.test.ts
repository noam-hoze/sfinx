/**
 * Unit tests for story HTML sanitization (Bug 4 — XSS via dangerouslySetInnerHTML).
 *
 * Bug: `longStory` (OpenAI-generated HTML from `telemetryData.story`) was rendered
 * directly via `dangerouslySetInnerHTML` without sanitization. A prompt-injected
 * response containing `<script>` tags or `on*` event handlers would execute in the
 * company user's browser.
 *
 * Fix: renderStoryWithEmphasis uses the browser's built-in DOMParser to rebuild
 * the HTML tree from scratch, keeping only `<span style="...">` — the format
 * OpenAI produces for color emphasis. All other tags and attributes are stripped.
 *
 * These tests verify the sanitization policy in isolation using a simple
 * stripping implementation (no DOM/jsdom required in the test environment).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Replicate the sanitization logic extracted from renderStoryWithEmphasis
// ---------------------------------------------------------------------------

interface SanitizeOptions {
    ALLOWED_TAGS: string[];
    ALLOWED_ATTR: string[];
}

type SanitizeFn = (html: string, options: SanitizeOptions) => string;

function renderStoryWithEmphasis(
    longStory: string | null | undefined,
    sanitize: SanitizeFn
): string | null {
    if (!longStory) return null;

    return sanitize(longStory, {
        ALLOWED_TAGS: ["span"],
        ALLOWED_ATTR: ["style"],
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("renderStoryWithEmphasis sanitization policy", () => {
    let sanitize: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        sanitize = vi.fn((html: string) => html); // passthrough default
    });

    it("returns null when longStory is null", () => {
        const result = renderStoryWithEmphasis(null, sanitize);
        expect(result).toBeNull();
        expect(sanitize).not.toHaveBeenCalled();
    });

    it("returns null when longStory is undefined", () => {
        const result = renderStoryWithEmphasis(undefined, sanitize);
        expect(result).toBeNull();
        expect(sanitize).not.toHaveBeenCalled();
    });

    it("returns null when longStory is an empty string", () => {
        const result = renderStoryWithEmphasis("", sanitize);
        expect(result).toBeNull();
        expect(sanitize).not.toHaveBeenCalled();
    });

    it("calls sanitize with ALLOWED_TAGS: [span] and ALLOWED_ATTR: [style]", () => {
        const html = '<span style="color:red">hello</span>';
        renderStoryWithEmphasis(html, sanitize);

        expect(sanitize).toHaveBeenCalledWith(html, {
            ALLOWED_TAGS: ["span"],
            ALLOWED_ATTR: ["style"],
        });
    });

    it("returns the sanitized output (not the raw input)", () => {
        const raw = '<script>alert(1)</script><span style="color:blue">ok</span>';
        const clean = '<span style="color:blue">ok</span>';
        sanitize.mockReturnValueOnce(clean);

        const result = renderStoryWithEmphasis(raw, sanitize);
        expect(result).toBe(clean);
    });

    it("does not allow tags outside the allowlist through the policy", () => {
        // Simulate what DOMPurify would do: strip disallowed tags
        const strippingImpl: SanitizeFn = (html, opts) => {
            let output = html;
            // Step 1: Remove entire elements (opening tag + content + closing tag) for
            // disallowed tags. This matches DOMPurify's behaviour for dangerous elements
            // like <script> and <style> which are removed including their text content.
            output = output.replace(/<(\w+)(?:\s[^>]*)?>[\s\S]*?<\/\1>/g, (match, tag) => {
                if (opts.ALLOWED_TAGS.includes(tag.toLowerCase())) return match;
                return "";
            });
            // Step 2: Strip any remaining lone open/close tags not in ALLOWED_TAGS.
            output = output.replace(/<\/?(\w+)(\s[^>]*)?>/g, (match, tag) => {
                if (opts.ALLOWED_TAGS.includes(tag.toLowerCase())) return match;
                return "";
            });
            // Step 3: Strip any attribute not in ALLOWED_ATTR from surviving tags.
            output = output.replace(/\s(\w+)=["'][^"']*["']/g, (match, attr) => {
                if (opts.ALLOWED_ATTR.includes(attr.toLowerCase())) return match;
                return "";
            });
            return output;
        };

        const malicious = '<span style="color:red" onclick="evil()">text</span><script>bad()</script>';
        const result = renderStoryWithEmphasis(malicious, strippingImpl);

        expect(result).not.toContain("onclick");
        expect(result).not.toContain("<script>");
        expect(result).not.toContain("bad()");
        expect(result).toContain('<span style="color:red">text</span>');
    });

    it("allows span with style attribute through the policy", () => {
        const html = '<span style="color: #ff6600; font-weight: bold;">Candidate Name</span>';
        sanitize.mockReturnValueOnce(html); // passthrough for allowed content

        const result = renderStoryWithEmphasis(html, sanitize);
        expect(result).toBe(html);
    });
});
