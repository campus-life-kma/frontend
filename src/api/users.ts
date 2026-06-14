import api from './axios-instance';
import type {
  UserProfile,
  UserProfileUpdatePayload,
  UserSocialActivity,
} from '../types/users';

export async function getUserProfile(userId: string): Promise<UserProfile> {
  const { data } = await api.get<UserProfile>(`/users/${userId}/`);
  return data;
}

export async function getUserSocialActivity(
  userId: string
): Promise<UserSocialActivity> {
  const { data } = await api.get<UserSocialActivity>(
    `/users/${userId}/social-activity/`
  );
  return data;
}

export async function updateUserProfile(
  userId: string,
  payload: UserProfileUpdatePayload
): Promise<UserProfile> {
  const hasFile = payload.photo instanceof File;

  if (hasFile) {
    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      formData.append(key, value);
    });
    const { data } = await api.patch<UserProfile>(
      `/users/${userId}/`,
      formData
    );
    return data;
  }

  const { data } = await api.patch<UserProfile>(`/users/${userId}/`, payload);
  return data;
}

export async function evictUser(userId: string): Promise<void> {
  await api.delete(`/users/${userId}/`);
}

export interface UserCreatePayload {
  email: string;
  position: string;
  role: number;
  room: number;
}

export async function createUser(
  payload: UserCreatePayload
): Promise<UserProfile> {
  const { data } = await api.post<UserProfile>('/users/', payload);
  return data;
}
