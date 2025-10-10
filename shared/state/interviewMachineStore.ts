/**
 * Minimal Redux-style store for the interview FSM (greeting-only phase).
 * State changes are synchronous and observable via subscribe().
 */
export type InterviewState =
    | "idle"
    | "greeting_said_by_ai"
    | "greeting_responded_by_user"
    | "ended";

export type InterviewMachineState = {
    state: InterviewState;
    candidateName?: string;
};

type Action =
    | { type: "START"; candidateName: string }
    | { type: "AI_FINAL"; text: string }
    | { type: "USER_FINAL"; text: string }
    | { type: "END" }
    | { type: "RESET" };

function reducer(s: InterviewMachineState, a: Action): InterviewMachineState {
    switch (a.type) {
        case "START":
            return { ...s, candidateName: a.candidateName };
        case "AI_FINAL": {
            if (s.state === "idle") {
                const expected = `Hi ${
                    s.candidateName || "Candidate"
                }, I'm Carrie. I'll be the one interviewing today!`;
                if ((a.text || "").trim() === expected) {
                    return { ...s, state: "greeting_said_by_ai" };
                }
            }
            return s;
        }
        case "USER_FINAL": {
            if (s.state === "greeting_said_by_ai") {
                return { ...s, state: "greeting_responded_by_user" };
            }
            return s;
        }
        case "END":
            return { ...s, state: "ended" };
        case "RESET":
            return { state: "idle" };
        default:
            return s;
    }
}

type Listener = () => void;

function createStore(initial: InterviewMachineState) {
    let currentState = initial;
    let listeners: Listener[] = [];
    return {
        getState: () => currentState,
        dispatch: (action: Action) => {
            currentState = reducer(currentState, action);
            const current = listeners.slice();
            for (const l of current) l();
        },
        subscribe: (listener: Listener) => {
            listeners.push(listener);
            return () => {
                listeners = listeners.filter((l) => l !== listener);
            };
        },
    };
}

export const interviewMachineStore = createStore({ state: "idle" });
