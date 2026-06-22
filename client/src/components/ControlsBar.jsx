import { AudioLines, Link2, LogOut, MessageSquare, MessageSquareOff, Mic, MicOff, MonitorUp, ScreenShareOff, Video, VideoOff } from "lucide-react";
import { useState } from "react";
import { SOUND_EFFECTS } from "../utils/soundEffects.js";

export function ControlsBar({
  audioEnabled,
  chatOpen,
  screenSharing,
  videoEnabled,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onToggleChat,
  onCopyInvite,
  onPlaySound,
  onLeave
}) {
  const [soundboardOpen, setSoundboardOpen] = useState(false);

  return (
    <div className="controls" aria-label="Управление звонком">
      <button className="icon-button" type="button" onClick={onToggleAudio} title={audioEnabled ? "Выключить микрофон" : "Включить микрофон"}>
        {audioEnabled ? <Mic aria-hidden="true" strokeWidth={1.35} /> : <MicOff aria-hidden="true" strokeWidth={1.35} />}
      </button>
      <button className="icon-button" type="button" onClick={onToggleVideo} title={videoEnabled ? "Выключить камеру" : "Включить камеру"}>
        {videoEnabled ? <Video aria-hidden="true" strokeWidth={1.35} /> : <VideoOff aria-hidden="true" strokeWidth={1.35} />}
      </button>
      <button className={`icon-button ${screenSharing ? "icon-button--active" : ""}`} type="button" onClick={onToggleScreenShare} title={screenSharing ? "Остановить трансляцию экрана" : "Транслировать экран"}>
        {screenSharing ? <ScreenShareOff aria-hidden="true" strokeWidth={1.35} /> : <MonitorUp aria-hidden="true" strokeWidth={1.35} />}
      </button>
      <button className="icon-button" type="button" onClick={onCopyInvite} title="Скопировать ссылку">
        <Link2 aria-hidden="true" strokeWidth={1.35} />
      </button>
      <div className="soundboard">
        <button className={`icon-button ${soundboardOpen ? "icon-button--active" : ""}`} type="button" onClick={() => setSoundboardOpen((value) => !value)} title="Саундпад">
          <AudioLines aria-hidden="true" strokeWidth={1.35} />
        </button>
        {soundboardOpen ? (
          <div className="soundboard__menu" aria-label="Саундпад">
            {SOUND_EFFECTS.map((effect) => (
              <button
                className="soundboard__item"
                key={effect.id}
                type="button"
                onClick={() => {
                  onPlaySound(effect.id);
                  setSoundboardOpen(false);
                }}
              >
                {effect.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <button className="icon-button" type="button" onClick={onToggleChat} title={chatOpen ? "Скрыть чат" : "Показать чат"}>
        {chatOpen ? <MessageSquareOff aria-hidden="true" strokeWidth={1.35} /> : <MessageSquare aria-hidden="true" strokeWidth={1.35} />}
      </button>
      <button className="icon-button icon-button--danger" type="button" onClick={onLeave} title="Выйти">
        <LogOut aria-hidden="true" strokeWidth={1.35} />
      </button>
    </div>
  );
}
