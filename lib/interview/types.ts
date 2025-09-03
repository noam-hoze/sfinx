export interface InterviewTask {
    id: string;
    title: string;
    description: string;
    requirements: string[];
    expectedSolution?: string;
    completed: boolean;
    started: boolean;
}

export interface InterviewState {
    currentTaskId: string | null;
    tasks: InterviewTask[];
    isActive: boolean;
    candidateName: string;
    startTime: Date | null;
    endTime: Date | null;
    // Avatar state
    avatarVisible: boolean;
    avatarPosition: { x: number; y: number };
    isAvatarSpeaking: boolean;
}

export interface InterviewMessage {
    id: string;
    type: "ai" | "user" | "system";
    content: string;
    timestamp: Date;
    taskId?: string;
    codeSnippet?: string;
}

export interface InterviewContextType {
    state: InterviewState;
    messages: InterviewMessage[];
    startInterview: () => void;
    endInterview: () => void;
    nextTask: () => void;
    addMessage: (message: InterviewMessage) => void;
    updateTaskStatus: (taskId: string, status: "started" | "completed") => void;
    getCurrentTask: () => InterviewTask | null;
    // Avatar methods
    showAvatar: () => void;
    hideAvatar: () => void;
    updateAvatarPosition: (x: number, y: number) => void;
    startAvatarSpeaking: () => void;
    stopAvatarSpeaking: () => void;
}

export const GAL_TASKS: InterviewTask[] = [
    {
        id: "task1-userlist",
        title: "Build UserList Component",
        description:
            "Build a React component called `UserList` that fetches users from https://jsonplaceholder.typicode.com/users and displays their name and email in a styled list.",
        requirements: [
            "Fetch data from the JSONPlaceholder API",
            "Display user names and emails",
            "Add proper loading and error states",
            "Style the list with appropriate spacing and typography",
            "Handle API errors gracefully",
        ],
        completed: false,
        started: false,
    },
    {
        id: "task2-counter-debug",
        title: "Debug Counter Component",
        description:
            "You are given a React component with a failing test. The test expects a button click to update the counter, but it stays at 0. Fix the bug so that the test passes.",
        requirements: [
            "Identify the state management issue",
            "Implement useState correctly",
            "Update the onClick handler properly",
            "Ensure the test passes",
        ],
        completed: false,
        started: false,
    },
];

export const BUGGY_COUNTER_CODE = `function Counter() {
  let count = 0;

  function increment() {
    count++;
  }

  return (
    <div>
      <p>{count}</p>
      <button onClick={increment}>Add</button>
    </div>
  );
}`;
