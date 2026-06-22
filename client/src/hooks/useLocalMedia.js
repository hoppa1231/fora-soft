import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function supportsWebRtc() {
  return Boolean(window.RTCPeerConnection && navigator.mediaDevices?.getUserMedia);
}

function mediaStateFromStream(stream) {
  const audioTrack = stream?.getAudioTracks()[0] ?? null;
  const videoTrack = stream?.getVideoTracks()[0] ?? null;

  return {
    audioEnabled: Boolean(audioTrack && audioTrack.enabled && audioTrack.readyState === "live"),
    videoEnabled: Boolean(videoTrack && videoTrack.readyState === "live")
  };
}

function cloneStreamWithTracks(tracks) {
  return new MediaStream(tracks.filter(Boolean));
}

export function useLocalMedia({ initialAudioEnabled = true, initialVideoEnabled = true } = {}) {
  const [stream, setStream] = useState(null);
  const [status, setStatus] = useState("requesting");
  const [messages, setMessages] = useState([]);
  const [screenSharing, setScreenSharing] = useState(false);
  const streamRef = useRef(null);
  const screenTrackRef = useRef(null);

  const setManagedStream = useCallback((nextStream) => {
    streamRef.current = nextStream;
    setStream(nextStream);
  }, []);

  const replaceVideoTrack = useCallback((nextTrack) => {
    const current = streamRef.current ?? new MediaStream();
    const tracks = current.getTracks().filter((track) => track.kind !== "video");
    setManagedStream(cloneStreamWithTracks(nextTrack ? [...tracks, nextTrack] : tracks));
  }, [setManagedStream]);

  const attachTrackEnded = useCallback((track, options = {}) => {
    track.onended = () => {
      const current = streamRef.current;
      if (!current) return;
      const liveTracks = current.getTracks().filter((item) => item !== track && item.readyState === "live");
      setManagedStream(cloneStreamWithTracks(liveTracks));
      if (options.screen) {
        screenTrackRef.current = null;
        setScreenSharing(false);
      }
    };
  }, [setManagedStream]);

  useEffect(() => {
    let cancelled = false;

    async function requestInitialMedia() {
      if (!supportsWebRtc()) {
        setStatus("unsupported");
        setMessages(["Ваш браузер не поддерживает WebRTC."]);
        return;
      }

      const tracks = [];
      const nextMessages = [];

      const requestedKinds = [
        initialAudioEnabled ? "audio" : null,
        initialVideoEnabled ? "video" : null
      ].filter(Boolean);

      for (const kind of requestedKinds) {
        try {
          const requestedStream = await navigator.mediaDevices.getUserMedia({ [kind]: true });
          const track = kind === "audio"
            ? requestedStream.getAudioTracks()[0]
            : requestedStream.getVideoTracks()[0];

          if (track) {
            attachTrackEnded(track);
            tracks.push(track);
          }
        } catch (error) {
          const label = kind === "audio" ? "микрофону" : "камере";
          nextMessages.push(`Нет доступа к ${label} или устройство недоступно.`);
        }
      }

      if (cancelled) {
        tracks.forEach((track) => track.stop());
        return;
      }

      setManagedStream(cloneStreamWithTracks(tracks));
      setMessages(nextMessages);
      setStatus("ready");
    }

    requestInitialMedia();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [attachTrackEnded, initialAudioEnabled, initialVideoEnabled, setManagedStream]);

  const toggleAudio = useCallback(async () => {
    const current = streamRef.current ?? new MediaStream();
    const audioTrack = current.getAudioTracks()[0];

    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setManagedStream(cloneStreamWithTracks(current.getTracks()));
      return;
    }

    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const nextTrack = audioStream.getAudioTracks()[0];
      attachTrackEnded(nextTrack);
      setManagedStream(cloneStreamWithTracks([...current.getTracks(), nextTrack]));
    } catch {
      setMessages((items) => [...items, "Не удалось включить микрофон."]);
    }
  }, [attachTrackEnded, setManagedStream]);

  const toggleVideo = useCallback(async () => {
    const current = streamRef.current ?? new MediaStream();
    const videoTrack = current.getVideoTracks()[0];

    if (videoTrack) {
      videoTrack.stop();
      replaceVideoTrack(null);
      screenTrackRef.current = null;
      setScreenSharing(false);
      return;
    }

    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const nextTrack = videoStream.getVideoTracks()[0];
      attachTrackEnded(nextTrack);
      replaceVideoTrack(nextTrack);
    } catch {
      setMessages((items) => [...items, "Не удалось включить камеру."]);
    }
  }, [attachTrackEnded, replaceVideoTrack]);

  const toggleScreenShare = useCallback(async () => {
    if (screenTrackRef.current) {
      screenTrackRef.current.stop();
      screenTrackRef.current = null;
      replaceVideoTrack(null);
      setScreenSharing(false);
      return;
    }

    if (!navigator.mediaDevices?.getDisplayMedia) {
      setMessages((items) => [...items, "Браузер не поддерживает трансляцию экрана."]);
      return;
    }

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const screenTrack = displayStream.getVideoTracks()[0];
      const currentVideoTrack = streamRef.current?.getVideoTracks()[0];

      if (currentVideoTrack) {
        currentVideoTrack.stop();
      }

      screenTrackRef.current = screenTrack;
      attachTrackEnded(screenTrack, { screen: true });
      replaceVideoTrack(screenTrack);
      setScreenSharing(true);
    } catch {
      setMessages((items) => [...items, "Не удалось начать трансляцию экрана."]);
    }
  }, [attachTrackEnded, replaceVideoTrack]);

  const stopAll = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    screenTrackRef.current = null;
    setScreenSharing(false);
    setManagedStream(new MediaStream());
  }, [setManagedStream]);

  const mediaState = useMemo(() => mediaStateFromStream(stream), [stream]);

  return {
    stream,
    status,
    messages,
    mediaState,
    screenSharing,
    toggleAudio,
    toggleScreenShare,
    toggleVideo,
    stopAll
  };
}
