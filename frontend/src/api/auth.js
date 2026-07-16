import { apiClient, delay, mockOrFetch } from "./client";
import {
  addMockUser,
  createMockToken,
  getMockUsers,
} from "../mocks/mockData";

export async function login({ email, password }) {
  return mockOrFetch({
    mockFn: async () => {
      await delay();
      const user = getMockUsers().find(
        (u) => u.email === email && u.password === password,
      );
      if (!user) {
        const err = new Error("Invalid email or password");
        err.status = 401;
        throw err;
      }
      const { password: _, ...profile } = user;
      return {
        access_token: createMockToken(user),
        token_type: "bearer",
        user: profile,
      };
    },
    requestFn: async () => {
      const { data } = await apiClient.post("/auth/login", { email, password });
      return data;
    },
  });
}

export async function signup({ name, email, password, role, branch }) {
  return mockOrFetch({
    mockFn: async () => {
      await delay();
      if (getMockUsers().some((u) => u.email === email)) {
        const err = new Error("An account with this email already exists");
        err.status = 400;
        throw err;
      }
      const newUser = {
        id: `u-${role}-${Date.now()}`,
        name,
        email,
        password,
        role,
        branch: branch || null,
        ...(role === "student"
          ? { year: "1st Year", gpa: "" }
          : { cohort: "New cohort" }),
      };
      addMockUser(newUser);
      const { password: _, ...profile } = newUser;
      return {
        access_token: createMockToken(newUser),
        token_type: "bearer",
        user: profile,
      };
    },
    requestFn: async () => {
      const { data } = await apiClient.post("/auth/signup", {
        name,
        email,
        password,
        role,
        branch,
      });
      return data;
    },
  });
}

export async function getProfile() {
  return mockOrFetch({
    mockFn: async () => {
      await delay(300);
      const token = localStorage.getItem("campusiq_token");
      const stored = localStorage.getItem("campusiq_user");
      if (stored) return JSON.parse(stored);
      throw new Error("Not authenticated");
    },
    requestFn: async () => {
      const { data } = await apiClient.get("/auth/me");
      return data;
    },
  });
}
