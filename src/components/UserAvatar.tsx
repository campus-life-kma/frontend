import { resolveMediaUrl } from '../utils/media';

/**
 * Властивості компонента UserAvatar.
 */
interface UserAvatarProps {
  /** Ім'я користувача для відображення ініціалів. */
  name: string | null | undefined;
  /** Шлях або URL фотографії профілю. */
  photo: string | null;
  /** Розмір аватара в пікселях (за замовчуванням 32px). */
  size?: number;
  /** Форма заокруглення кутів аватара. */
  rounded?: 'full' | 'md';
  /** Ідентифікатор елемента в DOM. */
  id?: string;
}

/**
 * Генерує першу літеру (ініціал) імені користувача.
 * Повертає "?" якщо ім'я відсутнє або порожнє.
 */
function initial(name: string | null | undefined): string {
  if (!name) return '?';
  return name.trim()[0]?.toUpperCase() ?? '?';
}

/**
 * Компонент аватара користувача.
 * Відображає зображення профілю або першу літеру імені на кольоровому фоні.
 */
export default function UserAvatar({
  name,
  photo,
  size = 32,
  rounded = 'full',
  id,
}: UserAvatarProps) {
  const resolved = resolveMediaUrl(photo);
  const borderRadius = rounded === 'full' ? '9999px' : '6px';

  if (resolved) {
    return (
      <img
        id={id}
        src={resolved}
        alt=""
        className="object-cover"
        style={{ width: size, height: size, borderRadius }}
      />
    );
  }
  return (
    <span
      id={id}
      className="flex items-center justify-center bg-blue-500 font-semibold text-white"
      style={{
        width: size,
        height: size,
        borderRadius,
        fontSize: Math.round(size * 0.45),
      }}
    >
      {initial(name)}
    </span>
  );
}
