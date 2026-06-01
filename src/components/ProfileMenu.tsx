import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { User } from '../types/auth';
import { goHome } from '../api/presence';
import UserAvatar from './UserAvatar';

interface ProfileMenuProps {
  user: User;
  onLogout: () => void;
}

export default function ProfileMenu({ user, onLogout }: ProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const goHomeMutation = useMutation({
    mutationFn: goHome,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['floor-map'] }),
  });

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
          'flex items-center gap-2 rounded-md border border-gray-200 ' +
          'bg-white px-2 py-1 pr-3 transition hover:bg-gray-50'
        }
      >
        <UserAvatar
          id="profile-menu-avatar"
          name={user.full_name ?? user.email}
          photo={user.photo}
          size={32}
          rounded="md"
        />
        <span className="text-sm font-medium text-gray-800">
          {user.full_name ?? user.email}
        </span>
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
          <button
            id="profile-menu-go-home"
            type="button"
            disabled={goHomeMutation.isPending}
            onClick={() => {
              setOpen(false);
              goHomeMutation.mutate();
            }}
            className={
              'block w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ' +
              'disabled:cursor-not-allowed disabled:opacity-60'
            }
          >
            Піти додому
          </button>
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
