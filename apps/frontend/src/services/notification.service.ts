import { api } from "../api/api";
import type {
  CreatePatchnoteRequest,
  NotificationCategory,
  NotificationsResponse,
} from "@pipou/shared";

export const notificationService = {
  async list(category?: NotificationCategory): Promise<NotificationsResponse> {
    const res = await api.get("/notifications", {
      params: category ? { category } : {},
    });
    return res.data;
  },

  async markAllRead(): Promise<void> {
    await api.post("/notifications/read-all");
  },

  // Admin
  async createPatchnote(data: CreatePatchnoteRequest): Promise<void> {
    await api.post("/patchnotes", data);
  },
};
