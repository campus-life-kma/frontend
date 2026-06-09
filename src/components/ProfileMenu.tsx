import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { User } from '../types/auth';
import UserAvatar from './UserAvatar';

interface ProfileMenuProps {
  user: User;
  onLogout: () => void;
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
    <div ref={containerRef} id="profile-menu" className="relative">
      <button
        id="profile-menu-button"
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={
          'flex items-center rounded-md border border-gray-200 ' +
          'bg-white p-1 transition hover:bg-gray-50'
        }
      >
        <UserAvatar
          id="profile-menu-avatar"
          name={user.full_name ?? user.email}
          photo={user.photo}
          size={32}
          rounded="md"
        />
      </button>
      {open && (
        <div
          id="profile-menu-dropdown"
          role="menu"
          className={
            'absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-lg ' +
            'border border-gray-200 bg-white shadow-lg'
          }
        >
          <Link
            id="profile-menu-profile"
            role="menuitem"
            to="/profile/me"
            onClick={() => setOpen(false)}
            className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
          >
            Мій профіль
          </Link>
          <button
            id="profile-menu-logout"
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
