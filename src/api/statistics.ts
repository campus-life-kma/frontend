import api from './axios-instance';
import type { StatisticsSummary } from '../types/statistics';

export async function getStatisticsSummary(): Promise<StatisticsSummary> {
  const { data } = await api.get<StatisticsSummary>('/statistics/summary/');
  return data;
}
