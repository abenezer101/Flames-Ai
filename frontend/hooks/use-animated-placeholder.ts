"use client";

import { useState, useEffect } from "react";

const placeholders = [
  "Make me an ecommerce site",
  "Make a landing page for my mobile app",
  "Build a music player",
  "Create a real-time chat application",
  "Build a task management tool",
  "Make a portfolio website",
];

export function useAnimatedPlaceholder() {
  const [placeholder, setPlaceholder] = useState(placeholders[0]);
  const [displayedText, setDisplayedText] = useState("");
  const [index, setIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    if (isTyping) {
      // Typing animation
      if (displayedText.length < placeholder.length) {
        timeout = setTimeout(() => {
          setDisplayedText((prev) => prev + placeholder[displayedText.length]);
        }, 50);
      } else {
        // Pause before moving to next
        timeout = setTimeout(() => {
          setIsTyping(false);
        }, 2000);
      }
    } else {
      // Deleting animation
      if (displayedText.length > 0) {
        timeout = setTimeout(() => {
          setDisplayedText((prev) => prev.slice(0, -1));
        }, 30);
      } else {
        // Move to next placeholder
        setIndex((prev) => (prev + 1) % placeholders.length);
        setPlaceholder(placeholders[(index + 1) % placeholders.length]);
        setIsTyping(true);
      }
    }

    return () => clearTimeout(timeout);
  }, [displayedText, isTyping, placeholder, index]);

  return displayedText;
}
