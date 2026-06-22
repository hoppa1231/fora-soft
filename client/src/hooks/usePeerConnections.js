import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

function streamTrackByKind(stream, kind) {
  return kind === "audio" ? stream?.getAudioTracks()[0] ?? null : stream?.getVideoTracks()[0] ?? null;
}

function senderByKind(peer, kind) {
  const directSender = peer.getSenders().find((sender) => sender.track?.kind === kind);
  if (directSender) return directSender;

  return peer
    .getTransceivers()
    .find((transceiver) => transceiver.receiver.track?.kind === kind)
    ?.sender ?? null;
}

async function renegotiatePeer(peer, participant, sendSignal) {
  if (peer.signalingState !== "stable") {
    return;
  }

  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  sendSignal({ to: participant, type: "offer", payload: offer });
}

export function usePeerConnections({
  participantId,
  existingParticipants,
  localStream,
  signals,
  consumeSignal,
  sendSignal,
  joined
}) {
  const peersRef = useRef(new Map());
  const offeredRef = useRef(new Set());
  const [remoteStreams, setRemoteStreams] = useState({});
  const [connectionIssues, setConnectionIssues] = useState({});

  const updateRemoteStream = useCallback((participant, stream) => {
    setRemoteStreams((items) => ({ ...items, [participant]: stream }));
  }, []);

  const refreshRemoteStream = useCallback((participant) => {
    setRemoteStreams((items) => ({ ...items }));
  }, []);

  const removePeer = useCallback((participant) => {
    const peer = peersRef.current.get(participant);
    if (peer) {
      peer.close();
      peersRef.current.delete(participant);
    }

    setRemoteStreams((items) => {
      const next = { ...items };
      delete next[participant];
      return next;
    });

    setConnectionIssues((items) => {
      const next = { ...items };
      delete next[participant];
      return next;
    });
  }, []);

  const createPeer = useCallback((participant) => {
    const current = peersRef.current.get(participant);
    if (current) return current;

    const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    for (const kind of ["audio", "video"]) {
      const track = streamTrackByKind(localStream, kind);
      const transceiver = peer.addTransceiver(kind, { direction: "sendrecv" });
      transceiver.sender.replaceTrack(track);
    }

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({
          to: participant,
          type: "ice-candidate",
          payload: event.candidate
        });
      }
    };

    peer.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) {
        updateRemoteStream(participant, stream);
        event.track.onunmute = () => refreshRemoteStream(participant);
        event.track.onmute = () => refreshRemoteStream(participant);
        event.track.onended = () => refreshRemoteStream(participant);
        stream.onaddtrack = () => refreshRemoteStream(participant);
        stream.onremovetrack = () => refreshRemoteStream(participant);
      }
    };

    peer.onconnectionstatechange = () => {
      if (["failed", "disconnected", "closed"].includes(peer.connectionState)) {
        setConnectionIssues((items) => ({
          ...items,
          [participant]: "Проблема с медиа-соединением"
        }));
      } else {
        setConnectionIssues((items) => {
          const next = { ...items };
          delete next[participant];
          return next;
        });
      }
    };

    peersRef.current.set(participant, peer);
    return peer;
  }, [localStream, refreshRemoteStream, sendSignal, updateRemoteStream]);

  useEffect(() => {
    for (const [participant, peer] of peersRef.current.entries()) {
      let needsRenegotiation = false;

      for (const kind of ["audio", "video"]) {
        const nextTrack = streamTrackByKind(localStream, kind);
        const sender = senderByKind(peer, kind);
        const previousTrack = sender?.track ?? null;

        if (sender) {
          sender.replaceTrack(nextTrack);
          if (kind === "video" && previousTrack !== nextTrack) {
            needsRenegotiation = true;
          }
        }
      }

      if (needsRenegotiation) {
        renegotiatePeer(peer, participant, sendSignal).catch(() => {
          setConnectionIssues((items) => ({
            ...items,
            [participant]: "Не удалось обновить видеопоток"
          }));
        });
      }
    }
  }, [localStream, sendSignal]);

  useEffect(() => {
    if (!joined) return;

    for (const participant of existingParticipants) {
      if (participant.id === participantId || offeredRef.current.has(participant.id)) {
        continue;
      }

      offeredRef.current.add(participant.id);
      const peer = createPeer(participant.id);
      peer
        .createOffer()
        .then((offer) => peer.setLocalDescription(offer).then(() => offer))
        .then((offer) => {
          sendSignal({ to: participant.id, type: "offer", payload: offer });
        })
        .catch(() => {
          setConnectionIssues((items) => ({
            ...items,
            [participant.id]: "Не удалось начать WebRTC-соединение"
          }));
        });
    }
  }, [createPeer, existingParticipants, joined, participantId, sendSignal]);

  useEffect(() => {
    if (!joined || signals.length === 0) return;

    for (const signal of signals) {
      consumeSignal(signal);

      if (signal.type === "participant-left") {
        removePeer(signal.from);
        continue;
      }

      if (!signal.from) continue;

      const peer = createPeer(signal.from);

      if (signal.type === "offer") {
        Promise.resolve()
          .then(() => peer.setRemoteDescription(new RTCSessionDescription(signal.payload)))
          .then(() => peer.createAnswer())
          .then((answer) => peer.setLocalDescription(answer).then(() => answer))
          .then((answer) => {
            sendSignal({ to: signal.from, type: "answer", payload: answer });
          })
          .catch(() => {
            setConnectionIssues((items) => ({
              ...items,
              [signal.from]: "Не удалось ответить на WebRTC-соединение"
            }));
          });
      }

      if (signal.type === "answer") {
        peer.setRemoteDescription(new RTCSessionDescription(signal.payload)).catch(() => {
          setConnectionIssues((items) => ({
            ...items,
            [signal.from]: "Не удалось применить WebRTC-ответ"
          }));
        });
      }

      if (signal.type === "ice-candidate" && signal.payload) {
        peer.addIceCandidate(new RTCIceCandidate(signal.payload)).catch(() => {
          setConnectionIssues((items) => ({
            ...items,
            [signal.from]: "Не удалось добавить ICE-кандидат"
          }));
        });
      }
    }
  }, [consumeSignal, createPeer, joined, removePeer, sendSignal, signals]);

  const closeAll = useCallback(() => {
    for (const peer of peersRef.current.values()) {
      peer.close();
    }

    peersRef.current.clear();
    setRemoteStreams({});
    setConnectionIssues({});
  }, []);

  return useMemo(() => ({
    remoteStreams,
    connectionIssues,
    closeAll
  }), [closeAll, connectionIssues, remoteStreams]);
}
