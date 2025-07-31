"use client";

import Editor from "@monaco-editor/react";

export function MonacoEditor() {
    return (
        <Editor
            height="100%"
            defaultLanguage="javascript"
            defaultValue="// some comment"
            theme="vs-dark"
        />
    );
}
