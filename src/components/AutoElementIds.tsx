import { useEffect } from 'react';

/** Префікс за замовчуванням для автоматично згенерованих ідентифікаторів. */
const AUTO_ID_PREFIX = 'auto';

/**
 * Отримує порядковий індекс елемента серед його сусідів у батьківському вузлі.
 *
 * @param element - DOM-елемент, для якого шукається індекс.
 * @returns 0-індекс елемента або 0, якщо батьківський елемент відсутній.
 */
function getElementIndex(element: Element): number {
  const parent = element.parentElement;
  if (!parent) return 0;
  return Array.from(parent.children).indexOf(element);
}

/**
 * Будує унікальний ідентифікатор елемента на основі його шляху в DOM-дереві.
 * Шлях складається з назв тегів та порядкових індексів від кореня до елемента.
 *
 * @param element - HTML-елемент, для якого будується ID.
 * @returns Строка ідентифікатора (наприклад, "auto-html-0-body-0-div-2").
 */
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

/**
 * Знаходить усі HTML-елементи на сторінці та призначає їм унікальні ID,
 * якщо вони ще не мають явно заданого ідентифікатора.
 * Запобігає дублюванню шляхом додавання суфіксів.
 */
function assignElementIds() {
  const elements = [
    document.documentElement,
    document.head,
    document.body,
    ...Array.from(document.querySelectorAll('*')),
  ].filter(
    (element): element is HTMLElement => element instanceof window.HTMLElement
  );

  // Збираємо вже існуючі ідентифікатори на сторінці, щоб уникнути колізій
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

    // Якщо згенерований ID вже зайнятий, додаємо суфікс (-2, -3 тощо)
    while (usedIds.has(nextId)) {
      nextId = `${baseId}-${suffix}`;
      suffix += 1;
    }

    element.id = nextId;
    usedIds.add(nextId);
  });
}

/**
 * Невізуальний компонент, який автоматично відстежує зміни в DOM
 * за допомогою MutationObserver та призначає унікальні ID новим елементам.
 * Використовує requestAnimationFrame для уникнення
 * частих перемалювань (debounce).
 */
export default function AutoElementIds() {
  useEffect(() => {
    if (
      typeof document === 'undefined' ||
      typeof MutationObserver === 'undefined'
    ) {
      return;
    }

    let frameId: number | null = null;

    // Планує виконання призначення ID на наступний кадр анімації
    const scheduleAssign = () => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        assignElementIds();
      });
    };

    // Початкове призначення ID для вже існуючих елементів
    assignElementIds();

    // Спостереження за динамічним додаванням/видаленням елементів
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
