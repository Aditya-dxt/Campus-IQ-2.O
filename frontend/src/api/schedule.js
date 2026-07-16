import { apiClient, delay, mockOrFetch } from "./client";
import { MOCK_WEEK_SCHEDULE } from "../mocks/mockData";

export async function getWeekSchedule() {
  return mockOrFetch({
    mockFn: async () => {
      await delay();
      return [...MOCK_WEEK_SCHEDULE];
    },
    requestFn: async () => {
      const { data } = await apiClient.get("/schedule/week");
      return data;
    },
  });
}
