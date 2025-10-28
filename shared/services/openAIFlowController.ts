/**
 * openAIFlowController: deterministic conversational stage helper.
 * - Encodes Greeting → Background → Coding → Submission → Wrap‑up.
 * - Sends system nudges via session.transport; exposes minimal stage API.
 */
export type FlowStage =
    | "greeting"
    | "background"
    | "coding"
    | "submission"
    | "wrapup";

export function openAIFlowController() {
    let stage: FlowStage = "greeting";

    const getStage = () => stage;

    const greet = (session: any, candidateName: string) => {
        send(
            session,
            `You are Carrie, an AI interviewer. Greet ${candidateName} warmly and ask if they are ready to begin.`
        );
        stage = "background"; // proceed to background after greeting prompt is sent
    };

    const askBackgroundProject = (session: any) => {
        send(
            session,
            "Ask one question about a concrete project the candidate built (≤2 sentences). After asking, wait silently for the answer."
        );
        stage = "background";
    };

    const acknowledgeAndMoveToCoding = (session: any) => {
        send(
            session,
            "Acknowledge briefly. If you have sufficient background evidence, say you are ready to proceed and move to the coding task."
        );
        stage = "coding";
    };

    const presentCodingTask = (session: any, taskText: string) => {
        send(
            session,
            `Present the coding task concisely: ${taskText}. Ask if any clarification is needed, then wait.`
        );
        stage = "coding";
    };

    const acknowledgeSubmissionAndWrap = (session: any) => {
        send(session, "Thanks for submitting. I will wrap up now.");
        stage = "wrapup";
    };

    const closeInterview = (session: any) => {
        send(session, "Thank you for your time. We will be in touch. Goodbye.");
        stage = "wrapup";
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
        askBackgroundProject,
        acknowledgeAndMoveToCoding,
        presentCodingTask,
        acknowledgeSubmissionAndWrap,
        closeInterview,
    };
}
