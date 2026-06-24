import { useEffect, useRef, useState } from "react";

const TOAST_TTL_MS = 3000;

export function ToastStack({ messages }) {
  const [visibleMessages, setVisibleMessages] = useState([]);
  const seenRef = useRef(new Set());

  useEffect(() => {
    for (const item of messages.filter(Boolean)) {
      const toast = typeof item === "string" ? { id: item, text: item } : item;

      if (!toast?.text || seenRef.current.has(toast.id)) {
        continue;
      }

      seenRef.current.add(toast.id);
      setVisibleMessages((current) => [...current, toast]);

      window.setTimeout(() => {
        setVisibleMessages((current) => current.filter((visible) => visible.id !== toast.id));
      }, TOAST_TTL_MS);
    }
  }, [messages]);

  if (visibleMessages.length === 0) {
    return null;
  }

  return (
    <div className="toast-stack" aria-live="polite" aria-label="Уведомления">
      {visibleMessages.map((message) => (
        <div className="toast" key={message.id}>
          {message.text}
        </div>
      ))}
    </div>
  );
}
