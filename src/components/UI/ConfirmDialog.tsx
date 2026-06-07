type ConfirmDialogVariant = 'danger' | 'warning' | 'info';

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
  isPending?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const variantStyles: Record<
  ConfirmDialogVariant,
  {
    iconWrap: string;
    icon: string;
    confirmButton: string;
  }
> = {
  danger: {
    iconWrap: 'bg-red-100 text-red-700',
    icon: '!',
    confirmButton:
      'bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-300',
  },
  warning: {
    iconWrap: 'bg-amber-100 text-amber-700',
    icon: '!',
    confirmButton:
      'bg-amber-600 text-white hover:bg-amber-700 disabled:bg-gray-300',
  },
  info: {
    iconWrap: 'bg-blue-100 text-blue-700',
    icon: 'i',
    confirmButton:
      'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300',
  },
};

export default function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel = 'Скасувати',
  variant = 'danger',
  isPending = false,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  const styles = variantStyles[variant];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-950/50 p-4 backdrop-blur-sm"
      onClick={() => {
        if (!isPending) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex gap-4">
          <div
            className={
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-full ' +
              `text-lg font-bold ${styles.iconWrap}`
            }
          >
            {styles.icon}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-950">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              {description}
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className={
              'rounded-md border border-gray-200 px-4 py-2 text-sm font-medium ' +
              'text-gray-700 hover:bg-gray-50 disabled:opacity-60'
            }
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={
              'rounded-md px-4 py-2 text-sm font-semibold ' +
              styles.confirmButton
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
