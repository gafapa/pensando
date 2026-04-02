import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Cable,
  Download,
  Grid3X3,
  ImagePlus,
  Import,
  LayoutPanelTop,
  Link2,
  MonitorCog,
  MoveRight,
  PenSquare,
  QrCode,
  RefreshCcw,
  Sparkles,
  StickyNote,
  Trash2,
  Users,
  Wifi
} from "lucide-react";
import { motion } from "motion/react";
import QRCode from "qrcode";
import { Peer } from "peerjs";
import { Canvas } from "fabric";
import { toast } from "sonner";
import {
  APP_NAME,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  DEFAULT_SIGNAL_PATH,
  STICKY_COLORS,
  buildPeerOptions,
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
  randomCursorColor,
  randomName,
  readFileAsDataUrl,
  readFileAsText,
  serializeObject,
  type BoardMessage,
  type BoardObjectPayload,
  type CursorPresence,
  type LayoutMode,
  type SessionRole,
  type SignalConfig
} from "./lib/board";

const PANEL =
  "mesh-panel soft-shadow rounded-[28px] border border-white/8 bg-slate-950/65";

function App() {
  const search = new URLSearchParams(window.location.search);
  const [role, setRole] = useState<SessionRole>(search.get("room") ? "peer" : "host");
  const [displayName, setDisplayName] = useState(randomName());
  const [roomId, setRoomId] = useState(search.get("room") || generateRoomId());
  const [status, setStatus] = useState("Listo para iniciar");
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("free");
  const [peerCount, setPeerCount] = useState(0);
  const [selfPeerId, setSelfPeerId] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [remoteCursors, setRemoteCursors] = useState<Record<string, CursorPresence>>({});
  const [scrollState, setScrollState] = useState({ left: 0, top: 0 });
  const [boardVersion, setBoardVersion] = useState(0);
  const [signalConfig, setSignalConfig] = useState<SignalConfig>({
    useCustom: Boolean(search.get("signalHost")),
    host: search.get("signalHost") || "",
    port: Number(search.get("signalPort") || "9000"),
    path: search.get("signalPath") || DEFAULT_SIGNAL_PATH,
    secure: search.get("signalSecure") === "1"
  });

  const localCursorColorRef = useRef(randomCursorColor());
  const canvasRef = useRef<any>(null);
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const boardScrollRef = useRef<HTMLDivElement | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const hostConnectionRef = useRef<any>(null);
  const hostConnectionsRef = useRef<Map<string, any>>(new Map());
  const reconnectInputRef = useRef<HTMLInputElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const lastCursorSentAtRef = useRef(0);
  const layoutModeRef = useRef(layoutMode);
  const roleRef = useRef(role);
  const roomIdRef = useRef(roomId);
  const signalConfigRef = useRef(signalConfig);
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
    signalConfigRef.current = signalConfig;
  }, [signalConfig]);

  useEffect(() => {
    displayNameRef.current = displayName;
  }, [displayName]);

  useEffect(() => {
    selfPeerIdRef.current = selfPeerId;
  }, [selfPeerId]);

  const joinUrl = useMemo(() => buildShareUrl(roomId, signalConfig), [roomId, signalConfig]);

  useEffect(() => {
    let ignore = false;
    QRCode.toDataURL(joinUrl, {
      margin: 1,
      width: 280,
      color: {
        dark: "#E2E8F0",
        light: "#0000"
      }
    }).then((data) => {
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
      object.set({
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y
      });
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
    await canvas.loadFromJSON(snapshot.canvas);
    canvas.setDimensions({ width: BOARD_WIDTH, height: BOARD_HEIGHT });
    canvas.backgroundColor = "#09101f";
    canvas.requestRenderAll();
    setLayoutMode(snapshot.meta.layoutMode || "free");
    layoutModeRef.current = snapshot.meta.layoutMode || "free";
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
      object = await createImage(payload);
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
      updateStatus(`Sala activa con ${hostConnectionsRef.current.size} peer(s)`);
      connection?.send({
        action: "SYNC_SNAPSHOT",
        sender: displayNameRef.current,
        payload: { snapshot: createSnapshot(canvasRef.current, layoutModeRef.current) }
      } satisfies BoardMessage);
      return;
    }

    if (message.action === "SYNC_SNAPSHOT") {
      await loadSnapshot(message.payload.snapshot);
      updateStatus("Lienzo sincronizado");
      return;
    }

    if (message.action === "UPSERT_OBJECT") {
      await applyObjectPayload(message.payload.object);
      if (roleRef.current === "host") {
        sendMessage(message, connection?.peer);
      }
      return;
    }

    if (message.action === "REMOVE_OBJECT") {
      removeObjectById(message.payload.id, message.payload.updatedAt, false);
      if (roleRef.current === "host") {
        sendMessage(message, connection?.peer);
      }
      return;
    }

    if (message.action === "UPDATE_META") {
      setLayoutMode(message.payload.layoutMode);
      layoutModeRef.current = message.payload.layoutMode;
      if (roleRef.current === "host") {
        sendMessage(message, connection?.peer);
      }
      canvasRef.current?.requestRenderAll();
      return;
    }

    if (message.action === "CURSOR") {
      setRemoteCursors((current) => ({
        ...current,
        [message.payload.peerId]: message.payload
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

    const options = buildPeerOptions(signalConfigRef.current);
    const peer =
      roleRef.current === "host"
        ? new Peer(roomIdRef.current, options)
        : new Peer(options);

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
    if (!canvasElementRef.current) return;
    const canvas = new Canvas(canvasElementRef.current, {
      width: BOARD_WIDTH,
      height: BOARD_HEIGHT,
      backgroundColor: "#09101f",
      selection: true,
      preserveObjectStacking: true
    });

    canvasRef.current = canvas;

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
    canvas.on("mouse:move", (event: any) => {
      if (!event.e) return;
      const now = Date.now();
      if (now - lastCursorSentAtRef.current < 60) return;
      lastCursorSentAtRef.current = now;
      const pointer = canvas.getScenePoint(event.e);
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
        setRemoteCursors((current) => ({
          ...current,
          host: message.payload
        }));
      }

      sendMessage(message);
    });

    startNetworking();

    return () => {
      disconnectNetwork();
      canvas.dispose();
    };
  }, []);

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
    const text = await readFileAsText(file);
    const snapshot = JSON.parse(text);
    await loadSnapshot(snapshot, roleRef.current === "host");
    toast.success("Clase importada");
  };

  const zoneCount =
    canvasRef.current?.getObjects().filter((object: any) => object.kind === "zone").length || 0;
  const objectCount =
    canvasRef.current?.getObjects().filter((object: any) => object.kind !== "connector").length || 0;
  const connectorCount =
    canvasRef.current?.getObjects().filter((object: any) => object.kind === "connector").length || 0;
  void boardVersion;

  return (
    <div className="min-h-screen overflow-hidden px-4 py-5 text-slate-50 md:px-6">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="mx-auto flex max-w-[1800px] flex-col gap-4"
      >
        <header className={`${PANEL} flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between`}>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-cyan-400/12 text-cyan-200 ring-1 ring-cyan-300/20">
              <Sparkles className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/70">
                Local-first collaboration
              </p>
              <h1 className="text-3xl font-semibold tracking-tight">{APP_NAME}</h1>
              <p className="text-sm text-slate-300/80">
                Pizarra viva para clases, workshops y dinámicas rápidas sin backend central.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border border-white/8 bg-white/4 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.26em] text-slate-400">Estado</p>
              <p className="mt-1 flex items-center gap-2 text-sm text-slate-100">
                <span className="pulse-dot h-2.5 w-2.5 rounded-full bg-emerald-400" />
                {status}
              </p>
            </div>
            <div className="rounded-3xl border border-white/8 bg-white/4 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.26em] text-slate-400">Peers</p>
              <p className="mt-1 flex items-center gap-2 text-sm text-slate-100">
                <Users className="h-4 w-4 text-cyan-200" />
                {role === "host" ? `${peerCount} conectados` : roomId}
              </p>
            </div>
            <div className="rounded-3xl border border-white/8 bg-white/4 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.26em] text-slate-400">Layout</p>
              <p className="mt-1 flex items-center gap-2 text-sm text-slate-100">
                <Grid3X3 className="h-4 w-4 text-amber-200" />
                {layoutMode === "free" ? "Free-form" : "Grid-snap"}
              </p>
            </div>
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)_320px]">
          <aside className={`${PANEL} flex flex-col gap-4 p-4`}>
            <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-100">
                <MonitorCog className="h-4 w-4 text-cyan-200" />
                Sesión
              </div>
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-950/70 p-1">
                  {(["host", "peer"] as SessionRole[]).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setRole(item)}
                      className={`rounded-2xl px-3 py-2 text-sm transition ${
                        role === item
                          ? "bg-cyan-400/15 text-cyan-100 ring-1 ring-cyan-300/30"
                          : "text-slate-400 hover:text-slate-100"
                      }`}
                    >
                      {item === "host" ? "Profesor / Host" : "Alumno / Peer"}
                    </button>
                  ))}
                </div>

                <label className="grid gap-1 text-sm text-slate-300">
                  Nombre
                  <input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-50 outline-none transition focus:border-cyan-300/40"
                  />
                </label>

                <label className="grid gap-1 text-sm text-slate-300">
                  ID de sala
                  <div className="flex gap-2">
                    <input
                      value={roomId}
                      onChange={(event) => setRoomId(event.target.value)}
                      className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-50 outline-none transition focus:border-cyan-300/40"
                    />
                    <button
                      type="button"
                      onClick={() => setRoomId(generateRoomId())}
                      className="rounded-2xl border border-white/10 bg-white/5 px-3 text-slate-200 transition hover:bg-white/10"
                    >
                      <RefreshCcw className="h-4 w-4" />
                    </button>
                  </div>
                </label>

                <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-sm text-slate-200">
                  Señalización local
                  <input
                    type="checkbox"
                    checked={signalConfig.useCustom}
                    onChange={(event) =>
                      setSignalConfig((current) => ({
                        ...current,
                        useCustom: event.target.checked
                      }))
                    }
                    className="h-4 w-4 accent-cyan-400"
                  />
                </label>

                {signalConfig.useCustom && (
                  <div className="grid gap-2 rounded-2xl border border-amber-300/12 bg-amber-400/6 p-3">
                    <input
                      value={signalConfig.host}
                      onChange={(event) =>
                        setSignalConfig((current) => ({
                          ...current,
                          host: event.target.value
                        }))
                      }
                      placeholder="IP o hostname del profesor"
                      className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm outline-none"
                    />
                    <div className="grid grid-cols-[1fr_1fr] gap-2">
                      <input
                        value={signalConfig.port}
                        onChange={(event) =>
                          setSignalConfig((current) => ({
                            ...current,
                            port: Number(event.target.value)
                          }))
                        }
                        placeholder="Puerto"
                        className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm outline-none"
                      />
                      <input
                        value={signalConfig.path}
                        onChange={(event) =>
                          setSignalConfig((current) => ({
                            ...current,
                            path: event.target.value
                          }))
                        }
                        placeholder="/aulaflux"
                        className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm outline-none"
                      />
                    </div>
                    <label className="flex items-center gap-3 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={signalConfig.secure}
                        onChange={(event) =>
                          setSignalConfig((current) => ({
                            ...current,
                            secure: event.target.checked
                          }))
                        }
                        className="h-4 w-4 accent-cyan-400"
                      />
                      Usar HTTPS / WSS
                    </label>
                  </div>
                )}

                <button
                  type="button"
                  onClick={startNetworking}
                  className="rounded-2xl bg-cyan-300 px-4 py-3 font-medium text-slate-950 transition hover:bg-cyan-200"
                >
                  {role === "host" ? "Iniciar sala" : "Conectar a sala"}
                </button>

                <p className="text-xs text-slate-400">
                  Peer local: {selfPeerId || "pendiente"}.
                </p>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-100">
                <QrCode className="h-4 w-4 text-amber-200" />
                Invitación rápida
              </div>
              <div className="grid gap-3">
                <div className="rounded-[26px] border border-white/8 bg-slate-950/80 p-4">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="QR de la sala" className="w-full rounded-2xl" />
                  ) : (
                    <div className="aspect-square rounded-2xl bg-white/5" />
                  )}
                </div>
                <textarea
                  readOnly
                  value={joinUrl}
                  className="min-h-28 rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-xs text-slate-300 outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(joinUrl);
                    toast.success("Enlace copiado");
                  }}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm transition hover:bg-white/10"
                >
                  Copiar enlace
                </button>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/8 bg-white/4 p-4 text-sm text-slate-300">
              <div className="mb-3 flex items-center gap-2 font-medium text-slate-100">
                <Wifi className="h-4 w-4 text-emerald-200" />
                Modo offline total
              </div>
              <p>
                Si la red no sale a internet, activa señalización local y ejecuta
                `npm run peer-server` en el portátil del profesor.
              </p>
            </div>
          </aside>

          <main className={`${PANEL} flex min-h-[75vh] flex-col overflow-hidden`}>
            <div className="flex flex-wrap items-center gap-2 border-b border-white/8 px-4 py-3">
              <ToolbarButton icon={StickyNote} label="Sticky" onClick={addStickyNote} />
              <ToolbarButton
                icon={Grid3X3}
                label="Zona"
                onClick={addZoneCard}
                disabled={role !== "host"}
              />
              <label className="inline-flex">
                <input
                  ref={reconnectInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => void handleImageFiles(event.target.files)}
                />
                <ToolbarButton
                  icon={ImagePlus}
                  label="Imagen"
                  onClick={() => reconnectInputRef.current?.click()}
                />
              </label>
              <ToolbarButton icon={Link2} label="Conector" onClick={addConnection} />
              <ToolbarButton
                icon={LayoutPanelTop}
                label={layoutMode === "free" ? "Grid mode" : "Free mode"}
                onClick={toggleLayout}
                disabled={role !== "host"}
              />
              <ToolbarButton icon={Trash2} label="Borrar" onClick={deleteSelection} />
              <ToolbarButton icon={Download} label="Exportar" onClick={exportBoard} />
              <ToolbarButton
                icon={Import}
                label="Importar"
                onClick={() => importInputRef.current?.click()}
                disabled={role !== "host"}
              />
              <input
                ref={importInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void importBoard(file);
                  }
                }}
              />
              <div className="ml-auto flex items-center gap-2 rounded-full border border-white/8 bg-white/4 px-4 py-2 text-xs uppercase tracking-[0.24em] text-slate-400">
                <MoveRight className="h-3.5 w-3.5 text-cyan-200" />
                Drag & drop de imágenes al lienzo
              </div>
            </div>

            <div
              ref={boardScrollRef}
              onScroll={(event) =>
                setScrollState({
                  left: event.currentTarget.scrollLeft,
                  top: event.currentTarget.scrollTop
                })
              }
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void handleImageFiles(event.dataTransfer.files);
              }}
              className="relative flex-1 overflow-auto p-4"
            >
              <div
                data-layout={layoutMode}
                className="board-grid relative rounded-[28px] border border-white/8"
                style={{ width: BOARD_WIDTH, height: BOARD_HEIGHT }}
              >
                <canvas ref={canvasElementRef} />
                <div className="pointer-events-none absolute inset-0">
                  {Object.values(remoteCursors)
                    .filter((cursor) => cursor.peerId !== selfPeerId)
                    .map((cursor) => (
                      <div
                        key={cursor.peerId}
                        className="absolute z-20"
                        style={{
                          transform: `translate(${cursor.x - scrollState.left}px, ${cursor.y - scrollState.top}px)`
                        }}
                      >
                        <div className="flex items-center gap-2 rounded-full border border-white/12 bg-slate-950/90 px-2.5 py-1.5 text-xs text-white shadow-lg">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: cursor.color }}
                          />
                          {cursor.name}
                          <ArrowRight className="h-3 w-3" />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </main>

          <aside className={`${PANEL} flex flex-col gap-4 p-4`}>
            <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-100">
                <PenSquare className="h-4 w-4 text-cyan-200" />
                Inspector
              </div>
              <div className="grid gap-3 text-sm text-slate-300">
                <Stat label="Objetos" value={objectCount} />
                <Stat label="Conectores" value={connectorCount} />
                <Stat label="Zonas" value={zoneCount} />
                <Stat label="Selección" value={selectedIds.length} />
                <Stat label="Rol" value={role === "host" ? "Host" : "Peer"} />
              </div>
            </div>

            <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-100">
                <StickyNote className="h-4 w-4 text-amber-200" />
                Sticky activo
              </div>
              {selectedSticky ? (
                <div className="grid gap-3">
                  <div className="flex flex-wrap gap-2">
                    {STICKY_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => updateStickyColor(color)}
                        className="h-10 w-10 rounded-2xl border border-white/10 transition hover:scale-105"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-slate-400">
                    Doble clic sobre una nota para editar texto y arrástrala dentro de una zona
                    cuando el layout esté en modo grid.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-400">
                  Selecciona una sticky para cambiar su color.
                </p>
              )}
            </div>

            <div className="rounded-[24px] border border-white/8 bg-white/4 p-4 text-sm text-slate-300">
              <div className="mb-3 flex items-center gap-2 font-medium text-slate-100">
                <Cable className="h-4 w-4 text-cyan-200" />
                Protocolo
              </div>
              <p>
                La sesión usa mensajes JSON con `UPSERT_OBJECT`, `REMOVE_OBJECT`,
                `SYNC_SNAPSHOT`, `UPDATE_META` y `CURSOR`.
              </p>
            </div>
          </aside>
        </div>
      </motion.div>
    </div>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  disabled
}: {
  icon: any;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-slate-950/50 px-4 py-3">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-100">{value}</span>
    </div>
  );
}

export default App;
