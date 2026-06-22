import { useCallback, useEffect, useRef, useState } from "react";

function supportsWebRtc() {
  return Boolean(window.RTCPeerConnection && navigator.mediaDevices?.getUserMedia);
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
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.srcObject = sourceStream;

  const outputStream = canvas.captureStream(frameRate);
  const outputTrack = outputStream.getVideoTracks()[0];
  const drawIntervalMs = Math.round(1000 / Math.min(Math.max(frameRate, 10), 30));
  let intervalId = 0;
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
  };

  intervalId = window.setInterval(drawFrame, drawIntervalMs);
  video.addEventListener("loadeddata", drawFrame);
  video.addEventListener("playing", drawFrame);
  video.play().then(drawFrame).catch(() => {});
  outputTrack.contentHint = sourceTrack.contentHint || "motion";
  sourceTrack.onended = () => outputTrack.stop();

  return {
    track: outputTrack,
    cleanup: () => {
      stopped = true;
      window.clearInterval(intervalId);
      video.removeEventListener("loadeddata", drawFrame);
      video.removeEventListener("playing", drawFrame);
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
  const [mediaState, setMediaState] = useState({
    audioEnabled: initialAudioEnabled,
    videoEnabled: initialVideoEnabled
  });
  const [audioInputs, setAudioInputs] = useState([]);
  const [videoInputs, setVideoInputs] = useState([]);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState("");
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState("");
  const streamRef = useRef(null);
  const screenTrackRef = useRef(null);
  const videoTrackCleanupsRef = useRef(new Map());
  const cameraEnabledRef = useRef(initialVideoEnabled);

  const setManagedStream = useCallback((nextStream) => {
    streamRef.current = nextStream;
    setStream(nextStream);
  }, []);

  const syncMediaState = useCallback((patch) => {
    setMediaState((current) => ({ ...current, ...patch }));
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
      if (track.kind === "audio") {
        syncMediaState({ audioEnabled: false });
      }
      if (track.kind === "video" && !options.screen) {
        cameraEnabledRef.current = false;
        syncMediaState({ videoEnabled: false });
      }
      if (options.screen) {
        screenTrackRef.current = null;
        setScreenSharing(false);
      }
    };
  }, [setManagedStream, syncMediaState]);

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

  const replaceWithCameraTrack = useCallback(async () => {
    const currentVideoTrack = streamRef.current?.getVideoTracks()[0];
    if (currentVideoTrack) {
      stopManagedVideoTrack(currentVideoTrack);
    }

    const videoStream = await navigator.mediaDevices.getUserMedia(mediaConstraints("video", selectedVideoDeviceId));
    const sourceTrack = videoStream.getVideoTracks()[0];
    const nextTrack = prepareCameraTrack(sourceTrack);
    replaceVideoTrack(nextTrack);
    return nextTrack;
  }, [prepareCameraTrack, replaceVideoTrack, selectedVideoDeviceId, stopManagedVideoTrack]);

  const restoreVideoOutput = useCallback(async () => {
    const current = streamRef.current ?? new MediaStream();
    const currentVideoTrack = current.getVideoTracks()[0];

    if (currentVideoTrack) {
      stopManagedVideoTrack(currentVideoTrack);
    }

    if (cameraEnabledRef.current) {
      await replaceWithCameraTrack();
      return;
    }

    replaceVideoTrack(null);
  }, [replaceVideoTrack, replaceWithCameraTrack, stopManagedVideoTrack]);

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
            if (kind === "audio") {
              tracks.push(track);
              attachTrackEnded(track);
              syncMediaState({ audioEnabled: true });
            } else {
              const nextTrack = prepareCameraTrack(track);
              tracks.push(nextTrack);
              cameraEnabledRef.current = true;
              syncMediaState({ videoEnabled: true });
            }
          }
        } catch (error) {
          const label = kind === "audio" ? "микрофону" : "камере";
          nextMessages.push(`Нет доступа к ${label} или устройство недоступно.`);
          if (kind === "audio") {
            syncMediaState({ audioEnabled: false });
          } else {
            cameraEnabledRef.current = false;
            syncMediaState({ videoEnabled: false });
          }
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
  }, [attachTrackEnded, initialAudioEnabled, initialVideoEnabled, prepareCameraTrack, refreshDevices, setManagedStream, stopManagedVideoTrack, syncMediaState]);

  const toggleAudio = useCallback(async () => {
    const current = streamRef.current ?? new MediaStream();
    const audioTrack = current.getAudioTracks()[0];

    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setManagedStream(cloneStreamWithTracks(current.getTracks()));
      syncMediaState({ audioEnabled: audioTrack.enabled });
      return;
    }

    try {
      const audioStream = await navigator.mediaDevices.getUserMedia(mediaConstraints("audio", selectedAudioDeviceId));
      const nextTrack = audioStream.getAudioTracks()[0];
      attachTrackEnded(nextTrack);
      setManagedStream(cloneStreamWithTracks([...current.getTracks(), nextTrack]));
      syncMediaState({ audioEnabled: true });
    } catch {
      setMessages((items) => [...items, "Не удалось включить микрофон."]);
    }
  }, [attachTrackEnded, selectedAudioDeviceId, setManagedStream, syncMediaState]);

  const toggleVideo = useCallback(async () => {
    const current = streamRef.current ?? new MediaStream();

    if (mediaState.videoEnabled) {
      cameraEnabledRef.current = false;
      syncMediaState({ videoEnabled: false });

      if (!screenTrackRef.current) {
        const videoTrack = current.getVideoTracks()[0];
        if (videoTrack) {
          stopManagedVideoTrack(videoTrack);
        }
        replaceVideoTrack(null);
      }
      return;
    }

    try {
      cameraEnabledRef.current = true;
      syncMediaState({ videoEnabled: true });

      if (!screenTrackRef.current) {
        await replaceWithCameraTrack();
      }
    } catch {
      cameraEnabledRef.current = false;
      syncMediaState({ videoEnabled: false });
      setMessages((items) => [...items, "Не удалось включить камеру."]);
    }
  }, [mediaState.videoEnabled, replaceVideoTrack, replaceWithCameraTrack, stopManagedVideoTrack, syncMediaState]);

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
    if (!currentVideoTrack || screenTrackRef.current) return;

    try {
      cameraEnabledRef.current = true;
      syncMediaState({ videoEnabled: true });
      const videoStream = await navigator.mediaDevices.getUserMedia(mediaConstraints("video", deviceId));
      const nextTrack = videoStream.getVideoTracks()[0];
      stopManagedVideoTrack(currentVideoTrack);
      replaceVideoTrack(prepareCameraTrack(nextTrack));
    } catch {
      cameraEnabledRef.current = false;
      syncMediaState({ videoEnabled: false });
      setMessages((items) => [...items, "Не удалось переключить камеру."]);
    }
  }, [prepareCameraTrack, replaceVideoTrack, stopManagedVideoTrack, syncMediaState]);

  const toggleScreenShare = useCallback(async () => {
    if (screenTrackRef.current) {
      const screenTrack = screenTrackRef.current;
      screenTrackRef.current = null;
      screenTrack.onended = null;
      screenTrack.stop();
      setScreenSharing(false);
      await restoreVideoOutput();
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
      setScreenSharing(true);
      replaceVideoTrack(screenTrack);
      screenTrack.onended = () => {
        if (screenTrackRef.current !== screenTrack) {
          return;
        }
        screenTrackRef.current = null;
        setScreenSharing(false);
        restoreVideoOutput().catch(() => {});
      };
    } catch {
      setMessages((items) => [...items, "Не удалось начать трансляцию экрана."]);
    }
  }, [replaceVideoTrack, restoreVideoOutput, stopManagedVideoTrack]);

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
    cameraEnabledRef.current = false;
    syncMediaState({ audioEnabled: false, videoEnabled: false });
    setManagedStream(new MediaStream());
  }, [setManagedStream, stopManagedVideoTrack, syncMediaState]);

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
