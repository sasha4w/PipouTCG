import { api } from "../api/api";

export interface Image {
  id: number;
  name: string;
  url: string;
  createdAt: string;
}

export const imageService = {
  // ADMIN
  async findAll(): Promise<Image[]> {
    const res = await api.get("/images");
    return res.data;
  },

  async upload(file: File, name: string): Promise<Image> {
    const formData = new FormData();
    formData.append("image", file);
    formData.append("name", name);
    const res = await api.post("/images", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  async remove(id: number) {
    const res = await api.delete(`/images/${id}`);
    return res.data;
  },
};
