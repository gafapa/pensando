import {
  FabricImage,
  Path,
  Rect,
  Shadow,
  Textbox,
  util
} from "fabric";
export const APP_NAME = "AulaFlux";
export const BOARD_WIDTH = 3200;
export const BOARD_HEIGHT = 2000;
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
  "name",
  "ownerId",
  "ownerName"
];

export type LayoutMode = "free" | "grid";
export type SessionRole = "host" | "peer";
export type BoardObjectKind = "sticky" | "image" | "zone" | "connector";

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
  ownerId?: string;
  ownerName?: string;
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

export function buildShareUrl(roomId: string, language?: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("room", roomId);
  if (language) {
    url.searchParams.set("lang", language);
  } else {
    url.searchParams.delete("lang");
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
    ownerId: payload.ownerId ?? "",
    ownerName: payload.ownerName ?? "",
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
  if (!payload.src) throw new Error("Se requiere una URL de imagen");
  let image: FabricImage;
  try {
    image = await FabricImage.fromURL(payload.src);
  } catch {
    throw new Error("No se pudo cargar la imagen");
  }
  if (!image) throw new Error("No se pudo cargar la imagen");
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

export function buildBezierPath(
  source: { x: number; y: number },
  target: { x: number; y: number }
): string {
  const dx = target.x - source.x;
  const cx1 = source.x + dx * 0.5;
  const cy1 = source.y;
  const cx2 = target.x - dx * 0.5;
  const cy2 = target.y;
  const angle = Math.atan2(target.y - cy2, target.x - cx2);
  const arrowLen = 14;
  const arrowSpread = 0.42;
  const ax1 = target.x - arrowLen * Math.cos(angle - arrowSpread);
  const ay1 = target.y - arrowLen * Math.sin(angle - arrowSpread);
  const ax2 = target.x - arrowLen * Math.cos(angle + arrowSpread);
  const ay2 = target.y - arrowLen * Math.sin(angle + arrowSpread);
  return `M ${source.x} ${source.y} C ${cx1} ${cy1} ${cx2} ${cy2} ${target.x} ${target.y} M ${ax1} ${ay1} L ${target.x} ${target.y} L ${ax2} ${ay2}`;
}

export function createConnector(
  payload: BoardObjectPayload,
  source: { x: number; y: number },
  target: { x: number; y: number }
) {
  const pathStr = buildBezierPath(source, target);
  const path = new Path(pathStr, {
    stroke: payload.stroke || "#7dd3fc",
    strokeWidth: 2.5,
    fill: "transparent",
    selectable: true,
    evented: true,
    hasControls: false,
    hoverCursor: "pointer",
    objectCaching: false
  });
  return makeBaseObject(path, payload);
}

export { util };

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
    name: object.name || "",
    ownerId: object.ownerId || "",
    ownerName: object.ownerName || ""
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
