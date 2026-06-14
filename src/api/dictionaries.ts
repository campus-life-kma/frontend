import api from './axios-instance';
import type {
  FacultyListItem,
  MajorListItem,
  RoleListItem,
  RoomTypeListItem,
  ResourceTypeListItem,
} from '../types/dictionaries';

/**
 * Отримує довідник можливих ролей користувачів у системі.
 *
 * @returns Список ролей.
 */
export async function getRoles(): Promise<RoleListItem[]> {
  const { data } = await api.get<RoleListItem[]>('/roles/');
  return data;
}

/**
 * Отримує довідник факультетів університету.
 *
 * @returns Список факультетів.
 */
export async function getFaculties(): Promise<FacultyListItem[]> {
  const { data } = await api.get<FacultyListItem[]>('/faculties/');
  return data;
}

/**
 * Отримує довідник спеціальностей (majors).
 *
 * @returns Список спеціальностей.
 */
export async function getMajors(): Promise<MajorListItem[]> {
  const { data } = await api.get<MajorListItem[]>('/majors/');
  return data;
}

/**
 * Отримує довідник підтримуваних типів кімнат.
 *
 * @returns Список типів кімнат.
 */
export async function getRoomTypes(): Promise<RoomTypeListItem[]> {
  const { data } = await api.get<RoomTypeListItem[]>('/room-types/');
  return data;
}

/**
 * Отримує довідник типів ресурсів (наприклад, пральна машина, стіл тощо).
 *
 * @returns Список типів ресурсів.
 */
export async function getResourceTypes(): Promise<ResourceTypeListItem[]> {
  const { data } = await api.get<ResourceTypeListItem[]>('/resource-types/');
  return data;
}
