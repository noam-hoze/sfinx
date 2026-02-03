import { useState, useEffect, useRef, useCallback } from "react";

type UseWordByWordAnimationOptions = {
  text: string;
  enabled?: boolean;
  wordsPerSecond?: number;
  onComplete?: () => void;
};

export function useWordByWordAnimation({
  text,
  enabled = true,
  wordsPerSecond = 3,
  onComplete,
}: UseWordByWordAnimationOptions) {
  const [displayedWords, setDisplayedWords] = useState<string[]>([]);
  const [isTypingComplete, setIsTypingComplete] = useState(false);
  const previousTextRef = useRef<string>("");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentIndexRef = useRef(0);
  const wordsRef = useRef<string[]>([]);
  const onCompleteRef = useRef(onComplete);

  // Keep onComplete callback up to date
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Function to smoothly complete the animation
  const completeAnimation = useCallback(() => {
    if (isTypingComplete) return;

    // Clear the interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Show all remaining words immediately
    setDisplayedWords(wordsRef.current);
    setIsTypingComplete(true);
    onCompleteRef.current?.();
  }, [isTypingComplete]);

  useEffect(() => {
    if (!enabled || !text) {
      return;
    }

    // Only start animation if text has changed
    if (previousTextRef.current === text) {
      return;
    }

    previousTextRef.current = text;

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Reset state when text changes
    setDisplayedWords([]);
    setIsTypingComplete(false);
    currentIndexRef.current = 0;

    const words = text.split(" ");
    wordsRef.current = words;
    const msPerWord = 1000 / wordsPerSecond;

    // Start typing animation
    intervalRef.current = setInterval(() => {
      if (currentIndexRef.current < words.length) {
        const wordToAdd = words[currentIndexRef.current];
        currentIndexRef.current++;

        setDisplayedWords((prev) => {
          // Prevent duplicates during re-renders
          if (prev.length > 0 && prev[prev.length - 1] === wordToAdd) {
            return prev;
          }
          return [...prev, wordToAdd];
        });
      } else {
        setIsTypingComplete(true);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        onCompleteRef.current?.();
      }
    }, msPerWord);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [text, enabled, wordsPerSecond]);

  return {
    displayedWords,
    isTypingComplete,
    displayedText: displayedWords.join(" "),
    completeAnimation,
  };
}
