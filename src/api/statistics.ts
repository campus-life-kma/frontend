import api from './axios-instance';
import type { StatisticsSummary } from '../types/statistics';

/**
 * Отримує статистичні дані системи (загальну статистику
 * відвідувань, подій тощо).
 *
 * @returns Об'єкт з узагальненою статистикою.
 */
export async function getStatisticsSummary(): Promise<StatisticsSummary> {
  const { data } = await api.get<StatisticsSummary>('/statistics/summary/');
  return data;
}
