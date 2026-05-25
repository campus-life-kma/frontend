import { useEffect, useRef, useState } from 'react';
import type { User } from '../types/auth';

interface ProfileMenuProps {
  user: User;
  onLogout: () => void;
}

function initialsOf(fullName: string | null): string {
  if (!fullName) return '?';
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const second = parts[1]?.[0] ?? '';
  return (first + second).toUpperCase();
}

export default function ProfileMenu({ user, onLogout }: ProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={
          'flex items-center gap-2 rounded-full border border-gray-200 ' +
          'bg-white px-2 py-1 pr-3 transition hover:bg-gray-50'
        }
      >
        {user.photo ? (
          <img
            src={user.photo}
            alt=""
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <span
            className={
              'flex h-8 w-8 items-center justify-center rounded-full ' +
              'bg-blue-100 text-xs font-semibold text-blue-700'
            }
          >
            {initialsOf(user.full_name)}
          </span>
        )}
        <span className="text-sm font-medium text-gray-800">
          {user.full_name ?? user.email}
        </span>
      </button>
      {open && (
        <div
          className={
            'absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-lg ' +
            'border border-gray-200 bg-white shadow-lg'
          }
        >
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
          >
            Вийти
          </button>
        </div>
      )}
    </div>
  );
}
