import { useEffect, useMemo, useState } from "react";
import { ChatPanel } from "../components/ChatPanel.jsx";
import { ControlsBar } from "../components/ControlsBar.jsx";
import { ToastStack } from "../components/ToastStack.jsx";
import { VideoGrid } from "../components/VideoGrid.jsx";
import { useLocalMedia } from "../hooks/useLocalMedia.js";
import { usePeerConnections } from "../hooks/usePeerConnections.js";
import { useSocketRoom } from "../hooks/useSocketRoom.js";
import { playSoundEffect } from "../utils/soundEffects.js";

export function RoomPage({ roomId, roomName, displayName, initialMediaPreferences, onLeave }) {
  const localMedia = useLocalMedia({
    initialAudioEnabled: initialMediaPreferences?.audioEnabled ?? true,
    initialVideoEnabled: initialMediaPreferences?.videoEnabled ?? true
  });
  const socketEnabled = localMedia.status === "ready";
  const socketRoom = useSocketRoom({
    roomId,
    roomName,
    displayName,
    enabled: socketEnabled,
    initialMediaState: localMedia.mediaState
  });
  const { consumeSoundEffect, sendMediaState, soundEffects } = socketRoom;
  const [uiToasts, setUiToasts] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const joined = socketRoom.status === "joined";
  const publishedMediaState = useMemo(() => ({
    audioEnabled: localMedia.mediaState.audioEnabled,
    videoEnabled: localMedia.mediaState.videoEnabled || localMedia.screenSharing,
    screenSharing: localMedia.screenSharing
  }), [localMedia.mediaState.audioEnabled, localMedia.mediaState.videoEnabled, localMedia.screenSharing]);
  const peers = usePeerConnections({
    participantId: socketRoom.participantId,
    existingParticipants: socketRoom.existingParticipants,
    localStream: localMedia.stream,
    signals: socketRoom.signals,
    consumeSignal: socketRoom.consumeSignal,
    sendSignal: socketRoom.sendSignal,
    joined
  });

  useEffect(() => {
    if (joined) {
      sendMediaState(publishedMediaState);
    }
  }, [joined, publishedMediaState, sendMediaState]);

  useEffect(() => {
    for (const effect of soundEffects) {
      playSoundEffect(effect.effectId);
      consumeSoundEffect(effect);
    }
  }, [consumeSoundEffect, soundEffects]);

  const currentParticipant = useMemo(() => ({
    id: socketRoom.participantId ?? "local",
    displayName,
    audioEnabled: publishedMediaState.audioEnabled,
    videoEnabled: publishedMediaState.videoEnabled,
    screenSharing: publishedMediaState.screenSharing,
    isLocal: true
  }), [displayName, publishedMediaState.audioEnabled, publishedMediaState.screenSharing, publishedMediaState.videoEnabled, socketRoom.participantId]);

  const participants = useMemo(() => {
    const remoteParticipants = socketRoom.participants.filter((participant) => participant.id !== socketRoom.participantId);
    return [currentParticipant, ...remoteParticipants];
  }, [currentParticipant, socketRoom.participantId, socketRoom.participants]);

  const toastMessages = useMemo(() => [
    ...localMedia.messages.map((message, index) => ({ id: `media-${index}-${message}`, text: message })),
    ...Object.entries(peers.connectionIssues).map(([id, text]) => ({ id: `peer-${id}-${text}`, text })),
    ...uiToasts
  ], [localMedia.messages, peers.connectionIssues, uiToasts]);

  const leave = () => {
    setLeaving(true);
    window.setTimeout(() => {
      peers.closeAll();
      localMedia.stopAll();
      socketRoom.leave();
      onLeave();
    }, 180);
  };

  const copyInvite = async () => {
    const id = crypto.randomUUID();
    try {
      await navigator.clipboard.writeText(window.location.href);
      setUiToasts((items) => [...items, { id, text: "Ссылка скопирована" }]);
    } catch {
      setUiToasts((items) => [...items, { id, text: "Не удалось скопировать ссылку" }]);
    }

    window.setTimeout(() => {
      setUiToasts((items) => items.filter((toast) => toast.id !== id));
    }, 3000);
  };

  if (localMedia.status === "unsupported") {
    return (
      <main className="room-state">
        <h1>WebRTC не поддерживается</h1>
        <p>Откройте приложение в современном Chrome, Firefox или Edge.</p>
        <button className="secondary-button" onClick={onLeave}>Назад</button>
      </main>
    );
  }

  if (socketRoom.status === "room-full") {
    return (
      <main className="room-state">
        <h1>Комната заполнена</h1>
        <p>В комнате уже 4 участника.</p>
        <button className="primary-button" onClick={() => window.location.reload()}>Повторить вход</button>
        <button className="secondary-button" onClick={onLeave}>Назад</button>
      </main>
    );
  }

  if (socketRoom.status === "server-error" || socketRoom.status === "error") {
    return (
      <main className="room-state">
        <h1>Ошибка подключения</h1>
        <p>{socketRoom.error || "Сигнальный сервер недоступен."}</p>
        <button className="primary-button" onClick={() => window.location.reload()}>Повторить вход</button>
        <button className="secondary-button" onClick={onLeave}>Назад</button>
      </main>
    );
  }

  const isConnecting = localMedia.status === "requesting" || socketRoom.status === "connecting" || socketRoom.status === "idle";
  const roomLabel = socketRoom.roomName || roomName || roomId;

  return (
    <main className={`room-shell ${chatOpen ? "room-shell--chat-open" : "room-shell--chat-closed"} ${leaving ? "room-shell--leaving" : ""}`}>
      <ToastStack messages={toastMessages} />
      <section className="room-main" aria-label="Видеозвонок">
        <div className="room-main__notices">
          {isConnecting ? <div className="loading-banner">Подключаем комнату...</div> : null}
        </div>
        <div className="room-main__stage">
          <VideoGrid
            localStream={localMedia.stream}
            participants={participants}
            remoteStreams={peers.remoteStreams}
          />
        </div>
        <div className="room-main__footer">
          <div className="room-main__room-name">{roomLabel}</div>
          <ControlsBar
            audioEnabled={localMedia.mediaState.audioEnabled}
            chatOpen={chatOpen}
            screenShareSupported={localMedia.screenShareSupported}
            screenSharing={localMedia.screenSharing}
            videoEnabled={localMedia.mediaState.videoEnabled}
            onCopyInvite={copyInvite}
            onLeave={leave}
            onPlaySound={socketRoom.sendSoundEffect}
            onToggleChat={() => setChatOpen((value) => !value)}
            onToggleAudio={localMedia.toggleAudio}
            onToggleScreenShare={localMedia.toggleScreenShare}
            onToggleVideo={localMedia.toggleVideo}
          />
        </div>
      </section>
      <ChatPanel
        open={chatOpen}
        messages={socketRoom.messages}
        onClose={() => setChatOpen(false)}
        participants={socketRoom.participants}
        onSendMessage={socketRoom.sendMessage}
      />
    </main>
  );
}
