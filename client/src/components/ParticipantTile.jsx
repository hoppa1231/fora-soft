import { MicOff, UserRound, VideoOff, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function ParticipantTile({ participant, stream, volume = 100, onVolumeChange }) {
  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const hasVideo = participant.videoEnabled && Boolean(stream?.getVideoTracks().some((track) => track.readyState === "live"));
  const hasBadges = !participant.audioEnabled || !participant.videoEnabled;
  const audioTrack = stream?.getAudioTracks().find((track) => track.readyState === "live");
  const canPlayAudio = !participant.isLocal && participant.audioEnabled && Boolean(audioTrack);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream ?? null;
      videoRef.current.play().catch(() => {});
    }
  }, [hasVideo, stream]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.srcObject = canPlayAudio ? new MediaStream([audioTrack]) : null;
    audio.volume = Math.min(Math.max(volume, 0), 100) / 100;
    audio.muted = !canPlayAudio || volume === 0;

    if (canPlayAudio) {
      audio.play().catch(() => {});
    }
  }, [audioTrack, canPlayAudio, volume]);

  useEffect(() => {
    if (!canPlayAudio || volume <= 100) {
      return undefined;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return undefined;
    }

    const audioContext = new AudioContextClass();
    const source = audioContext.createMediaStreamSource(new MediaStream([audioTrack]));
    const gain = audioContext.createGain();
    gain.gain.value = Math.min(volume - 100, 100) / 100;
    source.connect(gain).connect(audioContext.destination);

    const resume = () => audioContext.resume().catch(() => {});
    resume();
    window.addEventListener("pointerdown", resume, { once: true });
    window.addEventListener("keydown", resume, { once: true });

    return () => {
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
      source.disconnect();
      gain.disconnect();
      audioContext.close();
    };
  }, [audioTrack, canPlayAudio, volume]);

  useEffect(() => {
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
  }, [audioTrack, participant.audioEnabled]);

  return (
    <article className={`participant-tile ${isSpeaking ? "participant-tile--speaking" : ""}`}>
      {!participant.isLocal ? <audio ref={audioRef} autoPlay playsInline /> : null}

      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="participant-tile__video"
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

      {!participant.isLocal ? (
        <label className="participant-tile__volume">
          {volume === 0 ? <VolumeX aria-hidden="true" size={15} strokeWidth={1.5} /> : <Volume2 aria-hidden="true" size={15} strokeWidth={1.5} />}
          <input
            aria-label={`Громкость ${participant.displayName}`}
            max="200"
            min="0"
            onChange={(event) => onVolumeChange?.(Number(event.target.value))}
            step="10"
            type="range"
            value={volume}
          />
          <span>{volume}</span>
        </label>
      ) : null}
    </article>
  );
}
