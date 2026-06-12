import { useEffect } from 'react';

const AUTO_ID_PREFIX = 'auto';

function getElementIndex(element: Element): number {
  const parent = element.parentElement;
  if (!parent) return 0;
  return Array.from(parent.children).indexOf(element);
}

function buildElementId(element: HTMLElement): string {
  const path: string[] = [];
  let current: HTMLElement | null = element;

  while (current) {
    const tag = current.tagName.toLowerCase();
    path.unshift(`${tag}-${getElementIndex(current)}`);
    current = current.parentElement;
  }

  return `${AUTO_ID_PREFIX}-${path.join('-')}`;
}

function assignElementIds() {
  const elements = [
    document.documentElement,
    document.head,
    document.body,
    ...Array.from(document.querySelectorAll('*')),
  ].filter(
    (element): element is HTMLElement => element instanceof window.HTMLElement
  );
  const usedIds = new Set(
    elements
      .map((element) => element.id)
      .filter((id): id is string => id.trim().length > 0)
  );

  elements.forEach((element) => {
    if (element.id) return;

    const baseId = buildElementId(element);
    let nextId = baseId;
    let suffix = 2;

    while (usedIds.has(nextId)) {
      nextId = `${baseId}-${suffix}`;
      suffix += 1;
    }

    element.id = nextId;
    usedIds.add(nextId);
  });
}

export default function AutoElementIds() {
  useEffect(() => {
    if (
      typeof document === 'undefined' ||
      typeof MutationObserver === 'undefined'
    ) {
      return;
    }

    let frameId: number | null = null;

    const scheduleAssign = () => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        assignElementIds();
      });
    };

    assignElementIds();

    const observer = new MutationObserver(scheduleAssign);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, []);

  return null;
}
