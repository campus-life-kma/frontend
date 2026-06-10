import api from './axios-instance';
import type { MajorListItem, RoleListItem } from '../types/dictionaries';

export async function getRoles(): Promise<RoleListItem[]> {
  const { data } = await api.get<RoleListItem[]>('/roles/');
  return data;
}

export async function getMajors(): Promise<MajorListItem[]> {
  const { data } = await api.get<MajorListItem[]>('/majors/');
  return data;
}
