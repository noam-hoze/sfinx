/**
 * Company dashboard page for configuring the public interview guide landing page.
 * Loads existing config on mount; saves via PUT /api/company/interview-guide.
 * The public page returns 404 until at least one successful save.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import AuthGuard from "app/shared/components/AuthGuard";
import type { InterviewGuideConfig, InterviewStageConfig, PrepTipConfig, TeamPhotoConfig } from "app/shared/types/interviewGuide";
import { getInterviewGuidePreviewStorageKey } from "app/shared/utils/interviewGuidePreview";

/**
 * Image upload widget. Shows a preview of the current image and a styled upload button.
 * Uploads immediately on file selection; calls onChange with the resulting public URL.
 */
function ImageUpload({ label, value, onChange }: { label: string; value: string; onChange: (url: string) => void }) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFile = async (file: File) => {
        setError(null);
        setUploading(true);
        try {
            const form = new FormData();
            form.append("image", file);
            const resp = await fetch("/api/upload/interview-guide-image", { method: "POST", body: form });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error);
            onChange(data.imageUrl);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Upload failed");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">{label}</label>
            <div className="flex items-center gap-4">
                {value && (
                    <div className="w-24 h-16 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                        <img src={value} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                )}
                <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium cursor-pointer transition-colors ${uploading ? "bg-gray-50 text-gray-400 border-gray-200" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    {uploading ? "Uploading…" : value ? "Replace image" : "Upload image"}
                    <input ref={inputRef} type="file" accept="image/*" className="sr-only" disabled={uploading}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                </label>
                <p className="text-xs text-gray-400">JPG, PNG, GIF · max 5 MB</p>
            </div>
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
    );
}

/** Empty initial state — company must fill all fields explicitly. */
function emptyStage(title: string): InterviewStageConfig {
    return { title, shortDescription: "", duration: "", format: "", who: "", description: "", whatToExpect: ["", "", "", ""], howToPrepare: ["", "", "", ""] };
}

function emptyConfig(): InterviewGuideConfig {
    return {
        hero: { tagline: "", imageUrl: "" },
        culture: { missionText: "" },
        stages: [
            emptyStage("AI Screening"),
            emptyStage("First Interview"),
            emptyStage("Second Interview"),
            emptyStage("CEO Conversation"),
        ],
        tips: [{ title: "", description: "", tags: [] }],
        teamPhotos: [],
    };
}

/** Reads the API error message for the initial config load. */
function getLoadErrorMessage(data: unknown): string {
    if (typeof data === "object" && data !== null && typeof (data as { error?: unknown }).error === "string") {
        return (data as { error: string }).error;
    }
    return "Failed to load interview guide configuration.";
}

/** Generic string input row. */
function Field({ label, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
    const cls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400";
    return (
        <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">{label}</label>
            {multiline
                ? <textarea rows={3} className={cls} value={value} onChange={(e) => onChange(e.target.value)} />
                : <input type="text" className={cls} value={value} onChange={(e) => onChange(e.target.value)} />}
        </div>
    );
}

/** Editable bullet-point list. */
function BulletEditor({ label, items, onChange }: { label: string; items: string[]; onChange: (items: string[]) => void }) {
    const update = (i: number, val: string) => { const next = [...items]; next[i] = val; onChange(next); };
    const add = () => onChange([...items, ""]);
    const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</label>
                <button type="button" onClick={add} className="text-xs text-electric-blue font-medium hover:underline">+ Add</button>
            </div>
            <div className="space-y-2">
                {items.map((item, i) => (
                    <div key={i} className="flex gap-2">
                        <input type="text" className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" value={item} onChange={(e) => update(i, e.target.value)} />
                        <button type="button" onClick={() => remove(i)} className="text-gray-400 hover:text-red-500 text-xs px-2">✕</button>
                    </div>
                ))}
            </div>
        </div>
    );
}

/** Form section for a single interview stage. */
function StageSection({ stage, index, onChange, onRemove, canRemove }: { stage: InterviewStageConfig; index: number; onChange: (s: InterviewStageConfig) => void; onRemove: () => void; canRemove: boolean }) {
    const [open, setOpen] = useState(index === 0);
    const set = (key: keyof InterviewStageConfig, val: unknown) => onChange({ ...stage, [key]: val });
    return (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center bg-gray-50 hover:bg-gray-100 transition-colors">
                <button type="button" onClick={() => setOpen(!open)} className="flex-1 flex items-center justify-between px-4 py-3 text-left">
                    <span className="text-sm font-semibold text-gray-800">Stage {index + 1}: {stage.title || "(untitled)"}</span>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {canRemove && (
                    <button type="button" onClick={onRemove} className="px-3 py-3 text-gray-400 hover:text-red-500 transition-colors" title="Remove stage">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                )}
            </div>
            {open && (
                <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label="Title" value={stage.title} onChange={(v) => set("title", v)} />
                        <Field label="Short description (timeline)" value={stage.shortDescription} onChange={(v) => set("shortDescription", v)} />
                        <Field label="Duration" value={stage.duration} onChange={(v) => set("duration", v)} />
                        <Field label="Format" value={stage.format} onChange={(v) => set("format", v)} />
                        <Field label="Who you'll meet" value={stage.who} onChange={(v) => set("who", v)} />
                    </div>
                    <Field label="Detailed description" value={stage.description} onChange={(v) => set("description", v)} multiline />
                    <BulletEditor label="What to expect (bullets)" items={stage.whatToExpect} onChange={(v) => set("whatToExpect", v)} />
                    <BulletEditor label="How to prepare (bullets)" items={stage.howToPrepare} onChange={(v) => set("howToPrepare", v)} />
                </div>
            )}
        </div>
    );
}

/** Form section for preparation tips. */
function TipsSection({ tips, onChange }: { tips: PrepTipConfig[]; onChange: (t: PrepTipConfig[]) => void }) {
    const add = () => onChange([...tips, { title: "", description: "", tags: [] }]);
    const remove = (i: number) => onChange(tips.filter((_, idx) => idx !== i));
    const update = (i: number, key: keyof PrepTipConfig, val: unknown) => {
        const next = tips.map((t, idx) => idx === i ? { ...t, [key]: val } : t);
        onChange(next);
    };
    return (
        <div className="space-y-4">
            {tips.map((tip, i) => (
                <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-start gap-2">
                        <Field label="Title" value={tip.title} onChange={(v) => update(i, "title", v)} />
                        <button type="button" onClick={() => remove(i)} className="mt-5 text-gray-400 hover:text-red-500 text-sm">✕</button>
                    </div>
                    <Field label="Description" value={tip.description} onChange={(v) => update(i, "description", v)} multiline />
                    <Field label="Tags (comma-separated)" value={tip.tags.join(", ")} onChange={(v) => update(i, "tags", v.split(",").map((s) => s.trim()).filter(Boolean))} />
                </div>
            ))}
            <button type="button" onClick={add} className="text-sm text-electric-blue font-medium hover:underline">+ Add tip</button>
        </div>
    );
}

/** Form section for team photos. */
function TeamPhotosSection({ photos, onChange }: { photos: TeamPhotoConfig[]; onChange: (p: TeamPhotoConfig[]) => void }) {
    const add = () => onChange([...photos, { name: "", imageUrl: "" }]);
    const remove = (i: number) => onChange(photos.filter((_, idx) => idx !== i));
    const update = (i: number, key: keyof TeamPhotoConfig, val: string) => {
        const next = photos.map((p, idx) => idx === i ? { ...p, [key]: val } : p);
        onChange(next);
    };
    return (
        <div className="space-y-3">
            {photos.map((photo, i) => (
                <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-3">
                    <div className="flex gap-2 items-start justify-between">
                        <div className="flex-1"><Field label="Name" value={photo.name} onChange={(v) => update(i, "name", v)} /></div>
                        <button type="button" onClick={() => remove(i)} className="mt-5 text-gray-400 hover:text-red-500 text-sm flex-shrink-0">✕</button>
                    </div>
                    <ImageUpload label="Photo" value={photo.imageUrl} onChange={(v) => update(i, "imageUrl", v)} />
                </div>
            ))}
            <button type="button" onClick={add} className="text-sm text-electric-blue font-medium hover:underline">+ Add photo</button>
        </div>
    );
}

/** Hard error state for initial config load failures. */
function LoadErrorState({ message }: { message: string }) {
    return (
        <div className="max-w-3xl mx-auto py-10 px-6">
            <div className="rounded-3xl border border-red-200 bg-red-50/80 p-8 shadow-sm">
                <h1 className="text-2xl font-bold text-gray-900">Interview Guide</h1>
                <p className="mt-3 text-sm font-medium text-red-700">{message}</p>
                <p className="mt-2 text-sm text-gray-600">The editor is blocked until the interview guide loads successfully from the database.</p>
                <button type="button" onClick={() => window.location.reload()} className="mt-6 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:border-gray-300 hover:bg-gray-50">
                    Reload page
                </button>
            </div>
        </div>
    );
}

function InterviewGuideEditor() {
    const [config, setConfig] = useState<InterviewGuideConfig>(emptyConfig());
    const [companyId, setCompanyId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [previewing, setPreviewing] = useState(false);
    const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

    useEffect(() => {
        let active = true;

        const loadConfig = async () => {
            try {
                const response = await fetch("/api/company/interview-guide");
                const data = await response.json();
                if (!response.ok) throw new Error(getLoadErrorMessage(data));
                if (!active) return;
                if (data.config) setConfig(data.config);
                if (data.companyId) setCompanyId(data.companyId);
                setLoadError(null);
            } catch (error) {
                if (!active) return;
                setLoadError(error instanceof Error ? error.message : "Failed to load interview guide configuration.");
            } finally {
                if (active) setLoading(false);
            }
        };

        void loadConfig();
        return () => { active = false; };
    }, []);

    const save = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const resp = await fetch("/api/company/interview-guide", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config),
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error);
            setConfig(data.config);
            setMessage({ text: "Saved successfully", ok: true });
            return true;
        } catch (err) {
            setMessage({ text: err instanceof Error ? err.message : "Save failed", ok: false });
            return false;
        } finally {
            setSaving(false);
        }
    };

    const handlePreview = async () => {
        if (!companyId) return;

        setPreviewing(true);
        try {
            window.localStorage.setItem(
                getInterviewGuidePreviewStorageKey(companyId),
                JSON.stringify(config),
            );
            window.open(`/interview-guide/${companyId}?preview=1`, "_blank", "noopener,noreferrer");
        } catch {
            setMessage({ text: "Preview is unavailable right now. Please try again.", ok: false });
        }
        setPreviewing(false);
    };

    const setStage = (i: number, stage: InterviewStageConfig) => {
        const next = [...config.stages];
        next[i] = stage;
        setConfig({ ...config, stages: next });
    };

    const addStage = () => setConfig({ ...config, stages: [...config.stages, emptyStage("")] });

    const removeStage = (i: number) => setConfig({ ...config, stages: config.stages.filter((_, idx) => idx !== i) });

    if (loading) {
        return <div className="max-w-3xl mx-auto py-10 px-6 text-sm text-gray-500">Loading interview guide…</div>;
    }

    if (loadError) {
        return <LoadErrorState message={loadError} />;
    }

    return (
        <div className="max-w-3xl mx-auto py-10 px-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Interview Guide</h1>
                    <p className="text-sm text-gray-500 mt-1">Configure your public candidate landing page.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => { void handlePreview(); }}
                        disabled={!companyId || saving || previewing}
                        className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14m-6 4h3a2 2 0 002-2V8a2 2 0 00-2-2H9a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        {previewing ? "Opening preview…" : "Preview"}
                    </button>
                    <button
                        type="button"
                        onClick={() => { void save(); }}
                        disabled={saving || previewing}
                        className="px-5 py-2 rounded-lg bg-electric-blue text-white text-sm font-semibold hover:bg-blue-600 disabled:opacity-50 transition-colors"
                    >
                        {saving ? "Saving…" : "Save changes"}
                    </button>
                </div>
            </div>

            {message && (
                <div className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium ${message.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                    {message.text}
                </div>
            )}

            <div className="space-y-10">
                {/* Hero */}
                <section>
                    <h2 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">Hero section</h2>
                    <div className="space-y-4">
                        <Field label="Tagline (subtitle)" value={config.hero.tagline} onChange={(v) => setConfig({ ...config, hero: { ...config.hero, tagline: v } })} multiline />
                        <ImageUpload label="Hero image" value={config.hero.imageUrl} onChange={(v) => setConfig({ ...config, hero: { ...config.hero, imageUrl: v } })} />
                    </div>
                </section>

                {/* Mission */}
                <section>
                    <h2 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">Mission &amp; values</h2>
                    <div className="space-y-4">
                        <Field label="Mission text" value={config.culture.missionText} onChange={(v) => setConfig({ ...config, culture: { missionText: v } })} multiline />
                        <Field label="Careers page URL" value={config.careersUrl ?? ""} onChange={(v) => setConfig({ ...config, careersUrl: v || undefined })} />
                    </div>
                </section>

                {/* Interview stages */}
                <section>
                    <h2 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">Interview stages</h2>
                    <div className="space-y-3">
                        {config.stages.map((stage, i) => (
                            <StageSection key={i} stage={stage} index={i} onChange={(s) => setStage(i, s)} onRemove={() => removeStage(i)} canRemove={config.stages.length > 1} />
                        ))}
                    </div>
                    <button type="button" onClick={addStage} className="mt-3 text-sm text-electric-blue font-medium hover:underline">+ Add stage</button>
                </section>

                {/* Tips */}
                <section>
                    <h2 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">Preparation tips</h2>
                    <TipsSection tips={config.tips} onChange={(t) => setConfig({ ...config, tips: t })} />
                </section>

                {/* Team photos */}
                <section>
                    <h2 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">Team photos <span className="font-normal text-gray-400">(optional)</span></h2>
                    <TeamPhotosSection photos={config.teamPhotos} onChange={(p) => setConfig({ ...config, teamPhotos: p })} />
                </section>
            </div>
        </div>
    );
}

export default function InterviewGuidePage() {
    return (
        <AuthGuard requiredRole="COMPANY">
            <InterviewGuideEditor />
        </AuthGuard>
    );
}
