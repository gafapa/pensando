import {
  FabricImage,
  Line,
  Rect,
  Shadow,
  Textbox
} from "fabric";
import type { PeerJSOption } from "peerjs";

export const APP_NAME = "AulaFlux";
export const BOARD_WIDTH = 3200;
export const BOARD_HEIGHT = 2000;
export const DEFAULT_SIGNAL_PATH = "/aulaflux";
export const STICKY_COLORS = [
  "#FFE08A",
  "#FDBA74",
  "#A7F3D0",
  "#93C5FD",
  "#F9A8D4"
];

export const SERIALIZABLE_PROPS = [
  "id",
  "kind",
  "updatedAt",
  "sourceId",
  "targetId",
  "zoneId",
  "sortOrder",
  "name"
];

export type LayoutMode = "free" | "grid";
export type SessionRole = "host" | "peer";
export type BoardObjectKind = "sticky" | "image" | "zone" | "connector";

export interface SignalConfig {
  useCustom: boolean;
  host: string;
  port: number;
  path: string;
  secure: boolean;
}

export interface CursorPresence {
  peerId: string;
  name: string;
  color: string;
  x: number;
  y: number;
}

export interface BoardObjectPayload {
  id: string;
  kind: BoardObjectKind;
  updatedAt: number;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  angle?: number;
  scaleX?: number;
  scaleY?: number;
  text?: string;
  src?: string;
  backgroundColor?: string;
  fill?: string;
  stroke?: string;
  sourceId?: string;
  targetId?: string;
  zoneId?: string | null;
  sortOrder?: number;
  name?: string;
}

export interface BoardSnapshot {
  meta: {
    layoutMode: LayoutMode;
    exportedAt: string;
    appName: string;
  };
  canvas: unknown;
}

export type BoardMessage =
  | { action: "HELLO"; sender: string; payload: { name: string; color: string } }
  | { action: "SYNC_SNAPSHOT"; sender: string; payload: { snapshot: BoardSnapshot } }
  | { action: "UPSERT_OBJECT"; sender: string; payload: { object: BoardObjectPayload } }
  | { action: "REMOVE_OBJECT"; sender: string; payload: { id: string; updatedAt: number } }
  | { action: "UPDATE_META"; sender: string; payload: { layoutMode: LayoutMode } }
  | {
      action: "CURSOR";
      sender: string;
      payload: CursorPresence;
    };

export function generateRoomId() {
  return `aulaflux-${Math.random().toString(36).slice(2, 8)}`;
}

export function randomName() {
  const names = [
    "Aurora",
    "Nexo",
    "Prisma",
    "Lumen",
    "Atlas",
    "Vela",
    "Brisa"
  ];
  return `${names[Math.floor(Math.random() * names.length)]}-${Math.floor(
    10 + Math.random() * 89
  )}`;
}

export function randomCursorColor() {
  const colors = ["#22d3ee", "#f59e0b", "#a78bfa", "#34d399", "#fb7185"];
  return colors[Math.floor(Math.random() * colors.length)];
}

export function buildPeerOptions(config: SignalConfig): PeerJSOption | undefined {
  if (!config.useCustom || !config.host.trim()) {
    return undefined;
  }

  return {
    host: config.host.trim(),
    port: Number(config.port) || 9000,
    path: config.path || DEFAULT_SIGNAL_PATH,
    secure: Boolean(config.secure)
  };
}

export function buildShareUrl(roomId: string, config: SignalConfig) {
  const url = new URL(window.location.href);
  url.searchParams.set("room", roomId);
  if (config.useCustom && config.host.trim()) {
    url.searchParams.set("signalHost", config.host.trim());
    url.searchParams.set("signalPort", String(config.port || 9000));
    url.searchParams.set("signalPath", config.path || DEFAULT_SIGNAL_PATH);
    if (config.secure) {
      url.searchParams.set("signalSecure", "1");
    } else {
      url.searchParams.delete("signalSecure");
    }
  } else {
    url.searchParams.delete("signalHost");
    url.searchParams.delete("signalPort");
    url.searchParams.delete("signalPath");
    url.searchParams.delete("signalSecure");
  }
  return url.toString();
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function readFileAsText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function makeBaseObject<T extends { set: (props: any) => void }>(
  object: T,
  payload: BoardObjectPayload
) {
  object.set({
    id: payload.id,
    kind: payload.kind,
    updatedAt: payload.updatedAt,
    sourceId: payload.sourceId,
    targetId: payload.targetId,
    zoneId: payload.zoneId ?? null,
    sortOrder: payload.sortOrder,
    name: payload.name ?? "",
    transparentCorners: false,
    cornerStyle: "circle",
    borderColor: "#67e8f9",
    cornerColor: "#f8fafc",
    cornerStrokeColor: "#0f172a"
  });
  return object;
}

export function createSticky(payload: BoardObjectPayload) {
  const sticky = new Textbox(payload.text || "Nueva idea", {
    left: payload.left ?? 260,
    top: payload.top ?? 240,
    width: payload.width ?? 220,
    fontSize: 18,
    fill: "#0f172a",
    backgroundColor: payload.backgroundColor || STICKY_COLORS[0],
    padding: 18,
    fontFamily: "Space Grotesk Variable",
    lineHeight: 1.25,
    shadow: new Shadow({
      color: "rgba(15, 23, 42, 0.18)",
      blur: 18,
      offsetX: 0,
      offsetY: 12
    }),
    rx: 24,
    ry: 24
  });
  return makeBaseObject(sticky, payload);
}

export function createZone(payload: BoardObjectPayload) {
  const zone = new Rect({
    left: payload.left ?? 180,
    top: payload.top ?? 160,
    width: payload.width ?? 520,
    height: payload.height ?? 360,
    rx: 32,
    ry: 32,
    fill: "rgba(8, 47, 73, 0.16)",
    stroke: payload.stroke || "#5eead4",
    strokeWidth: 2,
    strokeDashArray: [14, 10]
  });
  return makeBaseObject(zone, payload);
}

export async function createImage(payload: BoardObjectPayload) {
  const image = await FabricImage.fromURL(payload.src || "");
  image.set({
    left: payload.left ?? 360,
    top: payload.top ?? 360,
    scaleX: payload.scaleX ?? 0.7,
    scaleY: payload.scaleY ?? 0.7,
    shadow: new Shadow({
      color: "rgba(2, 6, 23, 0.28)",
      blur: 26,
      offsetX: 0,
      offsetY: 18
    })
  });
  return makeBaseObject(image, payload);
}

export function createConnector(
  payload: BoardObjectPayload,
  source: { x: number; y: number },
  target: { x: number; y: number }
) {
  const line = new Line([source.x, source.y, target.x, target.y], {
    stroke: payload.stroke || "#7dd3fc",
    strokeWidth: 3,
    selectable: true,
    evented: true,
    lockMovementX: true,
    lockMovementY: true,
    hasControls: false,
    hoverCursor: "pointer"
  });
  return makeBaseObject(line, payload);
}

export function isCanvasObjectEligible(object: any) {
  return object && object.kind && object.kind !== "connector";
}

export function canSnapToZone(object: any) {
  return object && (object.kind === "sticky" || object.kind === "image");
}

export function getObjectCenter(object: any) {
  return {
    x: (object.left || 0) + object.getScaledWidth() / 2,
    y: (object.top || 0) + object.getScaledHeight() / 2
  };
}

export function getObjectById(canvas: any, id: string) {
  return canvas.getObjects().find((object: any) => object.id === id) || null;
}

export function serializeObject(object: any): BoardObjectPayload {
  const base: BoardObjectPayload = {
    id: object.id,
    kind: object.kind,
    updatedAt: object.updatedAt || Date.now(),
    left: object.left || 0,
    top: object.top || 0,
    width: object.width || object.getScaledWidth?.() || 0,
    height: object.height || object.getScaledHeight?.() || 0,
    angle: object.angle || 0,
    scaleX: object.scaleX || 1,
    scaleY: object.scaleY || 1,
    fill: object.fill,
    stroke: object.stroke,
    zoneId: object.zoneId ?? null,
    sortOrder: object.sortOrder,
    name: object.name || ""
  };

  if (object.kind === "sticky") {
    base.text = object.text || "";
    base.backgroundColor = object.backgroundColor;
    base.width = object.width || object.getScaledWidth?.() || 220;
  }

  if (object.kind === "image") {
    base.src = object.getSrc?.() || object._element?.src || "";
  }

  if (object.kind === "zone") {
    base.width = object.width || 520;
    base.height = object.height || 360;
  }

  if (object.kind === "connector") {
    base.sourceId = object.sourceId;
    base.targetId = object.targetId;
  }

  return base;
}

export function createSnapshot(canvas: any, layoutMode: LayoutMode): BoardSnapshot {
  return {
    meta: {
      layoutMode,
      exportedAt: new Date().toISOString(),
      appName: APP_NAME
    },
    canvas: canvas.toJSON(SERIALIZABLE_PROPS)
  };
}
