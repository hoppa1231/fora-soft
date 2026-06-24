import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];
const ICE_QUEUE_LIMIT = 32;

async function loadIceServers() {
  try {
    const response = await fetch("/rtc-config", { cache: "no-store" });
    if (!response.ok) return ICE_SERVERS;

    const config = await response.json();
    return Array.isArray(config.iceServers) && config.iceServers.length > 0 ? config.iceServers : ICE_SERVERS;
  } catch {
    return ICE_SERVERS;
  }
}

function streamTrackByKind(stream, kind) {
  return kind === "audio" ? stream?.getAudioTracks()[0] ?? null : stream?.getVideoTracks()[0] ?? null;
}

function localSenders(peer) {
  if (!peer.__localSenders) {
    peer.__localSenders = {};
  }

  return peer.__localSenders;
}

function queuedIceCandidates(peer) {
  if (!peer.__pendingIceCandidates) {
    peer.__pendingIceCandidates = [];
  }

  return peer.__pendingIceCandidates;
}

function remoteMediaStream(peer) {
  if (!peer.__remoteMediaStream) {
    peer.__remoteMediaStream = new MediaStream();
  }

  return peer.__remoteMediaStream;
}

async function addOrQueueIceCandidate(peer, payload) {
  if (!payload || peer.signalingState === "closed") {
    return;
  }

  const candidate = new RTCIceCandidate(payload);
  if (!peer.remoteDescription) {
    const queue = queuedIceCandidates(peer);
    queue.push(candidate);

    if (queue.length > ICE_QUEUE_LIMIT) {
      queue.shift();
    }

    return;
  }

  await peer.addIceCandidate(candidate);
}

async function flushQueuedIceCandidates(peer) {
  if (!peer.remoteDescription || peer.signalingState === "closed") {
    return;
  }

  const queue = queuedIceCandidates(peer);
  const candidates = queue.splice(0);

  for (const candidate of candidates) {
    try {
      await peer.addIceCandidate(candidate);
    } catch {
      // A stale queued candidate should not abort the SDP handshake.
    }
  }
}

function senderByKind(peer, kind) {
  const senders = localSenders(peer);
  if (senders[kind]) return senders[kind];

  const sender = transceiverByKind(peer, kind)?.sender;

  if (sender) {
    senders[kind] = sender;
  }

  return sender ?? null;
}

function transceiverByKind(peer, kind) {
  return peer
    .getTransceivers()
    .find((transceiver) => transceiver.receiver.track?.kind === kind || transceiver.sender.track?.kind === kind) ?? null;
}

async function renegotiatePeer(peer, participant, sendSignal) {
  if (peer.signalingState !== "stable") {
    peer.__pendingRenegotiation = true;
    return;
  }

  peer.__pendingRenegotiation = false;
  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  sendSignal({ to: participant, type: "offer", payload: offer });
}

async function syncLocalTracks(peer, participant, localStream, sendSignal, { ensureTransceivers = false, renegotiateOnAdd = false } = {}) {
  let needsRenegotiation = false;
  const senders = localSenders(peer);

  for (const kind of ["audio", "video"]) {
    const nextTrack = streamTrackByKind(localStream, kind);
    let transceiver = transceiverByKind(peer, kind);
    let sender = senderByKind(peer, kind);

    if (!sender && ensureTransceivers) {
      transceiver = peer.addTransceiver(kind, { direction: "sendrecv" });
      sender = transceiver.sender;
      senders[kind] = sender;
      needsRenegotiation = true;
    }

    if (transceiver && transceiver.direction !== "stopped") {
      const nextDirection = nextTrack ? "sendrecv" : "recvonly";
      if (transceiver.direction !== nextDirection) {
        transceiver.direction = nextDirection;
        needsRenegotiation = true;
      }
    }

    if (!sender && nextTrack && localStream) {
      senders[kind] = peer.addTrack(nextTrack, localStream);
      needsRenegotiation = true;
      continue;
    }

    if (sender && sender.track !== nextTrack) {
      const previousTrack = sender.track;
      await sender.replaceTrack(nextTrack);

      if (kind === "video" && previousTrack !== nextTrack) {
        needsRenegotiation = true;
      }
    }
  }

  if (needsRenegotiation && renegotiateOnAdd) {
    await renegotiatePeer(peer, participant, sendSignal);
  }
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
  const iceServersRef = useRef(null);
  const localStreamRef = useRef(localStream);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [connectionIssues, setConnectionIssues] = useState({});
  const [iceServersReady, setIceServersReady] = useState(false);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    let cancelled = false;

    loadIceServers().then((iceServers) => {
      if (cancelled) return;
      iceServersRef.current = iceServers;
      setIceServersReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

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

    const peer = new RTCPeerConnection({ iceServers: iceServersRef.current ?? ICE_SERVERS });

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
      const stream = event.streams[0] ?? remoteMediaStream(peer);

      if (!stream.getTracks().some((track) => track.id === event.track.id)) {
        stream.addTrack(event.track);
      }

      updateRemoteStream(participant, stream);
      event.track.onunmute = () => refreshRemoteStream(participant);
      event.track.onmute = () => refreshRemoteStream(participant);
      event.track.onended = () => refreshRemoteStream(participant);
      stream.onaddtrack = () => refreshRemoteStream(participant);
      stream.onremovetrack = () => refreshRemoteStream(participant);
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

    peer.onsignalingstatechange = () => {
      if (peer.signalingState === "stable" && peer.__pendingRenegotiation) {
        renegotiatePeer(peer, participant, sendSignal).catch(() => {
          setConnectionIssues((items) => ({
            ...items,
            [participant]: "Не удалось обновить видеопоток"
          }));
        });
      }
    };

    peersRef.current.set(participant, peer);
    return peer;
  }, [refreshRemoteStream, sendSignal, updateRemoteStream]);

  useEffect(() => {
    if (!iceServersReady) return;

    for (const [participant, peer] of peersRef.current.entries()) {
      syncLocalTracks(peer, participant, localStream, sendSignal, { renegotiateOnAdd: true }).catch(() => {
          setConnectionIssues((items) => ({
            ...items,
            [participant]: "Не удалось обновить видеопоток"
          }));
      });
    }
  }, [iceServersReady, localStream, sendSignal]);

  useEffect(() => {
    if (!joined || !iceServersReady) return;

    for (const participant of existingParticipants) {
      if (participant.id === participantId || offeredRef.current.has(participant.id)) {
        continue;
      }

      offeredRef.current.add(participant.id);
      const peer = createPeer(participant.id);
      syncLocalTracks(peer, participant.id, localStreamRef.current, sendSignal, { ensureTransceivers: true })
        .then(() => peer.createOffer())
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
  }, [createPeer, existingParticipants, iceServersReady, joined, participantId, sendSignal]);

  useEffect(() => {
    if (!joined || !iceServersReady || signals.length === 0) return;

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
          .then(() => flushQueuedIceCandidates(peer))
          .then(() => syncLocalTracks(peer, signal.from, localStreamRef.current, sendSignal))
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
        Promise.resolve()
          .then(() => peer.setRemoteDescription(new RTCSessionDescription(signal.payload)))
          .then(() => flushQueuedIceCandidates(peer))
          .then(() => {
            setConnectionIssues((items) => {
              const next = { ...items };
              delete next[signal.from];
              return next;
            });
          })
          .catch(() => {
            setConnectionIssues((items) => ({
              ...items,
              [signal.from]: "Не удалось применить WebRTC-ответ"
            }));
          });
      }

      if (signal.type === "ice-candidate" && signal.payload) {
        addOrQueueIceCandidate(peer, signal.payload)
          .then(() => {
            setConnectionIssues((items) => {
              if (!items[signal.from]) return items;
              const next = { ...items };
              delete next[signal.from];
              return next;
            });
          })
          .catch(() => {
            setConnectionIssues((items) => ({
              ...items,
              [signal.from]: "Не удалось добавить ICE-кандидат"
            }));
          });
      }
    }
  }, [consumeSignal, createPeer, iceServersReady, joined, removePeer, sendSignal, signals]);

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
