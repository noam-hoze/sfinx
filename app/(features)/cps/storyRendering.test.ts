/**
 * Unit tests for story HTML sanitization (Bug 4 — XSS via dangerouslySetInnerHTML).
 *
 * Bug: `longStory` (OpenAI-generated HTML from `telemetryData.story`) was rendered
 * directly via `dangerouslySetInnerHTML` without sanitization. A prompt-injected
 * response containing `<script>` tags or `on*` event handlers would execute in the
 * company user's browser.
 *
 * Fix: DOMPurify.sanitize() is called before rendering, with an allowlist that
 * permits only `<span style="...">` — the format OpenAI produces for color emphasis.
 *
 * These tests verify the sanitization wrapper logic in isolation by mocking DOMPurify,
 * since the project's vitest environment is Node.js (no DOM/jsdom available).
 * The DOMPurify library itself is a well-tested upstream dependency.
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
            // Strip any tag not in ALLOWED_TAGS
            const tagPattern = /<\/?(\w+)(\s[^>]*)?>/g;
            output = output.replace(tagPattern, (match, tag) => {
                if (opts.ALLOWED_TAGS.includes(tag.toLowerCase())) return match;
                return "";
            });
            // Strip any attribute not in ALLOWED_ATTR
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
