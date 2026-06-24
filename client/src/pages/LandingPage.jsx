import { Video } from "lucide-react";
import { useState } from "react";
import { createRoomId, validateRoomName } from "../utils/validation.js";

export function LandingPage({ onCreateRoom }) {
  const [roomName, setRoomName] = useState("");
  const [error, setError] = useState("");

  const submit = (event) => {
    event.preventDefault();
    const result = validateRoomName(roomName);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    onCreateRoom({
      roomId: createRoomId(),
      roomName: result.value
    });
  };

  return (
    <main className="entry">
      <section className="entry__panel" aria-labelledby="entry-title">
        <div className="entry__mark">
          <Video aria-hidden="true" size={28} />
        </div>
        <h1 id="entry-title">Простецкий видеочат</h1>
        <form className="entry__form" onSubmit={submit}>
          <input
            aria-label="Имя комнаты"
            autoFocus
            maxLength={30}
            value={roomName}
            onChange={(event) => {
              setRoomName(event.target.value);
              setError("");
            }}
            placeholder="Имя комнаты"
          />
          {error ? <div className="form-error">{error}</div> : null}
          <button className="primary-button" type="submit">
            Создать комнату
          </button>
        </form>
      </section>
    </main>
  );
}
