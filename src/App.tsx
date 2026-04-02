import { useEffect, useMemo, useRef, useState } from "react";
import {
  BoxSelect,
  ChevronsDown,
  ChevronsUp,
  Copy,
  Download,
  Eraser,
  Grid3X3,
  ImagePlus,
  Import,
  LayoutPanelTop,
  Link2,
  LogOut,
  Maximize2,
  QrCode,
  RefreshCcw,
  Sparkles,
  StickyNote,
  Trash2,
  Users,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import { motion } from "motion/react";
import QRCode from "qrcode";
import { Peer, type PeerJSOption } from "peerjs";
import { Canvas, Point } from "fabric";
import { toast } from "sonner";
import {
  APP_NAME,
  STICKY_COLORS,
  buildBezierPath,
  buildShareUrl,
  canSnapToZone,
  createConnector,
  createImage,
  createSnapshot,
  createSticky,
  createZone,
  downloadJson,
  generateRoomId,
  getObjectById,
  getObjectCenter,
  normalizePeerPath,
  randomCursorColor,
  randomName,
  readFileAsDataUrl,
  readFileAsText,
  serializeObject,
  util,
  type BoardMessage,
  type BoardObjectPayload,
  type CursorPresence,
  type LocalSignalingConfig,
  type LayoutMode,
  type SessionRole
} from "./lib/board";


function App() {
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const search = searchParams;
  const [role, setRole] = useState<SessionRole>(() => (searchParams.get("room") ? "peer" : "host"));
  const [displayName, setDisplayName] = useState(() => randomName());
  const [roomId, setRoomId] = useState(() => searchParams.get("room") || generateRoomId());
  const [status, setStatus] = useState("Listo para iniciar");
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("free");
  const [peerCount, setPeerCount] = useState(0);
  const [selfPeerId, setSelfPeerId] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [remoteCursors, setRemoteCursors] = useState<Record<string, CursorPresence>>({});
  const [boardVersion, setBoardVersion] = useState(0);
  const [page, setPage] = useState<"setup" | "board">("setup");
  const [showInvite, setShowInvite] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [vpTransform, setVpTransform] = useState<number[]>([1, 0, 0, 1, 0, 0]);
  const [useLocalSignaling, setUseLocalSignaling] = useState(() => Boolean(searchParams.get("peerHost")));
  const [signalingHost, setSignalingHost] = useState(
    () => searchParams.get("peerHost") || window.location.hostname || "localhost"
  );
  const [signalingPort, setSignalingPort] = useState(() => searchParams.get("peerPort") || "9000");
  const [signalingPath, setSignalingPath] = useState(
    () => normalizePeerPath(searchParams.get("peerPath") || "/aulaflux")
  );

  const localCursorColorRef = useRef(randomCursorColor());
  const canvasRef = useRef<any>(null);
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const isPanningRef = useRef(false);
  const lastPanPosRef = useRef({ x: 0, y: 0 });
  const peerRef = useRef<Peer | null>(null);
  const hostConnectionRef = useRef<any>(null);
  const hostConnectionsRef = useRef<Map<string, any>>(new Map());
  const reconnectInputRef = useRef<HTMLInputElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const lastCursorSentAtRef = useRef(0);
  const layoutModeRef = useRef(layoutMode);
  const roleRef = useRef(role);
  const roomIdRef = useRef(roomId);
  const displayNameRef = useRef(displayName);
  const selfPeerIdRef = useRef(selfPeerId);

  useEffect(() => {
    layoutModeRef.current = layoutMode;
  }, [layoutMode]);

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  useEffect(() => {
    displayNameRef.current = displayName;
  }, [displayName]);

  useEffect(() => {
    selfPeerIdRef.current = selfPeerId;
  }, [selfPeerId]);

  const localSignalingError = useMemo(() => {
    if (!useLocalSignaling) return "";
    if (!signalingHost.trim()) {
      return "Indica el host o la IP del PeerServer local";
    }

    const parsedPort = Number(signalingPort);
    if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      return "El puerto debe estar entre 1 y 65535";
    }

    return "";
  }, [signalingHost, signalingPort, useLocalSignaling]);

  const localSignalingConfig = useMemo<LocalSignalingConfig | null>(() => {
    if (!useLocalSignaling || localSignalingError) {
      return null;
    }

    return {
      host: signalingHost.trim(),
      port: Number(signalingPort),
      path: normalizePeerPath(signalingPath)
    };
  }, [localSignalingError, signalingHost, signalingPath, signalingPort, useLocalSignaling]);

  const peerOptions = useMemo<PeerJSOption | undefined>(() => {
    if (!localSignalingConfig) {
      return undefined;
    }

    return {
      host: localSignalingConfig.host,
      port: localSignalingConfig.port,
      path: localSignalingConfig.path,
      secure: window.location.protocol === "https:"
    };
  }, [localSignalingConfig]);

  const joinUrl = useMemo(
    () => buildShareUrl(roomId, localSignalingConfig),
    [localSignalingConfig, roomId]
  );

  useEffect(() => {
    let ignore = false;
    QRCode.toDataURL(joinUrl, {
      margin: 1,
      width: 280,
      color: {
        dark: "#E2E8F0",
        light: "#0000"
      }
    }).then((data: string) => {
      if (!ignore) {
        setQrDataUrl(data);
      }
    });
    return () => {
      ignore = true;
    };
  }, [joinUrl]);

  const updateSelection = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObjects();
    setSelectedIds(active.map((object: any) => object.id).filter(Boolean));
  };

  const updateStatus = (value: string) => {
    setStatus(value);
  };

  const bumpBoardVersion = () => {
    setBoardVersion((current) => current + 1);
  };

  const sendMessage = (message: BoardMessage, exceptPeerId?: string) => {
    if (roleRef.current === "host") {
      hostConnectionsRef.current.forEach((connection, peerId) => {
        if (peerId !== exceptPeerId && connection.open) {
          connection.send(message);
        }
      });
      return;
    }

    if (hostConnectionRef.current?.open) {
      hostConnectionRef.current.send(message);
    }
  };

  const syncConnectorsForObject = (objectId?: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.getObjects().forEach((object: any) => {
      if (object.kind !== "connector") return;
      if (
        objectId &&
        object.sourceId !== objectId &&
        object.targetId !== objectId
      ) {
        return;
      }

      const source = getObjectById(canvas, object.sourceId);
      const target = getObjectById(canvas, object.targetId);
      if (!source || !target) return;
      const start = getObjectCenter(source);
      const end = getObjectCenter(target);
      const newPathStr = buildBezierPath(start, end);
      object.path = util.parsePath(newPathStr);
      object.dirty = true;
      object.setCoords();
    });
    canvas.requestRenderAll();
  };

  const reflowZone = (zoneId: string) => {
    const canvas = canvasRef.current;
    if (!canvas || layoutModeRef.current !== "grid") return;
    const zone = getObjectById(canvas, zoneId);
    if (!zone) return;

    const items = canvas
      .getObjects()
      .filter((object: any) => canSnapToZone(object) && object.zoneId === zoneId)
      .sort(
        (left: any, right: any) => (left.sortOrder || 0) - (right.sortOrder || 0)
      );

    const padding = 26;
    const gap = 18;
    const zoneWidth = zone.getScaledWidth();
    const cellWidth = 200;
    const cellHeight = 150;
    const columns = Math.max(
      1,
      Math.floor((zoneWidth - padding * 2 + gap) / (cellWidth + gap))
    );

    items.forEach((item: any, index: number) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      item.set({
        left: zone.left + padding + column * (cellWidth + gap),
        top: zone.top + padding + row * (cellHeight + gap)
      });

      if (item.kind === "sticky") {
        item.set({
          width: cellWidth
        });
      }

      if (item.kind === "image") {
        const imageWidth = item.width || 240;
        const imageHeight = item.height || 180;
        const fitScale = Math.min(
          1,
          cellWidth / imageWidth,
          (cellHeight - 10) / imageHeight
        );
        item.set({
          scaleX: fitScale,
          scaleY: fitScale
        });
      }

      item.updatedAt = Date.now();
      item.setCoords();
      syncConnectorsForObject(item.id);
      sendMessage({
        action: "UPSERT_OBJECT",
        sender: displayNameRef.current,
        payload: { object: serializeObject(item) }
      });
    });

    canvas.requestRenderAll();
    bumpBoardVersion();
  };

  const updateZoneMembership = (object: any, broadcast = true) => {
    const canvas = canvasRef.current;
    if (!canvas || !canSnapToZone(object)) return;

    const containingZone = canvas
      .getObjects()
      .find((candidate: any) => candidate.kind === "zone" && object.intersectsWithObject(candidate));

    const nextZoneId = containingZone?.id || null;
    if (object.zoneId !== nextZoneId) {
      object.zoneId = nextZoneId;
      object.sortOrder = Date.now();
    }

    if (layoutModeRef.current === "grid" && nextZoneId) {
      reflowZone(nextZoneId);
    }

    if (broadcast) {
      object.updatedAt = Date.now();
      sendMessage({
        action: "UPSERT_OBJECT",
        sender: displayNameRef.current,
        payload: { object: serializeObject(object) }
      });
    }
  };

  const loadSnapshot = async (snapshot: any, shouldBroadcast = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      await canvas.loadFromJSON(snapshot.canvas);
    } catch (error) {
      console.error("loadFromJSON failed:", error);
      toast.error("Error al cargar el lienzo desde el snapshot");
      return;
    }
    canvas.backgroundColor = "#f8fafc";
    canvas.requestRenderAll();
    setLayoutMode(snapshot.meta?.layoutMode || "free");
    layoutModeRef.current = snapshot.meta?.layoutMode || "free";
    syncConnectorsForObject();
    bumpBoardVersion();

    if (shouldBroadcast) {
      sendMessage({
        action: "SYNC_SNAPSHOT",
        sender: displayNameRef.current,
        payload: { snapshot }
      });
    }
  };

  const applyObjectPayload = async (payload: BoardObjectPayload) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const existing = getObjectById(canvas, payload.id);
    if (existing && (existing.updatedAt || 0) > payload.updatedAt) {
      return;
    }

    if (existing) {
      if (payload.kind === "sticky") {
        existing.set({
          left: payload.left,
          top: payload.top,
          width: payload.width,
          text: payload.text,
          backgroundColor: payload.backgroundColor,
          angle: payload.angle || 0
        });
      } else if (payload.kind === "image") {
        existing.set({
          left: payload.left,
          top: payload.top,
          scaleX: payload.scaleX || 1,
          scaleY: payload.scaleY || 1,
          angle: payload.angle || 0
        });
      } else if (payload.kind === "zone") {
        existing.set({
          left: payload.left,
          top: payload.top,
          width: payload.width,
          height: payload.height
        });
      } else if (payload.kind === "connector") {
        existing.set({
          sourceId: payload.sourceId,
          targetId: payload.targetId
        });
      }

      existing.zoneId = payload.zoneId ?? null;
      existing.sortOrder = payload.sortOrder;
      existing.updatedAt = payload.updatedAt;
      existing.setCoords();
      syncConnectorsForObject(payload.id);
      if (payload.kind === "zone") {
        reflowZone(payload.id);
      }
      canvas.requestRenderAll();
      bumpBoardVersion();
      return;
    }

    let object: any = null;
    if (payload.kind === "sticky") {
      object = createSticky(payload);
    }

    if (payload.kind === "zone") {
      object = createZone(payload);
    }

    if (payload.kind === "image") {
      try {
        object = await createImage(payload);
      } catch (error) {
        console.error("createImage failed in applyObjectPayload:", error);
        return;
      }
    }

    if (payload.kind === "connector") {
      const source = getObjectById(canvas, payload.sourceId || "");
      const target = getObjectById(canvas, payload.targetId || "");
      if (!source || !target) {
        return;
      }
      object = createConnector(payload, getObjectCenter(source), getObjectCenter(target));
    }

    if (!object) return;
    canvas.add(object);
    if (payload.kind === "connector") {
      canvas.sendObjectToBack(object);
    }
    object.updatedAt = payload.updatedAt;
    object.zoneId = payload.zoneId ?? null;
    object.sortOrder = payload.sortOrder;
    object.setCoords();
    if (payload.kind === "connector") {
      syncConnectorsForObject(payload.sourceId);
      syncConnectorsForObject(payload.targetId);
    }
    if (payload.zoneId && layoutModeRef.current === "grid") {
      reflowZone(payload.zoneId);
    }
    canvas.requestRenderAll();
    bumpBoardVersion();
  };

  const removeObjectById = (id: string, updatedAt = Date.now(), broadcast = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const target = getObjectById(canvas, id);
    if (!target) return;
    if ((target.updatedAt || 0) > updatedAt) return;

    const relatedConnectors = canvas
      .getObjects()
      .filter(
        (object: any) =>
          object.kind === "connector" &&
          (object.sourceId === id || object.targetId === id)
      );

    [...relatedConnectors, target].forEach((object: any) => {
      canvas.remove(object);
      if (broadcast) {
        sendMessage({
          action: "REMOVE_OBJECT",
          sender: displayNameRef.current,
          payload: { id: object.id, updatedAt }
        });
      }
    });

    canvas.discardActiveObject();
    canvas.requestRenderAll();
    updateSelection();
    bumpBoardVersion();
  };

  const handleIncomingMessage = async (message: BoardMessage, connection?: any) => {
    if (!message || typeof message !== "object" || !("action" in message)) return;

    if (message.action === "HELLO" && roleRef.current === "host") {
      if (
        !message.payload ||
        typeof message.payload.name !== "string" ||
        typeof message.payload.color !== "string"
      ) return;
      updateStatus(`Sala activa con ${hostConnectionsRef.current.size} peer(s)`);
      connection?.send({
        action: "SYNC_SNAPSHOT",
        sender: displayNameRef.current,
        payload: { snapshot: createSnapshot(canvasRef.current, layoutModeRef.current) }
      } satisfies BoardMessage);
      return;
    }

    if (message.action === "SYNC_SNAPSHOT") {
      if (!message.payload?.snapshot) return;
      await loadSnapshot(message.payload.snapshot);
      updateStatus("Lienzo sincronizado");
      return;
    }

    if (message.action === "UPSERT_OBJECT") {
      const obj = message.payload?.object;
      if (!obj || typeof obj.id !== "string" || typeof obj.kind !== "string") return;
      await applyObjectPayload(obj);
      if (roleRef.current === "host") {
        sendMessage(message, connection?.peer);
      }
      return;
    }

    if (message.action === "REMOVE_OBJECT") {
      const { id, updatedAt } = message.payload ?? ({} as any);
      if (typeof id !== "string") return;
      removeObjectById(id, typeof updatedAt === "number" ? updatedAt : Date.now(), false);
      if (roleRef.current === "host") {
        sendMessage(message, connection?.peer);
      }
      return;
    }

    if (message.action === "UPDATE_META") {
      const mode = message.payload?.layoutMode;
      if (mode !== "free" && mode !== "grid") return;
      setLayoutMode(mode);
      layoutModeRef.current = mode;
      if (roleRef.current === "host") {
        sendMessage(message, connection?.peer);
      }
      canvasRef.current?.requestRenderAll();
      return;
    }

    if (message.action === "CURSOR") {
      const cursor = message.payload;
      if (
        !cursor ||
        typeof cursor.peerId !== "string" ||
        typeof cursor.x !== "number" ||
        typeof cursor.y !== "number"
      ) return;
      setRemoteCursors((current) => ({
        ...current,
        [cursor.peerId]: cursor
      }));
      if (roleRef.current === "host") {
        sendMessage(message, connection?.peer);
      }
    }
  };

  const wireConnection = (connection: any) => {
    connection.on("open", () => {
      if (roleRef.current === "host") {
        hostConnectionsRef.current.set(connection.peer, connection);
        setPeerCount(hostConnectionsRef.current.size);
        updateStatus(`Sala activa con ${hostConnectionsRef.current.size} peer(s)`);
      } else {
        hostConnectionRef.current = connection;
        updateStatus(`Conectado a ${roomIdRef.current}`);
        connection.send({
          action: "HELLO",
          sender: displayNameRef.current,
          payload: {
            name: displayNameRef.current,
            color: localCursorColorRef.current
          }
        } satisfies BoardMessage);
      }
    });

    connection.on("data", async (data: unknown) => {
      await handleIncomingMessage(data as BoardMessage, connection);
    });

    connection.on("close", () => {
      if (roleRef.current === "host") {
        hostConnectionsRef.current.delete(connection.peer);
        setPeerCount(hostConnectionsRef.current.size);
      } else {
        hostConnectionRef.current = null;
        updateStatus("Conexión cerrada");
      }

      setRemoteCursors((current) => {
        const next = { ...current };
        delete next[connection.peer];
        return next;
      });
    });

    connection.on("error", (error: Error) => {
      toast.error(error.message || "Error de conexión P2P");
    });
  };

  const disconnectNetwork = () => {
    hostConnectionsRef.current.forEach((connection) => connection.close());
    hostConnectionsRef.current.clear();
    hostConnectionRef.current?.close();
    hostConnectionRef.current = null;
    peerRef.current?.destroy();
    peerRef.current = null;
    setPeerCount(0);
    setSelfPeerId("");
    setRemoteCursors({});
  };

  const startNetworking = () => {
    disconnectNetwork();

    let peer: Peer;
    if (roleRef.current === "host") {
      peer = peerOptions ? new Peer(roomIdRef.current, peerOptions) : new Peer(roomIdRef.current);
    } else {
      peer = peerOptions ? new Peer(peerOptions) : new Peer();
    }

    peerRef.current = peer;
    updateStatus(roleRef.current === "host" ? "Abriendo sala..." : "Conectando...");

    peer.on("open", (id) => {
      setSelfPeerId(id);
      if (roleRef.current === "host") {
        updateStatus("Sala lista para compartir");
      } else {
        const connection = peer.connect(roomIdRef.current, {
          reliable: true
        });
        wireConnection(connection);
      }
    });

    peer.on("connection", (connection) => {
      wireConnection(connection);
    });

    peer.on("error", (error) => {
      toast.error(error.message || "No se pudo iniciar la sesión");
      updateStatus("Error en señalización");
    });

    peer.on("disconnected", () => {
      updateStatus("Peer desconectado");
    });
  };

  useEffect(() => {
    if (page !== "board") return;
    if (!canvasElementRef.current || !canvasContainerRef.current) return;
    const container = canvasContainerRef.current;

    const canvas = new Canvas(canvasElementRef.current, {
      backgroundColor: "#f8fafc",
      selection: true,
      preserveObjectStacking: true
    });
    canvas.setDimensions({ width: container.clientWidth, height: container.clientHeight });
    canvasRef.current = canvas;

    const ro = new ResizeObserver(() => {
      canvas.setDimensions({ width: container.clientWidth, height: container.clientHeight });
      canvas.requestRenderAll();
    });
    ro.observe(container);

    canvas.on("selection:created", updateSelection);
    canvas.on("selection:updated", updateSelection);
    canvas.on("selection:cleared", updateSelection);
    canvas.on("object:moving", ({ target }: any) => {
      if (!target) return;
      syncConnectorsForObject(target.id);
    });
    canvas.on("object:scaling", ({ target }: any) => {
      if (!target) return;
      syncConnectorsForObject(target.id);
    });
    canvas.on("object:modified", ({ target }: any) => {
      if (!target) return;
      target.updatedAt = Date.now();
      updateZoneMembership(target, false);
      syncConnectorsForObject(target.id);
      sendMessage({
        action: "UPSERT_OBJECT",
        sender: displayNameRef.current,
        payload: { object: serializeObject(target) }
      });
      bumpBoardVersion();
    });
    canvas.on("text:changed", ({ target }: any) => {
      if (!target) return;
      target.updatedAt = Date.now();
      sendMessage({
        action: "UPSERT_OBJECT",
        sender: displayNameRef.current,
        payload: { object: serializeObject(target) }
      });
      bumpBoardVersion();
    });

    canvas.on("mouse:wheel", (opt: any) => {
      const e = opt.e as WheelEvent;
      e.preventDefault();
      let z = canvas.getZoom();
      z *= 0.999 ** e.deltaY;
      z = Math.min(Math.max(z, 0.08), 8);
      canvas.zoomToPoint(new Point(e.offsetX, e.offsetY), z);
      const vpt = canvas.viewportTransform as number[];
      setZoom(z);
      setVpTransform([...vpt]);
    });

    canvas.on("mouse:down", (opt: any) => {
      const e = opt.e as MouseEvent;
      if (e.altKey || e.button === 1) {
        isPanningRef.current = true;
        canvas.selection = false;
        lastPanPosRef.current = { x: e.clientX, y: e.clientY };
        (canvas.upperCanvasEl as HTMLElement).style.cursor = "grab";
      }
    });

    canvas.on("mouse:move", (opt: any) => {
      const e = opt.e as MouseEvent;
      if (isPanningRef.current) {
        const dx = e.clientX - lastPanPosRef.current.x;
        const dy = e.clientY - lastPanPosRef.current.y;
        lastPanPosRef.current = { x: e.clientX, y: e.clientY };
        canvas.relativePan(new Point(dx, dy));
        const vpt = canvas.viewportTransform as number[];
        setVpTransform([...vpt]);
        return;
      }

      if (!e) return;
      const now = Date.now();
      if (now - lastCursorSentAtRef.current < 100) return;
      lastCursorSentAtRef.current = now;
      const pointer = canvas.getScenePoint(e);
      const message: BoardMessage = {
        action: "CURSOR",
        sender: displayNameRef.current,
        payload: {
          peerId: selfPeerIdRef.current || "local",
          name: displayNameRef.current,
          color: localCursorColorRef.current,
          x: pointer.x,
          y: pointer.y
        }
      };
      if (roleRef.current === "host") {
        setRemoteCursors((current) => ({ ...current, host: message.payload }));
      }
      sendMessage(message);
    });

    canvas.on("mouse:up", () => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        canvas.selection = true;
        (canvas.upperCanvasEl as HTMLElement).style.cursor = "";
      }
    });

    startNetworking();

    return () => {
      ro.disconnect();
      disconnectNetwork();
      canvas.dispose();
    };
  }, [page, peerOptions]);

  useEffect(() => {
    if (!search.get("room")) return;
    updateStatus("Parámetros de invitación detectados");
  }, []);

  const selectedSticky = useMemo(() => {
    const canvas = canvasRef.current;
    if (!canvas || selectedIds.length !== 1) return null;
    const selected = getObjectById(canvas, selectedIds[0]);
    return selected?.kind === "sticky" ? selected : null;
  }, [selectedIds]);

  const addStickyNote = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const payload: BoardObjectPayload = {
      id: crypto.randomUUID(),
      kind: "sticky",
      text: "Nueva idea",
      left: 240 + Math.random() * 360,
      top: 220 + Math.random() * 260,
      width: 220,
      backgroundColor: STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)],
      updatedAt: Date.now()
    };
    const sticky = createSticky(payload);
    canvas.add(sticky);
    canvas.setActiveObject(sticky);
    canvas.requestRenderAll();
    sendMessage({
      action: "UPSERT_OBJECT",
      sender: displayNameRef.current,
      payload: { object: serializeObject(sticky) }
    });
    updateSelection();
    bumpBoardVersion();
  };

  const addZoneCard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const payload: BoardObjectPayload = {
      id: crypto.randomUUID(),
      kind: "zone",
      left: 140 + Math.random() * 480,
      top: 120 + Math.random() * 280,
      width: 520,
      height: 360,
      name: `Zona ${canvas.getObjects().filter((object: any) => object.kind === "zone").length + 1}`,
      updatedAt: Date.now()
    };
    const zone = createZone(payload);
    canvas.add(zone);
    canvas.setActiveObject(zone);
    canvas.requestRenderAll();
    sendMessage({
      action: "UPSERT_OBJECT",
      sender: displayNameRef.current,
      payload: { object: serializeObject(zone) }
    });
    bumpBoardVersion();
  };

  const addConnection = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const targets = canvas
      .getActiveObjects()
      .filter((object: any) => object.kind !== "connector" && object.kind !== "zone");
    if (targets.length !== 2) {
      toast.info("Selecciona exactamente dos elementos para crear el conector");
      return;
    }

    const payload: BoardObjectPayload = {
      id: crypto.randomUUID(),
      kind: "connector",
      sourceId: targets[0].id,
      targetId: targets[1].id,
      updatedAt: Date.now()
    };
    const connector = createConnector(
      payload,
      getObjectCenter(targets[0]),
      getObjectCenter(targets[1])
    );
    canvas.add(connector);
    canvas.sendObjectToBack(connector);
    canvas.requestRenderAll();
    sendMessage({
      action: "UPSERT_OBJECT",
      sender: displayNameRef.current,
      payload: { object: serializeObject(connector) }
    });
    bumpBoardVersion();
  };

  const deleteSelection = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const targets = canvas.getActiveObjects();
    if (!targets.length) return;
    targets.forEach((target: any) => removeObjectById(target.id, Date.now(), true));
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    bumpBoardVersion();
  };

  const updateStickyColor = (color: string) => {
    if (!selectedSticky) return;
    selectedSticky.set({
      backgroundColor: color
    });
    selectedSticky.updatedAt = Date.now();
    canvasRef.current?.requestRenderAll();
    sendMessage({
      action: "UPSERT_OBJECT",
      sender: displayNameRef.current,
      payload: { object: serializeObject(selectedSticky) }
    });
    bumpBoardVersion();
  };

  const handleImageFiles = async (files: FileList | null) => {
    const canvas = canvasRef.current;
    const file = files?.[0];
    if (!canvas || !file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Solo se admiten imágenes");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("La imagen supera el límite de 2MB");
      return;
    }
    try {
      const src = await readFileAsDataUrl(file);
      const payload: BoardObjectPayload = {
        id: crypto.randomUUID(),
        kind: "image",
        src,
        left: 260 + Math.random() * 280,
        top: 260 + Math.random() * 220,
        scaleX: 0.7,
        scaleY: 0.7,
        updatedAt: Date.now()
      };
      const image = await createImage(payload);
      canvas.add(image);
      canvas.setActiveObject(image);
      canvas.requestRenderAll();
      sendMessage({
        action: "UPSERT_OBJECT",
        sender: displayNameRef.current,
        payload: { object: serializeObject(image) }
      });
      bumpBoardVersion();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al cargar la imagen");
      console.error("handleImageFiles failed:", error);
    }
  };

  const toggleLayout = () => {
    const nextMode: LayoutMode = layoutModeRef.current === "free" ? "grid" : "free";
    setLayoutMode(nextMode);
    layoutModeRef.current = nextMode;

    if (nextMode === "grid") {
      const canvas = canvasRef.current;
      canvas
        ?.getObjects()
        .filter((object: any) => object.kind === "zone")
        .forEach((zone: any) => reflowZone(zone.id));
    }

    sendMessage({
      action: "UPDATE_META",
      sender: displayNameRef.current,
      payload: { layoutMode: nextMode }
    });
    bumpBoardVersion();
  };

  const exportBoard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    downloadJson(
      `${APP_NAME.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`,
      createSnapshot(canvas, layoutModeRef.current)
    );
    toast.success("Clase exportada");
  };

  const importBoard = async (file: File) => {
    let text: string;
    try {
      text = await readFileAsText(file);
    } catch {
      toast.error("No se pudo leer el archivo");
      return;
    }
    let snapshot: unknown;
    try {
      snapshot = JSON.parse(text);
    } catch {
      toast.error("El archivo no es un JSON válido");
      return;
    }
    if (
      typeof snapshot !== "object" ||
      snapshot === null ||
      !("meta" in snapshot) ||
      !("canvas" in snapshot)
    ) {
      toast.error("El archivo no tiene el formato correcto de AulaFlux");
      return;
    }
    try {
      await loadSnapshot(snapshot as any, roleRef.current === "host");
      toast.success("Clase importada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al importar el lienzo");
      console.error("importBoard failed:", error);
    }
  };

  const duplicateSelection = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const targets = canvas
      .getActiveObjects()
      .filter((o: any) => o.kind === "sticky" || o.kind === "zone");
    if (!targets.length) return;
    targets.forEach((target: any) => {
      const serialized = serializeObject(target);
      const payload: BoardObjectPayload = {
        ...serialized,
        id: crypto.randomUUID(),
        left: (serialized.left || 0) + 30,
        top: (serialized.top || 0) + 30,
        updatedAt: Date.now()
      };
      const obj = payload.kind === "sticky" ? createSticky(payload) : createZone(payload);
      canvas.add(obj);
      sendMessage({
        action: "UPSERT_OBJECT",
        sender: displayNameRef.current,
        payload: { object: serializeObject(obj) }
      });
    });
    canvas.requestRenderAll();
    bumpBoardVersion();
  };

  const selectAll = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const all = canvas.getObjects().filter((o: any) => o.kind !== "connector");
    if (!all.length) return;
    canvas.setActiveObjects(all as any[]);
    canvas.requestRenderAll();
    updateSelection();
  };

  const bringSelectionToFront = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getActiveObjects().forEach((obj: any) => canvas.bringObjectToFront(obj));
    canvas.requestRenderAll();
  };

  const sendSelectionToBack = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas
      .getActiveObjects()
      .filter((obj: any) => obj.kind !== "connector")
      .forEach((obj: any) => canvas.sendObjectToBack(obj));
    canvas.requestRenderAll();
  };

  const clearBoard = () => {
    if (!window.confirm("¿Borrar todo el lienzo? Esta acción no se puede deshacer.")) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ids = canvas.getObjects().map((o: any) => o.id).filter(Boolean);
    ids.forEach((id: string) => removeObjectById(id, Date.now(), true));
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    bumpBoardVersion();
  };

  const fitToObjects = () => {
    const canvas = canvasRef.current;
    const container = canvasContainerRef.current;
    if (!canvas || !container) return;
    const objects = canvas.getObjects().filter((o: any) => o.kind && o.kind !== "connector");
    if (!objects.length) {
      canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      setZoom(1);
      setVpTransform([1, 0, 0, 1, 0, 0]);
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    objects.forEach((obj: any) => {
      const b = obj.getBoundingRect();
      minX = Math.min(minX, b.left);
      minY = Math.min(minY, b.top);
      maxX = Math.max(maxX, b.left + b.width);
      maxY = Math.max(maxY, b.top + b.height);
    });
    const pad = 80;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const contentW = maxX - minX + pad * 2;
    const contentH = maxY - minY + pad * 2;
    const newZoom = Math.min(cw / contentW, ch / contentH, 2);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    canvas.zoomToPoint(new Point(cw / 2, ch / 2), newZoom);
    const vpt = canvas.viewportTransform as number[];
    vpt[4] = cw / 2 - centerX * newZoom;
    vpt[5] = ch / 2 - centerY * newZoom;
    canvas.requestRenderAll();
    setZoom(newZoom);
    setVpTransform([...vpt]);
  };

  const zoomIn = () => {
    const canvas = canvasRef.current;
    const container = canvasContainerRef.current;
    if (!canvas || !container) return;
    const newZoom = Math.min(canvas.getZoom() * 1.25, 8);
    canvas.zoomToPoint(new Point(container.clientWidth / 2, container.clientHeight / 2), newZoom);
    const vpt = canvas.viewportTransform as number[];
    setZoom(newZoom);
    setVpTransform([...vpt]);
  };

  const zoomOut = () => {
    const canvas = canvasRef.current;
    const container = canvasContainerRef.current;
    if (!canvas || !container) return;
    const newZoom = Math.max(canvas.getZoom() / 1.25, 0.08);
    canvas.zoomToPoint(new Point(container.clientWidth / 2, container.clientHeight / 2), newZoom);
    const vpt = canvas.viewportTransform as number[];
    setZoom(newZoom);
    setVpTransform([...vpt]);
  };

  const resetZoom = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    setZoom(1);
    setVpTransform([1, 0, 0, 1, 0, 0]);
  };

  const enterBoard = () => {
    if (localSignalingError) {
      toast.error(localSignalingError);
      return;
    }

    setPage("board");
  };

  const exitBoard = () => {
    disconnectNetwork();
    setPage("setup");
  };

  void boardVersion;

  if (page === "setup") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-8 text-slate-900">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-sm"
        >
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-500 text-white shadow-lg shadow-cyan-200">
              <Sparkles className="h-8 w-8" />
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900">{APP_NAME}</h1>
            <p className="mt-2 text-slate-500">Pizarra colaborativa en tiempo real</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-100">
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
                {(["host", "peer"] as SessionRole[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setRole(item)}
                    className={`rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      role === item
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {item === "host" ? "Profesor" : "Alumno"}
                  </button>
                ))}
              </div>

              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Tu nombre
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  placeholder="Ej. Profe García"
                />
              </label>

              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                {role === "host" ? "ID de sala" : "ID de sala del profesor"}
                <div className="flex gap-2">
                  <input
                    value={roomId}
                    onChange={(event) => setRoomId(event.target.value)}
                    className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                    placeholder="aulaflux-xxxxxx"
                  />
                  {role === "host" && (
                    <button
                      type="button"
                      onClick={() => setRoomId(generateRoomId())}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-3 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                      title="Generar nuevo ID"
                    >
                      <RefreshCcw className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {role === "peer" && (
                  <p className="text-xs text-slate-400">Pega el ID que te compartió el profesor</p>
                )}
              </label>

              <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <label className="flex items-center justify-between gap-3 text-sm font-medium text-slate-700">
                  <span>Usar PeerServer local</span>
                  <input
                    type="checkbox"
                    checked={useLocalSignaling}
                    onChange={(event) => setUseLocalSignaling(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-cyan-500 focus:ring-cyan-400"
                  />
                </label>

                {useLocalSignaling && (
                  <div className="grid gap-3">
                    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                      Host o IP
                      <input
                        value={signalingHost}
                        onChange={(event) => setSignalingHost(event.target.value)}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                        placeholder="192.168.1.10"
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                        Puerto
                        <input
                          value={signalingPort}
                          onChange={(event) => setSignalingPort(event.target.value)}
                          inputMode="numeric"
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                          placeholder="9000"
                        />
                      </label>

                      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                        Path
                        <input
                          value={signalingPath}
                          onChange={(event) => setSignalingPath(event.target.value)}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                          placeholder="/aulaflux"
                        />
                      </label>
                    </div>

                    <p className="text-xs text-slate-500">
                      Ejecuta <span className="font-mono">npm run peer-server</span> en la maquina
                      del host y comparte el enlace generado con estos parametros.
                    </p>
                    {localSignalingError && (
                      <p className="text-xs font-medium text-rose-600">{localSignalingError}</p>
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={enterBoard}
                disabled={!displayName.trim() || !roomId.trim() || Boolean(localSignalingError)}
                className="mt-1 rounded-2xl bg-cyan-500 px-4 py-3 font-medium text-white shadow-md shadow-cyan-100 transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {role === "host" ? "Crear sala →" : "Unirse a la sala →"}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100 text-slate-900">
      {/* Top bar */}
      <header className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 shadow-sm z-10">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-cyan-500 text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="font-semibold text-slate-800 text-sm">{APP_NAME}</span>
        </div>

        <div className="flex-1" />

        {/* Status */}
        <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
          <span className="pulse-dot h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
          {role === "host" ? `${peerCount} conectado(s)` : status}
        </div>

        {/* Users */}
        <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
          <Users className="h-3.5 w-3.5" />
          {displayName}
        </div>

        {/* Invite (host) */}
        {role === "host" && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowInvite((v) => !v)}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                showInvite
                  ? "border-cyan-300 bg-cyan-50 text-cyan-700"
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              <QrCode className="h-3.5 w-3.5" />
              Invitar
            </button>
            {showInvite && (
              <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200">
                {qrDataUrl && (
                  <img src={qrDataUrl} alt="QR de invitación" className="mb-3 w-full rounded-xl" />
                )}
                <p className="mb-2 break-all rounded-xl bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600">
                  {joinUrl}
                </p>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(joinUrl); toast.success("Enlace copiado"); }}
                  className="w-full rounded-xl bg-cyan-500 py-2 text-sm font-medium text-white transition hover:bg-cyan-600"
                >
                  Copiar enlace
                </button>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={exitBoard}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500 transition hover:bg-red-50 hover:border-red-200 hover:text-red-600"
        >
          <LogOut className="h-3.5 w-3.5" />
          Salir
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="flex shrink-0 flex-col items-center gap-1 border-r border-slate-200 bg-white px-1.5 py-2 shadow-sm w-14">
          {/* Create */}
          <SidebarButton icon={StickyNote} label="Sticky" onClick={addStickyNote} />
          <SidebarButton icon={Grid3X3} label="Zona" onClick={addZoneCard} disabled={role !== "host"} />
          <label className="flex">
            <input
              ref={reconnectInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void handleImageFiles(event.target.files)}
            />
            <SidebarButton icon={ImagePlus} label="Imagen" onClick={() => reconnectInputRef.current?.click()} />
          </label>
          <SidebarButton icon={Link2} label="Conector" onClick={addConnection} />

          <div className="my-1 h-px w-8 bg-slate-200" />

          {/* Edit */}
          <SidebarButton icon={Copy} label="Duplicar" onClick={duplicateSelection} disabled={!selectedIds.length} />
          <SidebarButton icon={ChevronsUp} label="Al frente" onClick={bringSelectionToFront} disabled={!selectedIds.length} />
          <SidebarButton icon={ChevronsDown} label="Al fondo" onClick={sendSelectionToBack} disabled={!selectedIds.length} />
          <SidebarButton icon={Trash2} label="Borrar" onClick={deleteSelection} disabled={!selectedIds.length} />

          <div className="my-1 h-px w-8 bg-slate-200" />

          {/* View */}
          <SidebarButton icon={BoxSelect} label="Seleccionar todo" onClick={selectAll} />
          <SidebarButton icon={Maximize2} label="Ajustar vista" onClick={fitToObjects} />
          <SidebarButton
            icon={LayoutPanelTop}
            label={layoutMode === "free" ? "Modo grid" : "Modo libre"}
            onClick={toggleLayout}
            disabled={role !== "host"}
            active={layoutMode === "grid"}
          />

          <div className="my-1 h-px w-8 bg-slate-200" />

          {/* File */}
          <SidebarButton icon={Download} label="Exportar" onClick={exportBoard} />
          <SidebarButton icon={Import} label="Importar" onClick={() => importInputRef.current?.click()} disabled={role !== "host"} />
          <SidebarButton icon={Eraser} label="Borrar todo" onClick={clearBoard} disabled={role !== "host"} />

          {/* Contextual color picker */}
          {selectedSticky && (
            <>
              <div className="my-1 h-px w-8 bg-slate-200" />
              {STICKY_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  title={color}
                  onClick={() => updateStickyColor(color)}
                  className="h-7 w-7 rounded-lg border-2 border-white shadow-sm transition hover:scale-110"
                  style={{ backgroundColor: color }}
                />
              ))}
            </>
          )}

          <div className="flex-1" />

          {/* Zoom */}
          <div className="my-1 h-px w-8 bg-slate-200" />
          <SidebarButton icon={ZoomIn} label="Acercar" onClick={zoomIn} />
          <button
            type="button"
            onClick={resetZoom}
            title="Restablecer zoom"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-xs font-mono font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            {Math.round(zoom * 100)}%
          </button>
          <SidebarButton icon={ZoomOut} label="Alejar" onClick={zoomOut} />
        </aside>

        {/* Canvas container */}
        <div
          ref={canvasContainerRef}
          data-layout={layoutMode}
          className="board-grid relative flex-1 overflow-hidden"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            void handleImageFiles(event.dataTransfer.files);
          }}
          onClick={() => setShowInvite(false)}
        >
          <canvas ref={canvasElementRef} />

          {/* Remote cursors */}
          <div className="pointer-events-none absolute inset-0">
            {Object.values(remoteCursors)
              .filter((cursor) => cursor.peerId !== selfPeerId)
              .map((cursor) => (
                <div
                  key={cursor.peerId}
                  className="absolute z-20"
                  style={{
                    transform: `translate(${cursor.x * vpTransform[0] + vpTransform[4]}px, ${cursor.y * vpTransform[3] + vpTransform[5]}px)`
                  }}
                >
                  <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-md">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cursor.color }} />
                    {cursor.name}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importBoard(file);
        }}
      />
    </div>
  );
}

function SidebarButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  active
}: {
  icon: any;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={label}
      className={`flex h-9 w-9 items-center justify-center rounded-xl transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "bg-cyan-50 text-cyan-600"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
      }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

export default App;
