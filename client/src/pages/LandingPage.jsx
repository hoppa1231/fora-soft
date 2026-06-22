import { Video } from "lucide-react";
import { useState } from "react";
import { createRoomId, isValidRoomId, validateDisplayName } from "../utils/validation.js";

export function LandingPage({ inviteRoomId, onEnterRoom }) {
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const isInvite = Boolean(inviteRoomId);

  const submit = (event) => {
    event.preventDefault();
    const result = validateDisplayName(displayName);

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
        <h1 id="entry-title">Видеочат-комната</h1>
        <p>
          {isInvite
            ? "Введите имя, чтобы присоединиться к комнате."
            : "Введите имя и создайте ссылку для звонка до четырёх участников."}
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
            placeholder="Алекс"
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
