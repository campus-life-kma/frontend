import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import { resolveMediaUrl } from '../utils/media';
import type {
  FloorMapData,
  ResourceOnMap,
  RoomOnMap,
  UserOnMap,
} from '../types/locations';

interface FloorMapProps {
  data: FloorMapData;
  onRoomClick: (room: RoomOnMap) => void;
  selectedRoomId: number | null;
}

const ROOM_TYPE_COLOR: Record<string, string> = {
  LIVING: '#cfe3ff',
  COMMON_AREA: '#d6f4d6',
  KITCHEN: '#fff1cf',
  LAUNDRY: '#e9d6ff',
  BATHROOM: '#cfecf4',
  STORAGE: '#e7d8b8',
};
const BLOCKED_COLOR = '#f3b9b9';
const DEFAULT_FILL = '#e5e7eb';
const DEFAULT_STROKE = '#3A4A6B';
const SELECTED_STROKE = '#1d4ed8';
const DISABLED_FILL = '#e9e9e9';

const SVG_NS = 'http://www.w3.org/2000/svg';
const OVERLAY_CLASS = 'campus-life-overlay';
const USER_RADIUS = 11;
const USER_GAP = 4;
const MAX_USER_CIRCLES = 6;
const RESOURCE_SIZE = 20;
const RESOURCE_GAP = 6;
const ROOM_PAD_X = 6;
const LABEL_FONT_MAX = 13;
const LABEL_FONT_MIN = 8;

// Each room is split into three horizontal bands by vertical fill extent:
// name on top, inventory icons in the middle, people at the bottom.
const BAND_NAME_FRACTION = 1 / 6;
const BAND_INVENTORY_FRACTION = 1 / 2;
const BAND_PEOPLE_FRACTION = 5 / 6;

function fillFor(room: RoomOnMap): string {
  if (room.is_blocked) return BLOCKED_COLOR;
  return ROOM_TYPE_COLOR[room.room_type] ?? DEFAULT_FILL;
}

function initialOf(user: UserOnMap): string {
  return user.display_name.trim()[0]?.toUpperCase() ?? '?';
}

function buildUserNode(
  user: UserOnMap,
  cx: number,
  cy: number,
  defs: SVGDefsElement,
  uniqueKey: string
): SVGElement {
  const wrapper = document.createElementNS(SVG_NS, 'g');
  wrapper.setAttribute('data-user-id', user.id);
  wrapper.style.pointerEvents = 'auto';
  wrapper.style.cursor = 'default';

  const title = document.createElementNS(SVG_NS, 'title');
  title.textContent = user.display_name;
  wrapper.appendChild(title);

  const photoUrl = resolveMediaUrl(user.photo);
  if (photoUrl) {
    const clipId = `clip-${uniqueKey}`;
    const clipPath = document.createElementNS(SVG_NS, 'clipPath');
    clipPath.setAttribute('id', clipId);
    const clipCircle = document.createElementNS(SVG_NS, 'circle');
    clipCircle.setAttribute('cx', String(cx));
    clipCircle.setAttribute('cy', String(cy));
    clipCircle.setAttribute('r', String(USER_RADIUS));
    clipPath.appendChild(clipCircle);
    defs.appendChild(clipPath);

    const image = document.createElementNS(SVG_NS, 'image');
    image.setAttributeNS(
      'http://www.w3.org/1999/xlink',
      'xlink:href',
      photoUrl
    );
    image.setAttribute('href', photoUrl);
    image.setAttribute('x', String(cx - USER_RADIUS));
    image.setAttribute('y', String(cy - USER_RADIUS));
    image.setAttribute('width', String(USER_RADIUS * 2));
    image.setAttribute('height', String(USER_RADIUS * 2));
    image.setAttribute('clip-path', `url(#${clipId})`);
    image.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    wrapper.appendChild(image);
  } else {
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', String(cx));
    circle.setAttribute('cy', String(cy));
    circle.setAttribute('r', String(USER_RADIUS));
    circle.setAttribute('fill', '#3b82f6');
    wrapper.appendChild(circle);

    const letter = document.createElementNS(SVG_NS, 'text');
    letter.textContent = initialOf(user);
    letter.setAttribute('x', String(cx));
    letter.setAttribute('y', String(cy + 4));
    letter.setAttribute('text-anchor', 'middle');
    letter.setAttribute('font-size', '11');
    letter.setAttribute('font-weight', '600');
    letter.setAttribute('fill', 'white');
    wrapper.appendChild(letter);
  }

  const border = document.createElementNS(SVG_NS, 'circle');
  border.setAttribute('cx', String(cx));
  border.setAttribute('cy', String(cy));
  border.setAttribute('r', String(USER_RADIUS));
  border.setAttribute('fill', 'none');
  border.setAttribute('stroke', 'white');
  border.setAttribute('stroke-width', '1.5');
  wrapper.appendChild(border);

  return wrapper;
}

function buildOverflowNode(count: number, cx: number, cy: number): SVGElement {
  const wrapper = document.createElementNS(SVG_NS, 'g');
  const circle = document.createElementNS(SVG_NS, 'circle');
  circle.setAttribute('cx', String(cx));
  circle.setAttribute('cy', String(cy));
  circle.setAttribute('r', String(USER_RADIUS));
  circle.setAttribute('fill', '#6b7280');
  circle.setAttribute('stroke', 'white');
  circle.setAttribute('stroke-width', '1.5');
  wrapper.appendChild(circle);

  const text = document.createElementNS(SVG_NS, 'text');
  text.textContent = `+${count}`;
  text.setAttribute('x', String(cx));
  text.setAttribute('y', String(cy + 4));
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('font-size', '10');
  text.setAttribute('font-weight', '600');
  text.setAttribute('fill', 'white');
  wrapper.appendChild(text);

  return wrapper;
}

// One on-map icon per distinct resource type (two stoves + one washer => a
// stove icon and a washer icon). Uses the server-provided icon per type.
interface ResourceIcon {
  key: string;
  iconUrl: string | null;
  names: string[];
  allBlocked: boolean;
}

function dedupeResources(resources: ResourceOnMap[]): ResourceIcon[] {
  const byType = new Map<string, ResourceIcon>();
  for (const resource of resources) {
    const key =
      resource.resource_type ?? resource.resource_icon ?? resource.name;
    const existing = byType.get(key);
    if (existing) {
      existing.names.push(resource.name);
      existing.allBlocked = existing.allBlocked && resource.is_blocked;
    } else {
      byType.set(key, {
        key,
        iconUrl: resolveMediaUrl(resource.resource_icon ?? null),
        names: [resource.name],
        allBlocked: resource.is_blocked,
      });
    }
  }
  return [...byType.values()];
}

function buildResourceNode(
  icon: ResourceIcon,
  cx: number,
  cy: number
): SVGElement | null {
  if (!icon.iconUrl) return null;

  const wrapper = document.createElementNS(SVG_NS, 'g');
  wrapper.setAttribute('data-resource-type', icon.key);
  wrapper.style.pointerEvents = 'auto';

  const title = document.createElementNS(SVG_NS, 'title');
  const label = icon.names.join(', ');
  title.textContent = icon.allBlocked ? `${label} (зайнятий)` : label;
  wrapper.appendChild(title);

  const image = document.createElementNS(SVG_NS, 'image');
  image.setAttributeNS(
    'http://www.w3.org/1999/xlink',
    'xlink:href',
    icon.iconUrl
  );
  image.setAttribute('href', icon.iconUrl);
  image.setAttribute('x', String(cx - RESOURCE_SIZE / 2));
  image.setAttribute('y', String(cy - RESOURCE_SIZE / 2));
  image.setAttribute('width', String(RESOURCE_SIZE));
  image.setAttribute('height', String(RESOURCE_SIZE));
  image.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  if (icon.allBlocked) image.setAttribute('opacity', '0.4');
  wrapper.appendChild(image);

  return wrapper;
}

function findTopEdgeY(
  el: SVGGeometryElement,
  cx: number,
  bbox: DOMRect
): number {
  const centerY = bbox.y + bbox.height / 2;
  if (!el.isPointInFill({ x: cx, y: centerY })) {
    return bbox.y;
  }

  let lo = bbox.y;
  let hi = centerY;
  for (let i = 0; i < 24 && hi - lo > 0.5; i++) {
    const mid = (lo + hi) / 2;
    if (el.isPointInFill({ x: cx, y: mid })) {
      hi = mid;
    } else {
      lo = mid;
    }
  }

  return hi;
}

function findBottomEdgeY(
  el: SVGGeometryElement,
  cx: number,
  bbox: DOMRect
): number {
  const centerY = bbox.y + bbox.height / 2;
  const bottom = bbox.y + bbox.height;
  if (!el.isPointInFill({ x: cx, y: centerY })) {
    return bottom;
  }

  let lo = centerY;
  let hi = bottom;
  for (let i = 0; i < 24 && hi - lo > 0.5; i++) {
    const mid = (lo + hi) / 2;
    if (el.isPointInFill({ x: cx, y: mid })) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return lo;
}

// Scans the polygon's horizontal cross-section at a given y so content can be
// centred inside the real (possibly angled) shape rather than its bounding box.
function findRowSpan(
  el: SVGGeometryElement,
  y: number,
  bbox: DOMRect
): { cx: number; width: number } | null {
  const step = Math.max(1, bbox.width / 120);
  let left: number | null = null;
  let right: number | null = null;
  for (let x = bbox.x; x <= bbox.x + bbox.width; x += step) {
    if (el.isPointInFill({ x, y })) {
      if (left === null) left = x;
      right = x;
    }
  }
  if (left === null || right === null) return null;
  return { cx: (left + right) / 2, width: right - left };
}

function fitRoomLabel(
  name: string,
  maxWidth: number,
  overlayGroup: SVGGElement
): { node: SVGTextElement; fontSize: number } {
  const label = document.createElementNS(SVG_NS, 'text');
  label.setAttribute('text-anchor', 'middle');
  label.setAttribute('font-weight', '600');
  label.setAttribute('fill', '#1f2937');
  label.style.pointerEvents = 'none';
  label.textContent = name;

  let fontSize = LABEL_FONT_MAX;
  label.setAttribute('font-size', String(fontSize));
  overlayGroup.appendChild(label);

  let textWidth = label.getComputedTextLength();
  if (textWidth > maxWidth && textWidth > 0) {
    const shrunkSize = Math.floor((LABEL_FONT_MAX * maxWidth) / textWidth);
    fontSize = Math.max(LABEL_FONT_MIN, shrunkSize);
    label.setAttribute('font-size', String(fontSize));
    textWidth = label.getComputedTextLength();

    if (textWidth > maxWidth && name.length > 1) {
      let trimmed = name;
      while (textWidth > maxWidth && trimmed.length > 1) {
        trimmed = trimmed.slice(0, -1);
        label.textContent = `${trimmed}…`;
        textWidth = label.getComputedTextLength();
      }
    }
  }

  return { node: label, fontSize };
}

interface BandGeometry {
  y: number;
  cx: number;
  maxWidth: number;
}

// Resolves a band centre to a point that actually lies inside the polygon,
// scanning the cross-section at that height (falls back to the bbox centre).
function resolveBand(
  el: SVGGeometryElement,
  bbox: DOMRect,
  y: number
): BandGeometry {
  const span = findRowSpan(el, y, bbox);
  if (span) {
    return {
      y,
      cx: span.cx,
      maxWidth: Math.max(16, span.width - ROOM_PAD_X * 2),
    };
  }
  return {
    y,
    cx: bbox.x + bbox.width / 2,
    maxWidth: Math.max(16, bbox.width - ROOM_PAD_X * 2),
  };
}

function renderNameBand(
  displayName: string,
  band: BandGeometry,
  overlayGroup: SVGGElement
) {
  const { node: label, fontSize } = fitRoomLabel(
    displayName,
    band.maxWidth,
    overlayGroup
  );
  label.setAttribute('x', String(band.cx));
  // Vertically centre the text on the band's midline.
  label.setAttribute('y', String(band.y + fontSize / 3));
}

function renderInventoryBand(
  room: RoomOnMap,
  band: BandGeometry,
  overlayGroup: SVGGElement
) {
  if (room.resources.length === 0) return;
  const icons = dedupeResources(room.resources);
  const slotWidth = RESOURCE_SIZE + RESOURCE_GAP;
  const maxSlots = Math.max(
    0,
    Math.floor((band.maxWidth + RESOURCE_GAP) / slotWidth)
  );
  const cap = Math.min(5, maxSlots);
  if (cap <= 0) return;

  const visible = icons.slice(0, cap);
  const rowWidth = visible.length * slotWidth - RESOURCE_GAP;
  const startX = band.cx - rowWidth / 2 + RESOURCE_SIZE / 2;
  visible.forEach((icon, index) => {
    const rx = startX + index * slotWidth;
    const node = buildResourceNode(icon, rx, band.y);
    if (node) overlayGroup.appendChild(node);
  });
}

function renderPeopleBand(
  room: RoomOnMap,
  band: BandGeometry,
  defs: SVGDefsElement,
  overlayGroup: SVGGElement
) {
  if (room.current_users.length === 0) return;
  const slotWidth = USER_RADIUS * 2 + USER_GAP;
  const maxSlots = Math.max(
    0,
    Math.floor((band.maxWidth + USER_GAP) / slotWidth)
  );
  const cap = Math.min(MAX_USER_CIRCLES, maxSlots);
  if (cap <= 0) return;

  const needsOverflow = room.current_users.length > cap;
  const visibleUsers = room.current_users.slice(
    0,
    needsOverflow ? Math.max(0, cap - 1) : cap
  );
  const overflow = room.current_users.length - visibleUsers.length;
  const slotsUsed = visibleUsers.length + (overflow > 0 ? 1 : 0);
  if (slotsUsed <= 0) return;

  const rowWidth = slotsUsed * slotWidth - USER_GAP;
  const startX = band.cx - rowWidth / 2 + USER_RADIUS;

  visibleUsers.forEach((user, index) => {
    const ux = startX + index * slotWidth;
    const node = buildUserNode(user, ux, band.y, defs, `${room.id}-${user.id}`);
    overlayGroup.appendChild(node);
  });

  if (overflow > 0) {
    const ox = startX + visibleUsers.length * slotWidth;
    overlayGroup.appendChild(buildOverflowNode(overflow, ox, band.y));
  }
}

function renderRoomOverlay(
  room: RoomOnMap,
  el: SVGGeometryElement,
  bbox: DOMRect,
  defs: SVGDefsElement,
  overlayGroup: SVGGElement
) {
  const cx = bbox.x + bbox.width / 2;
  const topY = findTopEdgeY(el, cx, bbox);
  const bottomY = findBottomEdgeY(el, cx, bbox);
  const innerHeight = Math.max(1, bottomY - topY);

  const nameBand = resolveBand(
    el,
    bbox,
    topY + innerHeight * BAND_NAME_FRACTION
  );
  const inventoryBand = resolveBand(
    el,
    bbox,
    topY + innerHeight * BAND_INVENTORY_FRACTION
  );
  const peopleBand = resolveBand(
    el,
    bbox,
    topY + innerHeight * BAND_PEOPLE_FRACTION
  );

  const hasEvents = room.active_events.length > 0;
  const displayName = hasEvents ? `🎉 ${room.name}` : room.name;

  renderNameBand(displayName, nameBand, overlayGroup);
  renderInventoryBand(room, inventoryBand, overlayGroup);
  renderPeopleBand(room, peopleBand, defs, overlayGroup);
}

export default function FloorMap({
  data,
  onRoomClick,
  selectedRoomId,
}: FloorMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const svgQuery = useQuery({
    queryKey: ['svg', data.map_file],
    queryFn: () => fetchSvg(data.map_file!),
    enabled: !!data.map_file,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !svgQuery.data) return;
    const svg = container.querySelector<SVGSVGElement>('svg');
    if (!svg) return;

    svg.querySelectorAll(`.${OVERLAY_CLASS}`).forEach((node) => node.remove());

    let defs = svg.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS(SVG_NS, 'defs');
      svg.insertBefore(defs, svg.firstChild);
    }
    defs.classList.add(OVERLAY_CLASS);

    const overlayGroup = document.createElementNS(SVG_NS, 'g') as SVGGElement;
    overlayGroup.classList.add(OVERLAY_CLASS);
    overlayGroup.setAttribute('id', 'campus-life-overlays');
    overlayGroup.style.pointerEvents = 'none';
    svg.appendChild(overlayGroup);

    const cleanups: Array<() => void> = [];

    const apiRoomIds = new Set(data.rooms.map((r) => r.svg_element_id));
    // Every id-bearing shape inside the map's #rooms group is a room polygon;
    // any that the API does not reference is a non-functional room.
    const roomsGroup = svg.querySelector('#rooms');
    const allRoomPolygons = (
      roomsGroup ?? svg
    ).querySelectorAll<SVGGeometryElement>('[id]');

    allRoomPolygons.forEach((el) => {
      if (apiRoomIds.has(el.id)) return;
      // Non-functional room: not part of the dorm
      el.setAttribute('fill', DISABLED_FILL);
      el.setAttribute('fill-opacity', '0.6');
      el.style.cursor = 'not-allowed';
      el.style.pointerEvents = 'auto';
      const existingTitle = el.querySelector('title');
      if (existingTitle) {
        existingTitle.textContent = 'Ця кімната не належить гуртожитку';
      } else {
        const newTitle = document.createElementNS(SVG_NS, 'title');
        newTitle.textContent = 'Ця кімната не належить гуртожитку';
        el.appendChild(newTitle);
      }
    });

    for (const room of data.rooms) {
      const el = container.querySelector<SVGGeometryElement>(
        `#${CSS.escape(room.svg_element_id)}`
      );
      if (!el) continue;

      const baseFill = fillFor(room);
      el.setAttribute('fill', baseFill);
      el.setAttribute('fill-opacity', '0.85');
      el.style.cursor = 'pointer';
      el.style.transition = 'filter 120ms ease, fill-opacity 120ms ease';
      el.setAttribute('data-room-id', String(room.id));

      const isSelected = room.id === selectedRoomId;
      el.setAttribute('stroke', isSelected ? SELECTED_STROKE : DEFAULT_STROKE);
      el.setAttribute('stroke-width', isSelected ? '6' : '4');

      const onEnter = () => {
        el.setAttribute('fill-opacity', '1');
        el.style.filter = 'brightness(0.88) saturate(1.25)';
        if (!isSelected) el.setAttribute('stroke-width', '5');
      };
      const onLeave = () => {
        el.setAttribute('fill-opacity', '0.85');
        el.style.filter = '';
        if (!isSelected) el.setAttribute('stroke-width', '4');
      };
      const onClick = () => onRoomClick(room);
      el.addEventListener('mouseenter', onEnter);
      el.addEventListener('mouseleave', onLeave);
      el.addEventListener('click', onClick);
      cleanups.push(() => {
        el.removeEventListener('mouseenter', onEnter);
        el.removeEventListener('mouseleave', onLeave);
        el.removeEventListener('click', onClick);
      });

      let bbox: DOMRect;
      try {
        bbox = el.getBBox();
      } catch {
        continue;
      }
      if (bbox.width === 0 || bbox.height === 0) continue;
      renderRoomOverlay(room, el, bbox, defs as SVGDefsElement, overlayGroup);
    }

    return () => {
      for (const cleanup of cleanups) cleanup();
      overlayGroup.remove();
    };
  }, [data.rooms, svgQuery.data, selectedRoomId, onRoomClick]);

  if (!data.map_file) {
    return (
      <p className="text-sm text-gray-500">
        Для цього поверху мапа недоступна.
      </p>
    );
  }
  if (svgQuery.isError) {
    return (
      <p className="text-sm text-red-700">
        Не вдалося завантажити мапу: {String(svgQuery.error)}
      </p>
    );
  }
  if (!svgQuery.data) {
    return <p className="text-sm text-gray-500">Завантажуємо мапу…</p>;
  }
  return (
    <TransformWrapper
      minScale={0.5}
      maxScale={4}
      initialScale={1}
      centerOnInit
      limitToBounds={false}
      smooth={false}
      doubleClick={{ disabled: true }}
      wheel={{ step: 0.1 }}
      pinch={{ step: 5 }}
    >
      {({ zoomIn, zoomOut, resetTransform }) => (
        <div
          id="floor-map-frame"
          className="relative h-full w-full overflow-hidden"
        >
          <TransformComponent
            wrapperClass="!h-full !w-full"
            contentClass="!h-full !w-full flex items-center justify-center"
          >
            <div
              id="floor-map-svg-container"
              ref={containerRef}
              className="[&_svg]:h-auto [&_svg]:max-h-[80vh] [&_svg]:w-auto [&_svg]:max-w-full"
              dangerouslySetInnerHTML={{ __html: svgQuery.data }}
            />
          </TransformComponent>
          <div
            id="floor-map-zoom-controls"
            className={
              'pointer-events-auto absolute right-3 bottom-3 z-10 ' +
              'flex flex-col gap-1 rounded-md bg-white/90 p-1 shadow'
            }
          >
            <button
              id="floor-map-zoom-in"
              type="button"
              aria-label="Збільшити"
              onClick={() => zoomIn()}
              className={
                'flex h-8 w-8 items-center justify-center rounded ' +
                'text-lg font-semibold text-gray-700 hover:bg-gray-100'
              }
            >
              +
            </button>
            <button
              id="floor-map-zoom-out"
              type="button"
              aria-label="Зменшити"
              onClick={() => zoomOut()}
              className={
                'flex h-8 w-8 items-center justify-center rounded ' +
                'text-lg font-semibold text-gray-700 hover:bg-gray-100'
              }
            >
              −
            </button>
            <button
              id="floor-map-zoom-reset"
              type="button"
              aria-label="Скинути"
              onClick={() => resetTransform()}
              className={
                'flex h-8 w-8 items-center justify-center rounded ' +
                'text-sm font-semibold text-gray-700 hover:bg-gray-100'
              }
            >
              ⟲
            </button>
          </div>
        </div>
      )}
    </TransformWrapper>
  );
}

async function fetchSvg(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}
