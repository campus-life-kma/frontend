import React, { useState } from 'react';
import { X, Upload, FileType2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { createFloor } from '../api/locations';

/**
 * Властивості компонента AddFloorModal.
 */
interface AddFloorModalProps {
  dormitoryId: number;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Модальне вікно для додавання нового поверху.
 * Дозволяє вказати номер поверху та завантажити файл мапи (SVG).
 */
const AddFloorModal: React.FC<AddFloorModalProps> = ({
  dormitoryId,
  isOpen,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const [number, setNumber] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!number) throw new Error('Введіть номер поверху');
      if (!file) throw new Error('Завантажте файл мапи');
      await createFloor(dormitoryId, parseInt(number, 10), file);
    },
    onSuccess: () => {
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: ['floors', dormitoryId] });
      setErrorMsg(null);
      onClose();
      setNumber('');
      setFile(null);
    },
    onError: (err: unknown) => {
      setErrorMsg(
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ||
          (err as Error).message ||
          'Помилка створення поверху'
      );
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (!selectedFile.name.toLowerCase().endsWith('.svg')) {
        setErrorMsg('Будь ласка, завантажте файл у форматі SVG');
        e.target.value = '';
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  if (!isOpen) return null;

  return (
    <div
      className={[
        'fixed inset-0 z-50 flex items-center justify-center overflow-y-auto',
        'bg-gray-900/50 p-4 backdrop-blur-sm',
      ].join(' ')}
    >
      <div
        className={[
          'relative my-8 flex w-full max-w-md flex-col overflow-hidden',
          'rounded-xl bg-white shadow-xl',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-900">Додати поверх</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6">
          <form
            id="add-floor-form"
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            <div>
              <label
                htmlFor="floorNumber"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Номер поверху
              </label>
              <input
                type="number"
                id="floorNumber"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                required
                min={1}
                max={100}
                placeholder="Наприклад: 1, 2, 3..."
                className={[
                  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm',
                  'transition-shadow focus:border-blue-500 focus:ring-1',
                  'focus:ring-blue-500 focus:outline-none',
                ].join(' ')}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Файл мапи (SVG)
              </label>
              <div
                className={[
                  'group relative mt-1 flex cursor-pointer justify-center rounded-md border-2',
                  'border-dashed border-gray-300 px-6 pt-5 pb-6 transition-colors',
                  'hover:border-blue-500 hover:bg-blue-50',
                ].join(' ')}
              >
                <input
                  id="map-upload"
                  name="map-upload"
                  type="file"
                  accept=".svg"
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  onChange={handleFileChange}
                />
                <div className="pointer-events-none space-y-2 text-center">
                  <div className="flex justify-center">
                    {file ? (
                      <FileType2 className="mx-auto h-12 w-12 text-blue-500" />
                    ) : (
                      <Upload className="mx-auto h-12 w-12 text-gray-400 transition-colors group-hover:text-blue-500" />
                    )}
                  </div>
                  <div className="flex justify-center text-sm text-gray-600">
                    <span
                      className={[
                        'relative font-medium text-blue-600 focus-within:ring-2',
                        'focus-within:ring-blue-500 focus-within:ring-offset-2',
                        'focus-within:outline-none',
                      ].join(' ')}
                    >
                      {file ? file.name : 'Завантажити файл'}
                    </span>
                  </div>
                  {!file && (
                    <p className="text-xs text-gray-500">лише SVG формати</p>
                  )}
                </div>
              </div>
            </div>
            {errorMsg && (
              <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
                {errorMsg}
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className={[
              'rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium',
              'text-gray-700 transition-colors hover:bg-gray-50 focus:ring-2 focus:ring-blue-500',
              'focus:ring-offset-2 focus:outline-none',
            ].join(' ')}
          >
            Скасувати
          </button>
          <button
            type="submit"
            form="add-floor-form"
            disabled={mutation.isPending || !number || !file}
            className={[
              'flex min-w-25 items-center justify-center rounded-md border border-transparent',
              'bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors',
              'hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
              'focus:outline-none disabled:cursor-not-allowed disabled:bg-blue-400',
            ].join(' ')}
          >
            {mutation.isPending ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white"></span>
            ) : (
              'Зберегти'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddFloorModal;
