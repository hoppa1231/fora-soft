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

function mediaConstraints(kind, deviceId) {
  return {
    [kind]: deviceId ? { deviceId: { exact: deviceId } } : true
  };
}

function createMirroredCameraTrack(sourceTrack) {
  const settings = sourceTrack.getSettings?.() ?? {};
  const width = settings.width || 640;
  const height = settings.height || 480;
  const frameRate = settings.frameRate || 30;
  const sourceStream = new MediaStream([sourceTrack]);
  const video = document.createElement("video");
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context || !canvas.captureStream) {
    return {
      track: sourceTrack,
      cleanup: () => sourceTrack.stop()
    };
  }

  canvas.width = width;
  canvas.height = height;
  video.muted = true;
  video.playsInline = true;
  video.srcObject = sourceStream;

  const outputStream = canvas.captureStream(frameRate);
  const outputTrack = outputStream.getVideoTracks()[0];
  let frameId = 0;
  let stopped = false;

  const drawFrame = () => {
    if (stopped || sourceTrack.readyState !== "live") {
      outputTrack.stop();
      return;
    }

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      context.save();
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      context.restore();
    }

    frameId = window.requestAnimationFrame(drawFrame);
  };

  video.play().catch(() => {});
  frameId = window.requestAnimationFrame(drawFrame);
  outputTrack.contentHint = sourceTrack.contentHint || "motion";
  sourceTrack.onended = () => outputTrack.stop();

  return {
    track: outputTrack,
    cleanup: () => {
      stopped = true;
      window.cancelAnimationFrame(frameId);
      video.pause();
      video.srcObject = null;
      sourceTrack.stop();
      outputTrack.stop();
    }
  };
}

export function useLocalMedia({ initialAudioEnabled = true, initialVideoEnabled = true } = {}) {
  const [stream, setStream] = useState(null);
  const [status, setStatus] = useState("requesting");
  const [messages, setMessages] = useState([]);
  const [screenSharing, setScreenSharing] = useState(false);
  const [audioInputs, setAudioInputs] = useState([]);
  const [videoInputs, setVideoInputs] = useState([]);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState("");
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState("");
  const streamRef = useRef(null);
  const screenTrackRef = useRef(null);
  const videoTrackCleanupsRef = useRef(new Map());

  const setManagedStream = useCallback((nextStream) => {
    streamRef.current = nextStream;
    setStream(nextStream);
  }, []);

  const replaceVideoTrack = useCallback((nextTrack) => {
    const current = streamRef.current ?? new MediaStream();
    const tracks = current.getTracks().filter((track) => track.kind !== "video");
    setManagedStream(cloneStreamWithTracks(nextTrack ? [...tracks, nextTrack] : tracks));
  }, [setManagedStream]);

  const replaceAudioTrack = useCallback((nextTrack) => {
    const current = streamRef.current ?? new MediaStream();
    const tracks = current.getTracks().filter((track) => track.kind !== "audio");
    setManagedStream(cloneStreamWithTracks(nextTrack ? [...tracks, nextTrack] : tracks));
  }, [setManagedStream]);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;

    const devices = await navigator.mediaDevices.enumerateDevices();
    const nextAudioInputs = devices.filter((device) => device.kind === "audioinput");
    const nextVideoInputs = devices.filter((device) => device.kind === "videoinput");

    setAudioInputs(nextAudioInputs);
    setVideoInputs(nextVideoInputs);
    setSelectedAudioDeviceId((value) => value || nextAudioInputs[0]?.deviceId || "");
    setSelectedVideoDeviceId((value) => value || nextVideoInputs[0]?.deviceId || "");
  }, []);

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

  const stopManagedVideoTrack = useCallback((track) => {
    if (!track) return;

    const cleanup = videoTrackCleanupsRef.current.get(track);
    if (cleanup) {
      videoTrackCleanupsRef.current.delete(track);
      cleanup();
      return;
    }

    track.stop();
  }, []);

  const prepareCameraTrack = useCallback((sourceTrack) => {
    const { track, cleanup } = createMirroredCameraTrack(sourceTrack);
    videoTrackCleanupsRef.current.set(track, cleanup);
    attachTrackEnded(track);
    return track;
  }, [attachTrackEnded]);

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
          const requestedStream = await navigator.mediaDevices.getUserMedia(mediaConstraints(kind));
          const track = kind === "audio"
            ? requestedStream.getAudioTracks()[0]
            : requestedStream.getVideoTracks()[0];

          if (track) {
            tracks.push(kind === "video" ? prepareCameraTrack(track) : track);
            if (kind === "audio") {
              attachTrackEnded(track);
            }
          }
        } catch (error) {
          const label = kind === "audio" ? "микрофону" : "камере";
          nextMessages.push(`Нет доступа к ${label} или устройство недоступно.`);
        }
      }

      if (cancelled) {
        tracks.forEach((track) => {
          if (track.kind === "video") {
            stopManagedVideoTrack(track);
            return;
          }

          track.stop();
        });
        return;
      }

      setManagedStream(cloneStreamWithTracks(tracks));
      await refreshDevices();
      setMessages(nextMessages);
      setStatus("ready");
    }

    requestInitialMedia();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => {
        if (track.kind === "video") {
          stopManagedVideoTrack(track);
          return;
        }

        track.stop();
      });
      videoTrackCleanupsRef.current.forEach((cleanup) => cleanup());
      videoTrackCleanupsRef.current.clear();
    };
  }, [attachTrackEnded, initialAudioEnabled, initialVideoEnabled, prepareCameraTrack, refreshDevices, setManagedStream, stopManagedVideoTrack]);

  const toggleAudio = useCallback(async () => {
    const current = streamRef.current ?? new MediaStream();
    const audioTrack = current.getAudioTracks()[0];

    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setManagedStream(cloneStreamWithTracks(current.getTracks()));
      return;
    }

    try {
      const audioStream = await navigator.mediaDevices.getUserMedia(mediaConstraints("audio", selectedAudioDeviceId));
      const nextTrack = audioStream.getAudioTracks()[0];
      attachTrackEnded(nextTrack);
      setManagedStream(cloneStreamWithTracks([...current.getTracks(), nextTrack]));
    } catch {
      setMessages((items) => [...items, "Не удалось включить микрофон."]);
    }
  }, [attachTrackEnded, selectedAudioDeviceId, setManagedStream]);

  const toggleVideo = useCallback(async () => {
    const current = streamRef.current ?? new MediaStream();
    const videoTrack = current.getVideoTracks()[0];

    if (videoTrack) {
      stopManagedVideoTrack(videoTrack);
      replaceVideoTrack(null);
      screenTrackRef.current = null;
      setScreenSharing(false);
      return;
    }

    try {
      const videoStream = await navigator.mediaDevices.getUserMedia(mediaConstraints("video", selectedVideoDeviceId));
      const nextTrack = videoStream.getVideoTracks()[0];
      replaceVideoTrack(prepareCameraTrack(nextTrack));
    } catch {
      setMessages((items) => [...items, "Не удалось включить камеру."]);
    }
  }, [prepareCameraTrack, replaceVideoTrack, selectedVideoDeviceId, stopManagedVideoTrack]);

  const selectAudioDevice = useCallback(async (deviceId) => {
    setSelectedAudioDeviceId(deviceId);

    const current = streamRef.current ?? new MediaStream();
    const currentAudioTrack = current.getAudioTracks()[0];
    if (!currentAudioTrack) return;

    try {
      const audioStream = await navigator.mediaDevices.getUserMedia(mediaConstraints("audio", deviceId));
      const nextTrack = audioStream.getAudioTracks()[0];
      currentAudioTrack.stop();
      attachTrackEnded(nextTrack);
      replaceAudioTrack(nextTrack);
    } catch {
      setMessages((items) => [...items, "Не удалось переключить микрофон."]);
    }
  }, [attachTrackEnded, replaceAudioTrack]);

  const selectVideoDevice = useCallback(async (deviceId) => {
    setSelectedVideoDeviceId(deviceId);

    const current = streamRef.current ?? new MediaStream();
    const currentVideoTrack = current.getVideoTracks()[0];
    if (!currentVideoTrack) return;

    try {
      const videoStream = await navigator.mediaDevices.getUserMedia(mediaConstraints("video", deviceId));
      const nextTrack = videoStream.getVideoTracks()[0];
      stopManagedVideoTrack(currentVideoTrack);
      screenTrackRef.current = null;
      setScreenSharing(false);
      replaceVideoTrack(prepareCameraTrack(nextTrack));
    } catch {
      setMessages((items) => [...items, "Не удалось переключить камеру."]);
    }
  }, [prepareCameraTrack, replaceVideoTrack, stopManagedVideoTrack]);

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
        stopManagedVideoTrack(currentVideoTrack);
      }

      screenTrackRef.current = screenTrack;
      attachTrackEnded(screenTrack, { screen: true });
      replaceVideoTrack(screenTrack);
      setScreenSharing(true);
    } catch {
      setMessages((items) => [...items, "Не удалось начать трансляцию экрана."]);
    }
  }, [attachTrackEnded, replaceVideoTrack, stopManagedVideoTrack]);

  const stopAll = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => {
      if (track.kind === "video") {
        stopManagedVideoTrack(track);
        return;
      }

      track.stop();
    });
    videoTrackCleanupsRef.current.forEach((cleanup) => cleanup());
    videoTrackCleanupsRef.current.clear();
    screenTrackRef.current = null;
    setScreenSharing(false);
    setManagedStream(new MediaStream());
  }, [setManagedStream, stopManagedVideoTrack]);

  const mediaState = useMemo(() => mediaStateFromStream(stream), [stream]);

  return {
    stream,
    status,
    messages,
    mediaState,
    screenSharing,
    audioInputs,
    videoInputs,
    selectedAudioDeviceId,
    selectedVideoDeviceId,
    selectAudioDevice,
    selectVideoDevice,
    toggleAudio,
    toggleScreenShare,
    toggleVideo,
    stopAll
  };
}
