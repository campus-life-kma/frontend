import { Link } from 'react-router-dom';
import { APP_TITLE } from '../constants/app';
import { useAuthStore } from '../store/authStore';
import ProfileMenu from './ProfileMenu';

/** Типи активних пунктів навігаційного меню. */
type ActiveNavItem = 'map' | 'feed' | 'statistics' | 'none';

/**
 * Властивості для компонента AppHeader.
 */
interface AppHeaderProps {
  /** Поточний активний пункт меню навігації. */
  active?: ActiveNavItem;
  /** Шлях до сторінки карти (за замовчуванням "/"). */
  mapPath?: string;
  /** Шлях до соціальної стрічки (за замовчуванням "/feed"). */
  feedPath?: string;
  /** Шлях до статистики (за замовчуванням "/statistics"). */
  statisticsPath?: string;
}

/**
 * Компонент верхньої шапки додатка.
 * Відображає назву додатка, панель навігації (залежно від прав користувача,
 * наприклад, доступ до статистики мають тільки
 * адміни/модератори) та меню профілю.
 */
export default function AppHeader({
  active = 'none',
  mapPath = '/',
  feedPath = '/feed',
  statisticsPath = '/statistics',
}: AppHeaderProps) {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const canSeeStatistics = user?.role === 'ADMIN' || user?.role === 'MODERATOR';

  const navItems = [
    { key: 'map', label: 'Мапа', to: mapPath, visible: true },
    { key: 'feed', label: 'Стрічка', to: feedPath, visible: true },
    {
      key: 'statistics',
      label: 'Статистика',
      to: statisticsPath,
      visible: canSeeStatistics,
    },
  ] as const;

  return (
    <header
      className={
        'flex min-h-14 items-center justify-between gap-2 border-b ' +
        'border-gray-200 bg-white px-3 py-2 sm:px-6'
      }
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
        <h1 className="shrink-0 text-base font-semibold text-gray-900 sm:text-lg">
          <Link to={mapPath}>{APP_TITLE}</Link>
        </h1>
        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-xs sm:text-sm">
          {navItems
            .filter((item) => item.visible)
            .map((item) => {
              const isActive = active === item.key;
              return (
                <Link
                  key={item.key}
                  className={
                    'shrink-0 rounded-md px-2.5 py-1.5 font-medium ' +
                    'sm:px-3 ' +
                    (isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50')
                  }
                  to={item.to}
                >
                  {item.label}
                </Link>
              );
            })}
        </nav>
      </div>
      {user && (
        <div className="shrink-0">
          <ProfileMenu user={user} onLogout={logout} />
        </div>
      )}
    </header>
  );
}
