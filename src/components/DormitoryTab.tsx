/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Map, Pencil } from 'lucide-react';
import { getFloors, deleteFloor } from '../api/locations';

import AddFloorModal from './AddFloorModal';
import EditFloorMapModal from './EditFloorMapModal';
import ConfirmDialog from './UI/ConfirmDialog';
import type { FloorListItem } from '../types/locations';

interface DormitoryTabProps {
  dormitoryId: number;
}

const DormitoryTab: React.FC<DormitoryTabProps> = ({ dormitoryId }) => {
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [floorToEdit, setFloorToEdit] = useState<FloorListItem | null>(null);
  const [floorToDelete, setFloorToDelete] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: floors, isLoading } = useQuery({
    queryKey: ['floors', dormitoryId],
    queryFn: () => getFloors(dormitoryId),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteFloor(id),
    onSuccess: () => {
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: ['floors', dormitoryId] });
      setFloorToDelete(null);
    },
    onError: (err: any) => {
      setErrorMsg(
        err?.response?.data?.detail ||
          err.message ||
          'Помилка видалення поверху'
      );
      setFloorToDelete(null);
    },
  });

  const handleDeleteConfirm = () => {
    if (floorToDelete !== null) {
      deleteMutation.mutate(floorToDelete);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {errorMsg && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {errorMsg}
        </div>
      )}
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Поверхи</h2>
          <p className="mt-1 text-sm text-gray-500">
            Керування поверхами та мапами гуртожитку
          </p>
        </div>
        <button
          id="add-floor-button"
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
        >
          <Plus className="h-4 w-4" />
          Додати поверх
        </button>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-gray-500">Завантаження...</div>
      ) : floors && floors.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {floors.map((floor) => (
            <div
              id={`floor-card-${floor.id}`}
              key={floor.id}
              className="group flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 p-4">
                <div className="flex items-center gap-2 text-gray-900">
                  <Map className="h-5 w-5 text-blue-500" />
                  <span className="text-lg font-medium">
                    Поверх {floor.number}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    id={`edit-floor-map-button-${floor.id}`}
                    type="button"
                    onClick={() => setFloorToEdit(floor)}
                    className="rounded-md p-1.5 text-gray-400 opacity-0 transition-colors group-hover:opacity-100 hover:bg-blue-50 hover:text-blue-600 focus:opacity-100"
                    title="Редагувати мапу поверху"
                    aria-label={`Редагувати мапу ${floor.number} поверху`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    id={`delete-floor-button-${floor.id}`}
                    type="button"
                    onClick={() => setFloorToDelete(floor.id)}
                    className="rounded-md p-1.5 text-gray-400 opacity-0 transition-colors group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 focus:opacity-100"
                    title="Видалити поверх"
                    aria-label={`Видалити ${floor.number} поверх`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex flex-grow items-center justify-center bg-gray-50 p-4">
                {floor.map_file ? (
                  <img
                    src={floor.map_file}
                    alt={`Мапа поверху ${floor.number}`}
                    className="max-h-32 object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-sm text-gray-400">
                    <Map className="h-8 w-8 text-gray-300" />
                    <span>Мапа відсутня</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-200 bg-white py-12 text-center">
          <Map className="mx-auto mb-3 h-12 w-12 text-gray-300" />
          <h3 className="mb-1 text-base font-medium text-gray-900">
            Немає поверхів
          </h3>
          <p className="mb-4 text-sm text-gray-500">
            В цьому гуртожитку ще не додано жодного поверху.
          </p>
          <button
            id="add-first-floor-button"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
          >
            <Plus className="h-4 w-4" />
            Додати перший поверх
          </button>
        </div>
      )}

      <AddFloorModal
        dormitoryId={dormitoryId}
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />

      {floorToEdit && (
        <EditFloorMapModal
          floorId={floorToEdit.id}
          floorNumber={floorToEdit.number}
          dormitoryId={dormitoryId}
          isOpen={Boolean(floorToEdit)}
          onClose={() => setFloorToEdit(null)}
        />
      )}

      {floorToDelete !== null && (
        <ConfirmDialog
          title="Видалити поверх"
          description="Ви впевнені, що хочете видалити цей поверх? Цю дію неможливо скасувати. Видалення буде заборонено, якщо на поверсі існують кімнати."
          confirmLabel="Видалити"
          cancelLabel="Скасувати"
          variant="danger"
          isPending={deleteMutation.isPending}
          onConfirm={handleDeleteConfirm}
          onClose={() => setFloorToDelete(null)}
        />
      )}
    </div>
  );
};

export default DormitoryTab;
