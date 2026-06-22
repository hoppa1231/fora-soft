import { Video } from "lucide-react";
import { useState } from "react";
import { createGuestName, createRoomId, isValidRoomId, validateDisplayName } from "../utils/validation.js";

export function LandingPage({ inviteRoomId, onEnterRoom }) {
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const isInvite = Boolean(inviteRoomId);

  const submit = (event) => {
    event.preventDefault();
    const name = displayName.trim();
    const result = name ? validateDisplayName(name) : { ok: true, value: createGuestName() };

    if (!result.ok) {
      setError(result.message);
      return;
    }

    if (isInvite && !isValidRoomId(inviteRoomId)) {
      setError("Некорректная ссылка на комнату");
      return;
    }

    onEnterRoom({
      displayName: result.value,
      roomId: isInvite ? inviteRoomId : createRoomId()
    });
  };

  return (
    <main className="entry">
      <section className="entry__panel" aria-labelledby="entry-title">
        <div className="entry__mark">
          <Video aria-hidden="true" size={28} />
        </div>
        <h1 id="entry-title">Простецкий видеочат</h1>
        <p>
          {isInvite
            ? "Можно сразу присоединиться или указать имя перед входом."
            : "Можно сразу создать комнату или указать имя перед звонком."}
        </p>

        <form className="entry__form" onSubmit={submit}>
          <label htmlFor="display-name">Имя</label>
          <input
            id="display-name"
            autoFocus
            maxLength={30}
            value={displayName}
            onChange={(event) => {
              setDisplayName(event.target.value);
              setError("");
            }}
            placeholder="Максим (опционально)"
          />
          {error ? <div className="form-error">{error}</div> : null}
          <button className="primary-button" type="submit">
            {isInvite ? "Войти" : "Создать комнату"}
          </button>
        </form>
      </section>
    </main>
  );
}
