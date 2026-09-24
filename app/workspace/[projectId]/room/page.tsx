"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowsIn,
  ArrowsOut,
  Microphone,
  MicrophoneSlash,
  Monitor,
  Users,
} from "@phosphor-icons/react";

import { API_URL, taskboardFetch } from "../../../lib/taskboard";
import { useTaskboardToken } from "../../../lib/use-taskboard-token";
import { WorkspaceAvatarStack, WorkspaceIcon } from "../../components/workspace-ui";

type Project = { id: string; name: string; description: string };
type RoomPeer = {
  id: string;
  alias?: string;
  email: string;
  avatar_data?: string;
  publishing: boolean;
  mic_enabled: boolean;
};
type RoomTicket = {
  ticket: string;
  expires_at: string;
  ice_servers: RTCIceServer[];
};
type SignalDescription = { type: RTCSdpType; sdp?: string };
type SignalPayload =
  | { kind: "description"; description: SignalDescription }
  | { kind: "ice"; candidate: RTCIceCandidateInit };
type PeerConnectionState = {
  pc: RTCPeerConnection;
  videoSender: RTCRtpSender;
  screenAudioSender: RTCRtpSender;
  micSender: RTCRtpSender;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  isSettingRemoteAnswerPending: boolean;
  pendingCandidates: RTCIceCandidateInit[];
  signalingQueue: Promise<void>;
};

const ROOM_PROTOCOL = "raccoon-room-v1";

type RoomIconName =
  "mic" | "micOff" | "fullscreen" | "exitFullscreen" | "screen" | "users";

function RoomIcon({ name }: { name: RoomIconName }) {
  const icons = { mic: Microphone, micOff: MicrophoneSlash, fullscreen: ArrowsOut, exitFullscreen: ArrowsIn, screen: Monitor, users: Users };
  const Icon = icons[name];
  return <Icon className="room-icon" aria-hidden="true" />;
}

function socketURL(path: string) {
  const base = API_URL || window.location.origin;
  const url = new URL(path, base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

function displayName(email: string, alias?: string) {
  return alias?.trim() || email.split("@")[0] || email;
}

function initials(email: string, alias?: string) {
  return displayName(email, alias).slice(0, 2).toUpperCase();
}

function RoomVideo({
  stream,
  label,
  muted = false,
}: {
  stream: MediaStream;
  label: string;
  muted?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    video.muted = muted;
    void video.play().catch(() => undefined);
    return () => {
      video.srcObject = null;
    };
  }, [muted, stream]);

  return (
    <video
      ref={videoRef}
      className="room-video"
      autoPlay
      playsInline
      muted={muted}
      aria-label={`Tela compartilhada por ${label}`}
    />
  );
}

export default function RoomPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const { token, ready, clearToken } = useTaskboardToken();
  const [project, setProject] = useState<Project | null>(null);
  const [selfID, setSelfID] = useState("");
  const [peers, setPeers] = useState<RoomPeer[]>([]);
  const [selfPeer, setSelfPeer] = useState<RoomPeer | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<
    Record<string, MediaStream>
  >({});
  const [status, setStatus] = useState<
    "loading" | "connected" | "reconnecting" | "disconnected"
  >("loading");
  const [error, setError] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [localScreen, setLocalScreen] = useState<MediaStream | null>(null);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isPublishPending, setIsPublishPending] = useState(false);
  const [includeScreenAudio, setIncludeScreenAudio] = useState(true);
  const [fullscreenTile, setFullscreenTile] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const mountedRef = useRef(true);
  const leavingRef = useRef(false);
  const roomUnavailableRef = useRef(false);
  const connectingRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selfIDRef = useRef("");
  const iceServersRef = useRef<RTCIceServer[]>([]);
  const peersRef = useRef<RoomPeer[]>([]);
  const peerConnectionsRef = useRef<Map<string, PeerConnectionState>>(
    new Map(),
  );
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const localScreenRef = useRef<MediaStream | null>(null);
  const localMicRef = useRef<MediaStream | null>(null);
  const tileRefs = useRef<Record<string, HTMLElement | null>>({});
  const publishRequestRef = useRef<{
    resolve: () => void;
    reject: (reason: Error) => void;
  } | null>(null);
  const roomCallbacksRef = useRef<{
    connect: () => Promise<void>;
    cleanup: () => void;
  }>({
    connect: async () => undefined,
    cleanup: () => undefined,
  });

  function updatePeers(update: (current: RoomPeer[]) => RoomPeer[]) {
    setPeers((current) => {
      const next = update(current);
      peersRef.current = next;
      return next;
    });
  }

  function sendRoomMessage(message: Record<string, unknown>) {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    }
  }

  function removeRemoteStream(peerID: string) {
    const stream = remoteStreamsRef.current.get(peerID);
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      remoteStreamsRef.current.delete(peerID);
    }
    setRemoteStreams((current) => {
      const next = { ...current };
      delete next[peerID];
      return next;
    });
  }

  function closePeerConnection(peerID: string) {
    const connection = peerConnectionsRef.current.get(peerID);
    connection?.pc.close();
    peerConnectionsRef.current.delete(peerID);
    removeRemoteStream(peerID);
  }

  function resetPeerConnections() {
    for (const peerID of peerConnectionsRef.current.keys())
      closePeerConnection(peerID);
    peerConnectionsRef.current.clear();
    setRemoteStreams({});
  }

  function stopLocalMedia() {
    localScreenRef.current?.getTracks().forEach((track) => track.stop());
    localMicRef.current?.getTracks().forEach((track) => track.stop());
    localScreenRef.current = null;
    localMicRef.current = null;
    setLocalScreen(null);
    setIsSharing(false);
    setIsMicEnabled(false);
    setIsPublishPending(false);
    publishRequestRef.current?.reject(
      new Error("A conexão com a sala foi encerrada."),
    );
    publishRequestRef.current = null;
  }

  async function replaceLocalTracks() {
    const videoTrack = localScreenRef.current?.getVideoTracks()[0] || null;
    const screenAudioTrack =
      localScreenRef.current?.getAudioTracks()[0] || null;
    const micTrack = localMicRef.current?.getAudioTracks()[0] || null;
    await Promise.all(
      Array.from(peerConnectionsRef.current.values()).map(
        async (connection) => {
          await connection.videoSender.replaceTrack(videoTrack);
          await connection.screenAudioSender.replaceTrack(screenAudioTrack);
          await connection.micSender.replaceTrack(micTrack);
        },
      ),
    );
  }

  function showPeerError(reason: unknown, fallback: string) {
    if (mountedRef.current)
      setError(reason instanceof Error ? reason.message : fallback);
  }

  function negotiatePeer(
    peerID: string,
    connection: PeerConnectionState,
  ) {
    connection.signalingQueue = connection.signalingQueue
      .then(async () => {
        const { pc } = connection;
        if (pc.signalingState !== "stable" || connection.makingOffer) return;

        connection.makingOffer = true;
        try {
          // Let the browser create the offer from the current transceiver order.
          await pc.setLocalDescription();
          if (!pc.localDescription) return;
          const description: SignalDescription = {
            type: pc.localDescription.type,
            sdp: pc.localDescription.sdp,
          };
          sendRoomMessage({
            target: peerID,
            type: "signal",
            signal: { kind: "description", description },
          });
        } finally {
          connection.makingOffer = false;
        }
      })
      .catch((reason: unknown) =>
        showPeerError(reason, "Não foi possível negociar a conexão."),
      );
  }

  function ensurePeerConnection(peer: RoomPeer) {
    const existing = peerConnectionsRef.current.get(peer.id);
    if (existing) return existing;

    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
    let connection: PeerConnectionState | null = null;
    pc.onnegotiationneeded = () => {
      if (connection) negotiatePeer(peer.id, connection);
    };
    const videoSender = pc.addTransceiver("video", {
      direction: "sendrecv",
    }).sender;
    const screenAudioSender = pc.addTransceiver("audio", {
      direction: "sendrecv",
    }).sender;
    const micSender = pc.addTransceiver("audio", {
      direction: "sendrecv",
    }).sender;
    const peerConnection: PeerConnectionState = {
      pc,
      videoSender,
      screenAudioSender,
      micSender,
      polite: selfIDRef.current > peer.id,
      makingOffer: false,
      ignoreOffer: false,
      isSettingRemoteAnswerPending: false,
      pendingCandidates: [],
      signalingQueue: Promise.resolve(),
    };
    connection = peerConnection;
    peerConnectionsRef.current.set(peer.id, peerConnection);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendRoomMessage({
          target: peer.id,
          type: "signal",
          signal: { kind: "ice", candidate: event.candidate.toJSON() },
        });
      }
    };
    pc.ontrack = (event) => {
      const stream = remoteStreamsRef.current.get(peer.id) || new MediaStream();
      if (!stream.getTracks().some((track) => track.id === event.track.id))
        stream.addTrack(event.track);
      remoteStreamsRef.current.set(peer.id, stream);
      setRemoteStreams((current) => ({ ...current, [peer.id]: stream }));
      event.track.onended = () => {
        if (stream.getTracks().some((track) => track.readyState === "live"))
          return;
        removeRemoteStream(peer.id);
      };
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed")
        closePeerConnection(peer.id);
    };
    return peerConnection;
  }

  function handleSignal(peerID: string, signal: SignalPayload) {
    const peer = peersRef.current.find((item) => item.id === peerID);
    if (!peer) return;
    const connection = ensurePeerConnection(peer);
    connection.signalingQueue = connection.signalingQueue
      .then(async () => {
        const { pc } = connection;
        if (pc.signalingState === "closed") return;

        if (signal.kind === "ice") {
          if (connection.ignoreOffer) return;
          if (pc.remoteDescription) {
            await pc.addIceCandidate(signal.candidate).catch(() => undefined);
          } else {
            connection.pendingCandidates.push(signal.candidate);
          }
          return;
        }

        const description = signal.description;
        if (
          description.type === "answer" &&
          pc.signalingState !== "have-local-offer"
        )
          return;
        const readyForOffer =
          !connection.makingOffer &&
          (pc.signalingState === "stable" ||
            connection.isSettingRemoteAnswerPending);
        const offerCollision =
          description.type === "offer" && !readyForOffer;
        connection.ignoreOffer = !connection.polite && offerCollision;
        if (connection.ignoreOffer) {
          connection.pendingCandidates = [];
          return;
        }

        try {
          connection.isSettingRemoteAnswerPending =
            description.type === "answer";
          await pc.setRemoteDescription(description);
          connection.isSettingRemoteAnswerPending = false;
          for (const candidate of connection.pendingCandidates.splice(0)) {
            await pc.addIceCandidate(candidate).catch(() => undefined);
          }
          if (description.type === "offer") {
            await pc.setLocalDescription();
            if (pc.localDescription) {
              const answer: SignalDescription = {
                type: pc.localDescription.type,
                sdp: pc.localDescription.sdp,
              };
              sendRoomMessage({
                target: peerID,
                type: "signal",
                signal: { kind: "description", description: answer },
              });
            }
          }
        } finally {
          connection.isSettingRemoteAnswerPending = false;
        }
      })
      .catch((reason: unknown) =>
        showPeerError(reason, "Não foi possível conectar este participante."),
      );
  }

  function handleRoomMessage(payload: string) {
    let message: {
      type: string;
      code?: string;
      message?: string;
      self_id?: string;
      peer?: RoomPeer;
      peers?: RoomPeer[];
      from?: string;
      signal?: SignalPayload;
    };
    try {
      message = JSON.parse(payload);
    } catch {
      return;
    }
    if (message.type === "room_state") {
      const nextPeers = message.peers || [];
      const nextSelfID = message.self_id || "";
      selfIDRef.current = nextSelfID;
      setSelfID(nextSelfID);
      if (message.peer) setSelfPeer(message.peer);
      updatePeers(() => nextPeers);
      nextPeers.forEach((peer) => ensurePeerConnection(peer));
      return;
    }
    if (message.type === "peer_joined" && message.peer) {
      updatePeers((current) => [
        ...current.filter((peer) => peer.id !== message.peer?.id),
        message.peer as RoomPeer,
      ]);
      ensurePeerConnection(message.peer);
      void replaceLocalTracks().catch(() => undefined);
      return;
    }
    if (message.type === "peer_left" && message.peer) {
      updatePeers((current) =>
        current.filter((peer) => peer.id !== message.peer?.id),
      );
      closePeerConnection(message.peer.id);
      return;
    }
    if (message.type === "peer_state" && message.peer) {
      if (message.peer.id === selfIDRef.current) {
        setIsSharing(message.peer.publishing);
        setIsMicEnabled(message.peer.mic_enabled);
        setSelfPeer(message.peer);
      } else {
        updatePeers((current) =>
          current.map((peer) =>
            peer.id === message.peer?.id ? (message.peer as RoomPeer) : peer,
          ),
        );
      }
      return;
    }
    if (message.type === "publish_accepted") {
      setIsPublishPending(false);
      publishRequestRef.current?.resolve();
      publishRequestRef.current = null;
      return;
    }
    if (message.type === "publish_rejected") {
      setIsPublishPending(false);
      publishRequestRef.current?.reject(
        new Error(message.message || "Não foi possível compartilhar a tela."),
      );
      publishRequestRef.current = null;
      return;
    }
    if (message.type === "signal" && message.from && message.signal) {
      void handleSignal(message.from, message.signal);
      return;
    }
    if (message.type === "error") {
      setError(message.message || "A sala não está disponível.");
      if (message.code === "room_full") {
        roomUnavailableRef.current = true;
        setStatus("disconnected");
      }
    }
  }

  async function connectRoom() {
    if (!token || !projectId || connectingRef.current || leavingRef.current)
      return;
    connectingRef.current = true;
    roomUnavailableRef.current = false;
    setStatus((current) => (current === "connected" ? current : "loading"));
    setError("");
    try {
      const projectListResponse = await taskboardFetch<{ projects: Project[] }>(
        "/api/projects",
        token,
      );
      if (!projectListResponse.projects.some((item) => item.id === projectId)) {
        router.replace("/workspace?error=project-not-found");
        return;
      }
      const [projectResponse, ticketResponse] = await Promise.all([
        taskboardFetch<{ project: Project }>(
          `/api/projects/${projectId}`,
          token,
        ),
        taskboardFetch<RoomTicket>(
          `/api/projects/${projectId}/room/ticket`,
          token,
          { method: "POST" },
        ),
      ]);
      if (!mountedRef.current || leavingRef.current) return;
      setProject(projectResponse.project);
      iceServersRef.current = ticketResponse.ice_servers || [];
      resetPeerConnections();
      const socket = new WebSocket(
        socketURL(`/api/projects/${projectId}/room/ws`),
        [ROOM_PROTOCOL, ticketResponse.ticket],
      );
      socketRef.current = socket;
      socket.onopen = () => {
        if (mountedRef.current) setStatus("connected");
      };
      socket.onmessage = (event) => handleRoomMessage(event.data);
      socket.onerror = () => {
        if (mountedRef.current)
          setError("Não foi possível manter a conexão com a sala.");
      };
      socket.onclose = () => {
        if (
          !mountedRef.current ||
          leavingRef.current ||
          roomUnavailableRef.current
        )
          return;
        resetPeerConnections();
        stopLocalMedia();
        setStatus("reconnecting");
        if (!reconnectTimerRef.current) {
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            void connectRoom();
          }, 1500);
        }
      };
    } catch (reason) {
      if (!mountedRef.current) return;
      const message =
        reason instanceof Error
          ? reason.message
          : "Não foi possível abrir a sala.";
      if (message.includes("token")) {
        clearToken();
        router.replace("/login");
      } else if (message.includes("acesso") || message.includes("encontrado")) {
        router.replace("/workspace?error=project-not-found");
      } else {
        setError(message);
        setStatus("disconnected");
      }
    } finally {
      connectingRef.current = false;
    }
  }

  async function waitForPublishSlot() {
    if (socketRef.current?.readyState !== WebSocket.OPEN)
      throw new Error("A sala ainda está conectando.");
    setIsPublishPending(true);
    return new Promise<void>((resolve, reject) => {
      publishRequestRef.current = { resolve, reject };
      sendRoomMessage({ type: "publish_request" });
    });
  }

  async function startSharing() {
    if (isSharing || isPublishPending) return;
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError("Este navegador não oferece compartilhamento de tela.");
      return;
    }
    try {
      await waitForPublishSlot();
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: includeScreenAudio,
      });
      localScreenRef.current = stream;
      setLocalScreen(stream);
      await replaceLocalTracks();
      setIsSharing(true);
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack)
        videoTrack.onended = () => {
          void stopSharing();
        };
    } catch (reason) {
      sendRoomMessage({ type: "publish_stop" });
      setIsPublishPending(false);
      const message =
        reason instanceof Error
          ? reason.message
          : "Não foi possível compartilhar a tela.";
      if (!message.toLowerCase().includes("cancel")) setError(message);
    }
  }

  async function stopSharing() {
    localScreenRef.current?.getTracks().forEach((track) => track.stop());
    localScreenRef.current = null;
    setLocalScreen(null);
    await replaceLocalTracks().catch(() => undefined);
    sendRoomMessage({ type: "publish_stop" });
    setIsSharing(false);
  }

  async function toggleMic() {
    if (isMicEnabled) {
      localMicRef.current?.getTracks().forEach((track) => track.stop());
      localMicRef.current = null;
      await replaceLocalTracks().catch(() => undefined);
      sendRoomMessage({ type: "mic_state", enabled: false });
      setIsMicEnabled(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Este navegador não oferece acesso ao microfone.");
      return;
    }
    try {
      localMicRef.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      await replaceLocalTracks();
      sendRoomMessage({ type: "mic_state", enabled: true });
      setIsMicEnabled(true);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível acessar o microfone.",
      );
    }
  }

  async function toggleTileFullscreen(tileID: string) {
    const element = tileRefs.current[tileID];
    if (!element) return;
    try {
      if (document.fullscreenElement === element) {
        await document.exitFullscreen();
        setFullscreenTile(null);
      } else {
        await element.requestFullscreen();
        setFullscreenTile(tileID);
      }
    } catch {
      setError("Não foi possível abrir a transmissão em tela cheia.");
    }
  }

  useEffect(() => {
    function handleFullscreenChange() {
      if (!document.fullscreenElement) setFullscreenTile(null);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!token) router.replace("/login");
  }, [ready, router, token]);

  useEffect(() => {
    roomCallbacksRef.current = {
      connect: connectRoom,
      cleanup: () => {
        stopLocalMedia();
        resetPeerConnections();
      },
    };
  });

  useEffect(() => {
    if (!ready || !token) return;
    mountedRef.current = true;
    leavingRef.current = false;
    const roomCallbacks = roomCallbacksRef.current;
    void roomCallbacks.connect();
    return () => {
      mountedRef.current = false;
      leavingRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      socketRef.current?.close(1000, "saída da página");
      roomCallbacks.cleanup();
    };
  }, [projectId, ready, token]);

  const remoteTiles = useMemo(
    () => peers.filter((peer) => peer.publishing && remoteStreams[peer.id]),
    [peers, remoteStreams],
  );
  const participants = useMemo(
    () => (selfPeer ? [selfPeer, ...peers] : peers),
    [selfPeer, peers],
  );
  const sharingCount = remoteTiles.length + (isSharing ? 1 : 0);
  const statusLabel =
    status === "connected"
      ? "Sala conectada"
      : status === "reconnecting"
        ? "Reconectando"
        : status === "loading"
          ? "Abrindo sala"
          : "Sala desconectada";

  return (
    <main className="workspace-page room-page">
      <section className="room-shell">
        <div className="room-heading">
          <div>
            <Link className="room-back-link" href={`/workspace/${projectId}`}>
              <WorkspaceIcon name="back" /> Voltar ao quadro
            </Link>
            <span className="workspace-kicker">Sala ao vivo</span>
            <h1>{project?.name || "Sala do projeto"}</h1>
            <p>
              Compartilhe uma tela com a equipe e acompanhe até duas
              transmissões ao mesmo tempo.
            </p>
          </div>
          <div className="room-heading-side">
            <div className="room-participants-heading">
              <RoomIcon name="users" />
              <span>Participantes</span>
              <b>{participants.length}</b>
            </div>
            <WorkspaceAvatarStack
              members={participants}
              max={8}
              currentId={selfID}
              label={`${participants.length} participante${participants.length === 1 ? "" : "s"} na sala`}
            />
            <div className={`room-status room-status-${status}`}>
              <span />
              {statusLabel}
            </div>
          </div>
        </div>

        {error ? (
          <div className="workspace-error" role="alert">
            {error}
            <button type="button" onClick={() => setError("")}>
              <WorkspaceIcon name="close" />
            </button>
          </div>
        ) : null}

        <div className="room-grid" aria-live="polite">
          {isSharing && localScreen ? (
            <article
              className="room-tile room-tile-local"
              ref={(element) => {
                tileRefs.current.local = element;
              }}
            >
              <div className="room-tile-label">
                <div className="room-tile-meta">
                  <span className="room-tile-avatar">
                    {selfPeer?.avatar_data ? (
                      <Image
                        className="room-tile-avatar-image"
                        src={selfPeer.avatar_data}
                        alt=""
                        width={24}
                        height={24}
                        unoptimized
                      />
                    ) : selfPeer ? (
                      initials(selfPeer.email, selfPeer.alias)
                    ) : (
                      "EU"
                    )}
                  </span>
                  <span>
                    <strong>Você</strong>
                    <small>Transmitindo</small>
                  </span>
                </div>
                <button
                  className="room-tile-action"
                  type="button"
                  onClick={() => void toggleTileFullscreen("local")}
                  aria-label={
                    fullscreenTile === "local"
                      ? "Sair da tela cheia"
                      : "Abrir tela compartilhada em tela cheia"
                  }
                >
                  <RoomIcon
                    name={
                      fullscreenTile === "local"
                        ? "exitFullscreen"
                        : "fullscreen"
                    }
                  />
                </button>
              </div>
              <RoomVideo stream={localScreen} label="você" muted />
            </article>
          ) : null}
          {remoteTiles.map((peer) => (
            <article
              className="room-tile"
              key={peer.id}
              ref={(element) => {
                tileRefs.current[peer.id] = element;
              }}
            >
              <div className="room-tile-label">
                <div className="room-tile-meta">
                  <span className="room-tile-avatar">
                    {peer.avatar_data ? (
                      <Image
                        className="room-tile-avatar-image"
                        src={peer.avatar_data}
                        alt=""
                        width={24}
                        height={24}
                        unoptimized
                      />
                    ) : (
                      initials(peer.email, peer.alias)
                    )}
                  </span>
                  <span>
                    <strong>{displayName(peer.email, peer.alias)}</strong>
                    <small>
                      {peer.mic_enabled ? "Com áudio" : "Tela compartilhada"}
                    </small>
                  </span>
                </div>
                <button
                  className="room-tile-action"
                  type="button"
                  onClick={() => void toggleTileFullscreen(peer.id)}
                  aria-label={
                    fullscreenTile === peer.id
                      ? "Sair da tela cheia"
                      : `Abrir a tela de ${displayName(peer.email, peer.alias)} em tela cheia`
                  }
                >
                  <RoomIcon
                    name={
                      fullscreenTile === peer.id
                        ? "exitFullscreen"
                        : "fullscreen"
                    }
                  />
                </button>
              </div>
              <RoomVideo
                stream={remoteStreams[peer.id]}
                label={displayName(peer.email, peer.alias)}
              />
            </article>
          ))}
          {!sharingCount ? (
            <div className="room-empty">
              <RoomIcon name="screen" />
              <h2>Ninguém está compartilhando ainda</h2>
              <p>
                Inicie uma transmissão para apresentar uma tarefa, fluxo ou
                demonstração ao projeto.
              </p>
            </div>
          ) : null}
        </div>

        <div className="room-controls">
          <div className="room-control-copy">
            <strong>
              <RoomIcon name="screen" />
              {sharingCount}/2 telas ativas
            </strong>
            <span>
              {participants.length} participante
              {participants.length === 1 ? "" : "s"} na sala
            </span>
          </div>
          <label className="room-audio-option">
            <input
              type="checkbox"
              checked={includeScreenAudio}
              onChange={(event) => setIncludeScreenAudio(event.target.checked)}
              disabled={isSharing || isPublishPending}
            />
            Áudio da tela
          </label>
          <button
            className="room-control-button room-primary-control"
            type="button"
            onClick={isSharing ? stopSharing : startSharing}
            disabled={status !== "connected" || isPublishPending}
          >
            {isPublishPending
              ? "Reservando vaga…"
              : isSharing
                ? "Parar compartilhamento"
                : "Compartilhar tela"}
          </button>
          <button
            className={`room-icon-control ${isMicEnabled ? "room-mic-active" : ""}`}
            type="button"
            onClick={toggleMic}
            disabled={status !== "connected"}
            aria-label={
              isMicEnabled ? "Desativar microfone" : "Ativar microfone"
            }
          >
            <RoomIcon name={isMicEnabled ? "mic" : "micOff"} />
          </button>
        </div>
      </section>
    </main>
  );
}
