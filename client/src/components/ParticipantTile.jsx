import { MicOff, UserRound, VideoOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function ParticipantTile({ participant, stream }) {
  const videoRef = useRef(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const hasVideo = Boolean(stream?.getVideoTracks().some((track) => track.readyState === "live"));
  const hasBadges = !participant.audioEnabled || !participant.videoEnabled;
  const mirrorVideo = participant.isLocal && participant.mirrorVideo !== false;

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream ?? null;
    }
  }, [stream]);

  useEffect(() => {
    const audioTrack = stream?.getAudioTracks().find((track) => track.readyState === "live");

    if (!audioTrack || !participant.audioEnabled) {
      setIsSpeaking(false);
      return undefined;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return undefined;
    }

    const audioContext = new AudioContextClass();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;

    const source = audioContext.createMediaStreamSource(new MediaStream([audioTrack]));
    source.connect(analyser);

    const data = new Uint8Array(analyser.fftSize);
    let intervalId = 0;
    let quietFrames = 0;
    let smoothedLevel = 0;
    let speaking = false;

    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;

      for (const value of data) {
        const normalized = (value - 128) / 128;
        sum += normalized * normalized;
      }

      const rms = Math.sqrt(sum / data.length);
      smoothedLevel = smoothedLevel * 0.62 + rms * 0.38;

      if (smoothedLevel > 0.022) {
        quietFrames = 0;
        if (!speaking) {
          speaking = true;
          setIsSpeaking(true);
        }
      } else if (smoothedLevel < 0.013) {
        quietFrames += 1;
      }

      if (speaking && quietFrames >= 3) {
        speaking = false;
        setIsSpeaking(false);
      }
    };

    intervalId = window.setInterval(tick, 80);

    return () => {
      window.clearInterval(intervalId);
      source.disconnect();
      audioContext.close();
      setIsSpeaking(false);
    };
  }, [participant.audioEnabled, stream]);

  return (
    <article className={`participant-tile ${isSpeaking ? "participant-tile--speaking" : ""}`}>
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={participant.isLocal}
          className={`participant-tile__video ${mirrorVideo ? "participant-tile__video--mirrored" : ""}`}
        />
      ) : (
        <div className="participant-tile__placeholder">
          <UserRound aria-hidden="true" size={64} />
        </div>
      )}

      <div className="participant-tile__overlay">
        <span className="participant-tile__name">
          {participant.displayName}{participant.isLocal ? " (вы)" : ""}
        </span>
        {hasBadges ? (
          <span className="participant-tile__badges">
            {!participant.audioEnabled ? <MicOff aria-label="Микрофон выключен" size={18} strokeWidth={1.75} /> : null}
            {!participant.videoEnabled ? <VideoOff aria-label="Камера выключена" size={18} strokeWidth={1.75} /> : null}
          </span>
        ) : null}
      </div>
    </article>
  );
}
