import React, { useState } from 'react';
import { FileType2, Upload, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { updateFloorMap } from '../api/locations';

interface EditFloorMapModalProps {
  floorId: number;
  floorNumber: number;
  dormitoryId: number;
  isOpen: boolean;
  onClose: () => void;
}

function getErrorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'data' in error.response &&
    typeof error.response.data === 'object' &&
    error.response.data !== null &&
    'detail' in error.response.data
  ) {
    const detail = error.response.data.detail;
    if (typeof detail === 'string') return detail;
  }

  if (error instanceof Error) return error.message;
  return 'Не вдалося оновити мапу поверху.';
}

const EditFloorMapModal: React.FC<EditFloorMapModalProps> = ({
  floorId,
  floorNumber,
  dormitoryId,
  isOpen,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Завантажте SVG-файл мапи поверху.');
      const formData = new FormData();
      formData.append('map_file', file);
      await updateFloorMap(floorId, formData);
    },
    onSuccess: () => {
      setErrorMsg(null);
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ['floors', dormitoryId] });
      queryClient.invalidateQueries({ queryKey: ['floor-map', floorId] });
      queryClient.invalidateQueries({ queryKey: ['svg'] });
      onClose();
    },
    onError: (error) => {
      setErrorMsg(getErrorMessage(error));
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith('.svg')) {
      setErrorMsg('Будь ласка, завантажте файл у форматі SVG.');
      event.target.value = '';
      setFile(null);
      return;
    }

    setErrorMsg(null);
    setFile(selectedFile);
  };

  const handleClose = () => {
    if (mutation.isPending) return;
    setErrorMsg(null);
    setFile(null);
    onClose();
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    mutation.mutate();
  };

  if (!isOpen) return null;

  return (
    <div
      id="edit-floor-map-modal-backdrop"
      className={
        'fixed inset-0 z-50 flex items-center justify-center overflow-y-auto ' +
        'bg-gray-900/50 p-4 backdrop-blur-sm'
      }
    >
      <div
        id="edit-floor-map-modal"
        className="relative my-8 flex w-full max-w-md flex-col overflow-hidden rounded-xl bg-white shadow-xl"
      >
        <div
          id="edit-floor-map-modal-header"
          className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-4"
        >
          <h2 className="text-xl font-semibold text-gray-900">
            Редагувати мапу {floorNumber} поверху
          </h2>
          <button
            id="edit-floor-map-close-button"
            type="button"
            onClick={handleClose}
            className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600"
            aria-label="Закрити вікно редагування мапи"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          id="edit-floor-map-form"
          onSubmit={handleSubmit}
          className="flex flex-col"
        >
          <div className="space-y-5 overflow-y-auto p-6">
            <div>
              <label
                htmlFor="edit-floor-map-upload"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Новий SVG-файл мапи
              </label>
              <div
                className={
                  'group relative mt-1 flex cursor-pointer justify-center rounded-md border-2 ' +
                  'border-dashed border-gray-300 px-6 pt-5 pb-6 transition-colors ' +
                  'hover:border-blue-500 hover:bg-blue-50'
                }
              >
                <input
                  id="edit-floor-map-upload"
                  name="map_file"
                  type="file"
                  accept=".svg,image/svg+xml"
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  onChange={handleFileChange}
                />
                <div className="pointer-events-none space-y-2 text-center">
                  <div className="flex justify-center">
                    {file ? (
                      <FileType2 className="mx-auto h-12 w-12 text-blue-500" />
                    ) : (
                      <Upload
                        className={
                          'mx-auto h-12 w-12 text-gray-400 transition-colors ' +
                          'group-hover:text-blue-500'
                        }
                      />
                    )}
                  </div>
                  <div className="flex justify-center text-sm text-gray-600">
                    <span className="relative max-w-full truncate font-medium text-blue-600">
                      {file ? file.name : 'Завантажити SVG'}
                    </span>
                  </div>
                  {!file && (
                    <p className="text-xs text-gray-500">
                      Нова мапа має зберігати id вже створених кімнат
                    </p>
                  )}
                </div>
              </div>
            </div>

            {errorMsg && (
              <div
                id="edit-floor-map-error"
                className="rounded-md bg-red-50 p-3 text-sm text-red-700"
              >
                {errorMsg}
              </div>
            )}
          </div>

          <div
            id="edit-floor-map-modal-footer"
            className="flex shrink-0 justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4"
          >
            <button
              id="edit-floor-map-cancel-button"
              type="button"
              onClick={handleClose}
              className={
                'rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium ' +
                'text-gray-700 transition-colors hover:bg-gray-50 focus:ring-2 ' +
                'focus:ring-blue-500 focus:ring-offset-2 focus:outline-none'
              }
            >
              Скасувати
            </button>
            <button
              id="edit-floor-map-submit-button"
              type="submit"
              disabled={mutation.isPending || !file}
              className={
                'flex min-w-[112px] items-center justify-center rounded-md border border-transparent ' +
                'bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors ' +
                'hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ' +
                'focus:outline-none disabled:cursor-not-allowed disabled:bg-blue-400'
              }
            >
              {mutation.isPending ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              ) : (
                'Оновити'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditFloorMapModal;
