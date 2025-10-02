import { CodeEdit, fastForwardApplyEdits } from "./typingEmulator";
import {
    computeHash,
    verifyApplyContract,
    mintNextVersionId,
} from "./versioning";
import { applyCodeEditsSafely } from "./applyCodeEdits";

export class EditorBufferManager {
    private text: string;
    private versionId: string;
    private readonly allowlist: string[];

    constructor(
        initialText: string,
        initialVersionId: string,
        allowlist: string[]
    ) {
        this.text = initialText;
        this.versionId = initialVersionId;
        this.allowlist = allowlist;
    }

    get currentText(): string {
        return this.text;
    }

    get currentVersion(): string {
        return this.versionId;
    }

    get currentHash(): string {
        return computeHash(this.text);
    }

    tryApply(incoming: {
        versionId: string;
        beforeHash: string;
        edits: CodeEdit[];
    }):
        | { ok: true; versionId: string; hash: string; text: string }
        | { ok: false; reason: string } {
        const check = verifyApplyContract(
            incoming.versionId,
            incoming.beforeHash,
            this.versionId,
            this.text
        );
        if (!check.ok) return check;

        const applied = applyCodeEditsSafely(this.text, incoming.edits, {
            allowlist: this.allowlist,
        });
        if (!applied.ok) return applied;

        this.text = applied.text;
        this.versionId = mintNextVersionId(this.versionId);
        return {
            ok: true,
            versionId: this.versionId,
            hash: this.currentHash,
            text: this.text,
        };
    }
}
