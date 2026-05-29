import { resolveMediaUrl } from '../utils/media';

interface UserAvatarProps {
  name: string | null | undefined;
  photo: string | null;
  size?: number;
  rounded?: 'full' | 'md';
  id?: string;
}

function initial(name: string | null | undefined): string {
  if (!name) return '?';
  return name.trim()[0]?.toUpperCase() ?? '?';
}

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
