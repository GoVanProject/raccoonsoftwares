"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { API_URL, taskboardFetch } from "../../../lib/taskboard";
import { WorkspaceAvatarStack, WorkspaceRail } from "../../components/workspace-ui";

type Project = { id: string; name: string; description: string };
type RoomPeer = { id: string; alias?: string; email: string; avatar_data?: string; publishing: boolean; mic_enabled: boolean };
type RoomTicket = { ticket: string; expires_at: string; ice_servers: RTCIceServer[] };
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
  pendingCandidates: RTCIceCandidateInit[];
};

const ROOM_PROTOCOL = "raccoon-room-v1";

type RoomIconName = "mic" | "micOff" | "fullscreen" | "exitFullscreen" | "screen" | "users";

function RoomIcon({ name }: { name: RoomIconName }) {
  const paths: Record<RoomIconName, ReactNode> = {
    mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" /></>,
    micOff: <><path d="m4 4 16 16" /><path d="M9 9v5a3 3 0 0 0 5.2 2.05M15 9V6a3 3 0 0 0-5.2-2.05" /><path d="M5.5 11a6.5 6.5 0 0 0 9.2 5.9M12 17.5V21M8.5 21h7" /></>,
    fullscreen: <><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5" /></>,
    exitFullscreen: <><path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6" /></>,
    screen: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>,
    users: <><path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" /><circle cx="10" cy="8" r="3" /><path d="M16 11a3 3 0 0 0 0-6M19.5 20v-1.5a3.5 3.5 0 0 0-2.5-3.35" /></>,
  };

  return <svg className="room-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
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

function RoomVideo({ stream, label, muted = false }: { stream: MediaStream; label: string; muted?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream;
    videoRef.current.muted = muted;
    void videoRef.current.play().catch(() => undefined);
    return () => {
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [stream]);

  return <video ref={videoRef} className="room-video" autoPlay playsInline muted={muted} aria-label={`Tela compartilhada por ${label}`} />;
}

export default function RoomPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [selfID, setSelfID] = useState("");
  const [peers, setPeers] = useState<RoomPeer[]>([]);
  const [selfPeer, setSelfPeer] = useState<RoomPeer | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [iceServers, setIceServers] = useState<RTCIceServer[]>([]);
  const [status, setStatus] = useState<"loading" | "connected" | "reconnecting" | "disconnected">("loading");
  const [error, setError] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [localScreen, setLocalScreen] = useState<MediaStream | null>(null);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isPublishPending, setIsPublishPending] = useState(false);
  const [includeScreenAudio, setIncludeScreenAudio] = useState(true);
  const [fullscreenTile, setFullscreenTile] = useState<string | null>(null);
  const [railExpanded, setRailExpanded] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const mountedRef = useRef(true);
  const leavingRef = useRef(false);
  const roomUnavailableRef = useRef(false);
  const connectingRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selfIDRef = useRef("");
  const iceServersRef = useRef<RTCIceServer[]>([]);
  const peersRef = useRef<RoomPeer[]>([]);
  const peerConnectionsRef = useRef<Map<string, PeerConnectionState>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const localScreenRef = useRef<MediaStream | null>(null);
  const localMicRef = useRef<MediaStream | null>(null);
  const tileRefs = useRef<Record<string, HTMLElement | null>>({});
  const publishRequestRef = useRef<{ resolve: () => void; reject: (reason: Error) => void } | null>(null);

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
    for (const peerID of peerConnectionsRef.current.keys()) closePeerConnection(peerID);
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
    publishRequestRef.current?.reject(new Error("A conexão com a sala foi encerrada."));
    publishRequestRef.current = null;
  }

  async function replaceLocalTracks() {
    const videoTrack = localScreenRef.current?.getVideoTracks()[0] || null;
    const screenAudioTrack = localScreenRef.current?.getAudioTracks()[0] || null;
    const micTrack = localMicRef.current?.getAudioTracks()[0] || null;
    await Promise.all(Array.from(peerConnectionsRef.current.values()).map(async (connection) => {
      await connection.videoSender.replaceTrack(videoTrack);
      await connection.screenAudioSender.replaceTrack(screenAudioTrack);
      await connection.micSender.replaceTrack(micTrack);
    }));
  }

  async function negotiatePeer(peerID: string, connection: PeerConnectionState) {
    try {
      connection.makingOffer = true;
      await connection.pc.setLocalDescription(await connection.pc.createOffer());
      if (connection.pc.localDescription) {
        const description: SignalDescription = { type: connection.pc.localDescription.type, sdp: connection.pc.localDescription.sdp };
        sendRoomMessage({ target: peerID, type: "signal", signal: { kind: "description", description } });
      }
    } catch (reason) {
      if (mountedRef.current) setError(reason instanceof Error ? reason.message : "Não foi possível negociar a conexão.");
    } finally {
      connection.makingOffer = false;
    }
  }

  function ensurePeerConnection(peer: RoomPeer, shouldOffer = false) {
    const existing = peerConnectionsRef.current.get(peer.id);
    if (existing) return existing;

    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
    const videoSender = pc.addTransceiver("video", { direction: "sendrecv" }).sender;
    const screenAudioSender = pc.addTransceiver("audio", { direction: "sendrecv" }).sender;
    const micSender = pc.addTransceiver("audio", { direction: "sendrecv" }).sender;
    const connection: PeerConnectionState = {
      pc,
      videoSender,
      screenAudioSender,
      micSender,
      polite: selfIDRef.current > peer.id,
      makingOffer: false,
      ignoreOffer: false,
      pendingCandidates: [],
    };
    peerConnectionsRef.current.set(peer.id, connection);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendRoomMessage({ target: peer.id, type: "signal", signal: { kind: "ice", candidate: event.candidate.toJSON() } });
      }
    };
    pc.ontrack = (event) => {
      const stream = remoteStreamsRef.current.get(peer.id) || new MediaStream();
      if (!stream.getTracks().some((track) => track.id === event.track.id)) stream.addTrack(event.track);
      remoteStreamsRef.current.set(peer.id, stream);
      setRemoteStreams((current) => ({ ...current, [peer.id]: stream }));
      event.track.onended = () => {
        if (stream.getTracks().some((track) => track.readyState === "live")) return;
        removeRemoteStream(peer.id);
      };
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") closePeerConnection(peer.id);
    };
    pc.onnegotiationneeded = () => { void negotiatePeer(peer.id, connection); };

    if (shouldOffer) setTimeout(() => { if (pc.signalingState === "stable") void negotiatePeer(peer.id, connection); }, 0);
    return connection;
  }

  async function handleSignal(peerID: string, signal: SignalPayload) {
    const peer = peersRef.current.find((item) => item.id === peerID);
    if (!peer) return;
    const connection = ensurePeerConnection(peer);
    if (signal.kind === "ice") {
      if (connection.pc.remoteDescription) {
        await connection.pc.addIceCandidate(signal.candidate).catch(() => undefined);
      } else {
        connection.pendingCandidates.push(signal.candidate);
      }
      return;
    }

    const description = signal.description;
    const offerCollision = description.type === "offer" && (connection.makingOffer || connection.pc.signalingState !== "stable");
    connection.ignoreOffer = !connection.polite && offerCollision;
    if (connection.ignoreOffer) return;
    try {
      await connection.pc.setRemoteDescription(description);
      for (const candidate of connection.pendingCandidates.splice(0)) {
        await connection.pc.addIceCandidate(candidate).catch(() => undefined);
      }
      if (description.type === "offer") {
        await connection.pc.setLocalDescription();
        if (connection.pc.localDescription) {
          const answer: SignalDescription = { type: connection.pc.localDescription.type, sdp: connection.pc.localDescription.sdp };
          sendRoomMessage({ target: peerID, type: "signal", signal: { kind: "description", description: answer } });
        }
      }
    } catch (reason) {
      if (mountedRef.current) setError(reason instanceof Error ? reason.message : "Não foi possível conectar este participante.");
    }
  }

  function handleRoomMessage(payload: string) {
    let message: { type: string; code?: string; message?: string; self_id?: string; peer?: RoomPeer; peers?: RoomPeer[]; from?: string; signal?: SignalPayload };
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
      nextPeers.forEach((peer) => ensurePeerConnection(peer, true));
      return;
    }
    if (message.type === "peer_joined" && message.peer) {
      updatePeers((current) => [...current.filter((peer) => peer.id !== message.peer?.id), message.peer as RoomPeer]);
      ensurePeerConnection(message.peer);
      void replaceLocalTracks().catch(() => undefined);
      return;
    }
    if (message.type === "peer_left" && message.peer) {
      updatePeers((current) => current.filter((peer) => peer.id !== message.peer?.id));
      closePeerConnection(message.peer.id);
      return;
    }
    if (message.type === "peer_state" && message.peer) {
      if (message.peer.id === selfIDRef.current) {
        setIsSharing(message.peer.publishing);
        setIsMicEnabled(message.peer.mic_enabled);
        setSelfPeer(message.peer);
      } else {
        updatePeers((current) => current.map((peer) => peer.id === message.peer?.id ? message.peer as RoomPeer : peer));
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
      publishRequestRef.current?.reject(new Error(message.message || "Não foi possível compartilhar a tela."));
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
    if (!token || !projectId || connectingRef.current || leavingRef.current) return;
    connectingRef.current = true;
    roomUnavailableRef.current = false;
    setStatus((current) => current === "connected" ? current : "loading");
    setError("");
    try {
      const [projectResponse, ticketResponse] = await Promise.all([
        taskboardFetch<{ project: Project }>(`/api/projects/${projectId}`, token),
        taskboardFetch<RoomTicket>(`/api/projects/${projectId}/room/ticket`, token, { method: "POST" }),
      ]);
      if (!mountedRef.current || leavingRef.current) return;
      setProject(projectResponse.project);
      setIceServers(ticketResponse.ice_servers || []);
      iceServersRef.current = ticketResponse.ice_servers || [];
      resetPeerConnections();
      const socket = new WebSocket(socketURL(`/api/projects/${projectId}/room/ws`), [ROOM_PROTOCOL, ticketResponse.ticket]);
      socketRef.current = socket;
      socket.onopen = () => {
        if (mountedRef.current) setStatus("connected");
      };
      socket.onmessage = (event) => handleRoomMessage(event.data);
      socket.onerror = () => {
        if (mountedRef.current) setError("Não foi possível manter a conexão com a sala.");
      };
      socket.onclose = () => {
        if (!mountedRef.current || leavingRef.current || roomUnavailableRef.current) return;
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
      const message = reason instanceof Error ? reason.message : "Não foi possível abrir a sala.";
      if (message.includes("token")) {
        window.localStorage.removeItem("taskboard_token");
        router.replace("/login");
      } else {
        setError(message);
        setStatus("disconnected");
      }
    } finally {
      connectingRef.current = false;
    }
  }

  async function waitForPublishSlot() {
    if (socketRef.current?.readyState !== WebSocket.OPEN) throw new Error("A sala ainda está conectando.");
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
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: includeScreenAudio });
      localScreenRef.current = stream;
      setLocalScreen(stream);
      await replaceLocalTracks();
      setIsSharing(true);
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) videoTrack.onended = () => { void stopSharing(); };
    } catch (reason) {
      sendRoomMessage({ type: "publish_stop" });
      setIsPublishPending(false);
      const message = reason instanceof Error ? reason.message : "Não foi possível compartilhar a tela.";
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
      localMicRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      await replaceLocalTracks();
      sendRoomMessage({ type: "mic_state", enabled: true });
      setIsMicEnabled(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível acessar o microfone.");
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

  function leaveRoom(destination = "/workspace") {
    leavingRef.current = true;
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    void stopSharing();
    stopLocalMedia();
    resetPeerConnections();
    socketRef.current?.close(1000, "saída da sala");
    router.push(destination);
  }

  function logout() {
    window.localStorage.removeItem("taskboard_token");
    leaveRoom("/login");
  }

  useEffect(() => {
    function handleFullscreenChange() {
      if (!document.fullscreenElement) setFullscreenTile(null);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    const storedToken = window.localStorage.getItem("taskboard_token");
    if (!storedToken) {
      router.replace("/login");
      return;
    }
    setToken(storedToken);
  }, [router]);

  useEffect(() => {
    if (!token) return;
    mountedRef.current = true;
    leavingRef.current = false;
    void connectRoom();
    return () => {
      mountedRef.current = false;
      leavingRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      socketRef.current?.close(1000, "saída da página");
      stopLocalMedia();
      resetPeerConnections();
    };
  }, [token, projectId]);

  const remoteTiles = useMemo(() => peers.filter((peer) => peer.publishing && remoteStreams[peer.id]), [peers, remoteStreams]);
  const participants = useMemo(() => selfPeer ? [selfPeer, ...peers] : peers, [selfPeer, peers]);
  const sharingCount = remoteTiles.length + (isSharing ? 1 : 0);
  const statusLabel = status === "connected" ? "Sala conectada" : status === "reconnecting" ? "Reconectando" : status === "loading" ? "Abrindo sala" : "Sala desconectada";

  return (
    <main className="workspace-page room-page">
      <WorkspaceRail mode="room" projectId={projectId} expanded={railExpanded} onToggleExpanded={() => setRailExpanded((current) => !current)} onLogout={logout} />
      <section className="room-shell">
        <div className="room-heading">
          <div>
            <Link className="room-back-link" href={`/workspace`}>← Voltar ao quadro</Link>
            <span className="workspace-kicker">Sala ao vivo</span>
            <h1>{project?.name || "Sala do projeto"}</h1>
            <p>Compartilhe uma tela com a equipe e acompanhe até duas transmissões ao mesmo tempo.</p>
          </div>
          <div className="room-heading-side">
            <div className="room-participants-heading"><RoomIcon name="users" /><span>Participantes</span><b>{participants.length}</b></div>
            <WorkspaceAvatarStack members={participants} max={8} currentId={selfID} label={`${participants.length} participante${participants.length === 1 ? "" : "s"} na sala`} />
            <div className={`room-status room-status-${status}`}><span />{statusLabel}</div>
          </div>
        </div>

        {error ? <div className="workspace-error" role="alert">{error}<button type="button" onClick={() => setError("")}>×</button></div> : null}

        <div className="room-grid" aria-live="polite">
          {isSharing && localScreen ? <article className="room-tile room-tile-local" ref={(element) => { tileRefs.current.local = element; }}>
            <div className="room-tile-label"><div className="room-tile-meta"><span className="room-tile-avatar">{selfPeer?.avatar_data ? <img className="room-tile-avatar-image" src={selfPeer.avatar_data} alt="" /> : selfPeer ? initials(selfPeer.email, selfPeer.alias) : "EU"}</span><span><strong>Você</strong><small>Transmitindo</small></span></div><button className="room-tile-action" type="button" onClick={() => void toggleTileFullscreen("local")} aria-label={fullscreenTile === "local" ? "Sair da tela cheia" : "Abrir tela compartilhada em tela cheia"} title={fullscreenTile === "local" ? "Sair da tela cheia" : "Tela cheia"}><RoomIcon name={fullscreenTile === "local" ? "exitFullscreen" : "fullscreen"} /></button></div>
            <RoomVideo stream={localScreen} label="você" muted />
          </article> : null}
          {remoteTiles.map((peer) => <article className="room-tile" key={peer.id} ref={(element) => { tileRefs.current[peer.id] = element; }}>
            <div className="room-tile-label"><div className="room-tile-meta"><span className="room-tile-avatar">{peer.avatar_data ? <img className="room-tile-avatar-image" src={peer.avatar_data} alt="" /> : initials(peer.email, peer.alias)}</span><span><strong>{displayName(peer.email, peer.alias)}</strong><small>{peer.mic_enabled ? "Com áudio" : "Tela compartilhada"}</small></span></div><button className="room-tile-action" type="button" onClick={() => void toggleTileFullscreen(peer.id)} aria-label={fullscreenTile === peer.id ? "Sair da tela cheia" : `Abrir a tela de ${displayName(peer.email, peer.alias)} em tela cheia`} title={fullscreenTile === peer.id ? "Sair da tela cheia" : "Tela cheia"}><RoomIcon name={fullscreenTile === peer.id ? "exitFullscreen" : "fullscreen"} /></button></div>
            <RoomVideo stream={remoteStreams[peer.id]} label={displayName(peer.email, peer.alias)} />
          </article>)}
          {!sharingCount ? <div className="room-empty"><span>▣</span><h2>Ninguém está compartilhando ainda</h2><p>Inicie uma transmissão para apresentar uma tarefa, fluxo ou demonstração ao projeto.</p></div> : null}
        </div>

        <div className="room-controls">
          <div className="room-control-copy"><strong><RoomIcon name="screen" />{sharingCount}/2 telas ativas</strong><span>{participants.length} participante{participants.length === 1 ? "" : "s"} na sala</span></div>
          <label className="room-audio-option"><input type="checkbox" checked={includeScreenAudio} onChange={(event) => setIncludeScreenAudio(event.target.checked)} disabled={isSharing || isPublishPending} />Áudio da tela</label>
          <button className="room-control-button room-primary-control" type="button" onClick={isSharing ? stopSharing : startSharing} disabled={status !== "connected" || isPublishPending}>{isPublishPending ? "Reservando vaga…" : isSharing ? "Parar compartilhamento" : "Compartilhar tela"}</button>
          <button className={`room-icon-control ${isMicEnabled ? "room-mic-active" : ""}`} type="button" onClick={toggleMic} disabled={status !== "connected"} aria-label={isMicEnabled ? "Desativar microfone" : "Ativar microfone"} title={isMicEnabled ? "Desativar microfone" : "Ativar microfone"}><RoomIcon name={isMicEnabled ? "mic" : "micOff"} /><span className="sr-only">{isMicEnabled ? "Desativar microfone" : "Ativar microfone"}</span></button>
        </div>
      </section>
    </main>
  );
}
