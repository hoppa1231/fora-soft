import { SendHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatLocalTime, validateMessage } from "../utils/validation.js";

export function ChatPanel({ open, messages, participants, onClose, onSendMessage }) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const submit = (event) => {
    event.preventDefault();
    sendDraft();
  };

  const sendDraft = () => {
    const result = validateMessage(draft);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    onSendMessage(result.value);
    setDraft("");
    setError("");
  };

  const handleKeyDown = (event) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    sendDraft();
  };

  return (
    <aside className={`chat-panel ${open ? "chat-panel--open" : "chat-panel--closed"}`} aria-hidden={!open} aria-label="Чат и участники">
      <button className="chat-panel__close" type="button" onClick={onClose} title="Закрыть чат">
        <X aria-hidden="true" size={18} strokeWidth={1.6} />
      </button>

      <section className="participants-list" aria-labelledby="participants-title">
        <h2 id="participants-title">Участники</h2>
        <ul>
          {participants.map((participant) => (
            <li key={participant.id}>{participant.displayName}</li>
          ))}
        </ul>
      </section>

      <section className="chat-panel__messages" aria-labelledby="chat-title">
        <h2 id="chat-title">Чат</h2>
        <div className="message-list" ref={listRef}>
          {messages.map((message) => (
            <div className={`message message--${message.type}`} key={message.id}>
              {message.type === "user" ? (
                <div className="message__meta">
                  <strong>{message.senderName}</strong>
                  <span>{formatLocalTime(message.createdAt)}</span>
                </div>
              ) : null}
              <div className="message__text">{message.text}</div>
            </div>
          ))}
        </div>
      </section>

      <form className="chat-form" onSubmit={submit}>
        <label className="sr-only" htmlFor="chat-message">Сообщение</label>
        <textarea
          id="chat-message"
          rows={1}
          value={draft}
          onKeyDown={handleKeyDown}
          onChange={(event) => {
            setDraft(event.target.value);
            setError("");
          }}
          placeholder="Сообщение"
        />
        <button className="icon-button" type="submit" title="Отправить">
          <SendHorizontal aria-hidden="true" />
        </button>
        {error ? <div className="form-error chat-form__error">{error}</div> : null}
      </form>
    </aside>
  );
}
