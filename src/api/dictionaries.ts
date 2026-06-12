import api from './axios-instance';
import type {
  FacultyListItem,
  MajorListItem,
  RoleListItem,
  RoomTypeListItem,
  ResourceTypeListItem,
} from '../types/dictionaries';

export async function getRoles(): Promise<RoleListItem[]> {
  const { data } = await api.get<RoleListItem[]>('/roles/');
  return data;
}

export async function getFaculties(): Promise<FacultyListItem[]> {
  const { data } = await api.get<FacultyListItem[]>('/faculties/');
  return data;
}

export async function getMajors(): Promise<MajorListItem[]> {
  const { data } = await api.get<MajorListItem[]>('/majors/');
  return data;
}

export async function getRoomTypes(): Promise<RoomTypeListItem[]> {
  const { data } = await api.get<RoomTypeListItem[]>('/room-types/');
  return data;
}

export async function getResourceTypes(): Promise<ResourceTypeListItem[]> {
  const { data } = await api.get<ResourceTypeListItem[]>('/resource-types/');
  return data;
}
