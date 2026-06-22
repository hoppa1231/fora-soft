import { LogIn, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { ParticipantTile } from "../components/ParticipantTile.jsx";
import { ToastStack } from "../components/ToastStack.jsx";
import { useLocalMedia } from "../hooks/useLocalMedia.js";

export function PreJoinPage({ displayName, roomId, onBack, onJoin }) {
  const localMedia = useLocalMedia();
  const canJoin = localMedia.status === "ready";
  const previewParticipant = {
    id: "preview",
    displayName,
    audioEnabled: localMedia.mediaState.audioEnabled,
    videoEnabled: localMedia.mediaState.videoEnabled,
    isLocal: true,
    mirrorVideo: true
  };

  const join = () => {
    onJoin({
      mediaPreferences: localMedia.mediaState
    });
  };

  const back = () => {
    localMedia.stopAll();
    onBack();
  };

  if (localMedia.status === "unsupported") {
    return (
      <main className="room-state">
        <h1>WebRTC не поддерживается</h1>
        <p>Откройте приложение в современном Chrome, Firefox или Edge.</p>
        <button className="secondary-button" onClick={back}>Назад</button>
      </main>
    );
  }

  return (
    <main className="prejoin">
      <ToastStack messages={localMedia.messages.map((message, index) => ({ id: `prejoin-media-${index}-${message}`, text: message }))} />
      <section className="prejoin__content" aria-labelledby="prejoin-title">
        <div className="prejoin__header">
          <h1 id="prejoin-title">Готовы войти?</h1>
          <p>Комната: <span>{roomId}</span></p>
        </div>

        <div className="prejoin__preview">
          <ParticipantTile participant={previewParticipant} stream={localMedia.stream} />
        </div>

        <div className="prejoin__controls" aria-label="Настройки перед входом">
          <button className="icon-button" type="button" onClick={localMedia.toggleAudio} title={localMedia.mediaState.audioEnabled ? "Выключить микрофон" : "Включить микрофон"}>
            {localMedia.mediaState.audioEnabled ? <Mic aria-hidden="true" strokeWidth={1.75} /> : <MicOff aria-hidden="true" strokeWidth={1.75} />}
          </button>
          <button className="icon-button" type="button" onClick={localMedia.toggleVideo} title={localMedia.mediaState.videoEnabled ? "Выключить камеру" : "Включить камеру"}>
            {localMedia.mediaState.videoEnabled ? <Video aria-hidden="true" strokeWidth={1.75} /> : <VideoOff aria-hidden="true" strokeWidth={1.75} />}
          </button>
          <button className="primary-button prejoin__join" type="button" disabled={!canJoin} onClick={join}>
            <LogIn aria-hidden="true" size={18} strokeWidth={1.75} />
            Войти в комнату
          </button>
          <button className="secondary-button" type="button" onClick={back}>Назад</button>
        </div>
      </section>
    </main>
  );
}
