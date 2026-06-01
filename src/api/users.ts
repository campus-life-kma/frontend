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
  const { data } = await api.patch<UserProfile>(`/users/${userId}/`, payload);
  return data;
}
