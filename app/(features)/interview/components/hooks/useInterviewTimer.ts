import { useCallback, useEffect, useRef, useState } from "react";

interface UseInterviewTimerOptions {
    durationSeconds: number;
    onExpire: () => Promise<void> | void;
}

export const useInterviewTimer = ({
    durationSeconds,
    onExpire,
}: UseInterviewTimerOptions) => {
    const [timeLeft, setTimeLeft] = useState(durationSeconds);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const clearTimer = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    const resetTimer = useCallback(() => {
        setTimeLeft(durationSeconds);
    }, [durationSeconds]);

    const startTimer = useCallback(() => {
        clearTimer();
        resetTimer();
        setIsTimerRunning(true);
        intervalRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearTimer();
                    setIsTimerRunning(false);
                    void onExpire();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, [clearTimer, onExpire, resetTimer]);

    const stopTimer = useCallback(() => {
        clearTimer();
        setIsTimerRunning(false);
    }, [clearTimer]);

    useEffect(() => {
        if (isTimerRunning) {
            return;
        }
        setTimeLeft(durationSeconds);
    }, [durationSeconds, isTimerRunning]);

    useEffect(() => () => clearTimer(), [clearTimer]);

    const formatTime = useCallback((seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs
            .toString()
            .padStart(2, "0")}`;
    }, []);

    return {
        timeLeft,
        isTimerRunning,
        startTimer,
        stopTimer,
        resetTimer,
        formatTime,
    };
};
