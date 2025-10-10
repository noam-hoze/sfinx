export type FlowStage =
    | "awaiting_ready"
    | "background_asked"
    | "background_done";

export function openAIFlowController() {
    let stage: FlowStage = "awaiting_ready";

    const getStage = () => stage;

    const greet = (session: any, candidateName: string) => {
        send(
            session,
            `You are Carrie, an AI interviewer. Greet ${candidateName} warmly and ask if they are ready to begin.`
        );
        stage = "awaiting_ready";
    };

    const onUserFinal = (session: any) => {
        if (stage === "awaiting_ready") return askBackground(session);
        if (stage === "background_asked") return acknowledgeBackground(session);
        return false;
    };

    const askBackground = (session: any) => {
        send(
            session,
            "Ask one background question about the candidate’s experience. Keep it ≤2 sentences. After asking, wait silently for their answer."
        );
        stage = "background_asked";
        return true;
    };

    const acknowledgeBackground = (session: any) => {
        send(
            session,
            "Acknowledge briefly in one sentence. Do not ask further background questions."
        );
        stage = "background_done";
        return true;
    };

    const send = (session: any, text: string) => {
        try {
            session?.transport?.sendEvent?.({
                type: "conversation.item.create",
                item: {
                    type: "message",
                    role: "system",
                    content: [{ type: "input_text", text }],
                },
            });
            session?.transport?.sendEvent?.({ type: "response.create" });
        } catch {}
    };

    return {
        getStage,
        greet,
        onUserFinal,
        askBackground,
        acknowledgeBackground,
    };
}
