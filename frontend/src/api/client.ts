import axios from "axios";

const api = axios.create({ baseURL: "/api" });

export interface DeterminaListItem {
  id: string;
  fonte_file: string;
  numero: string | null;
  data: string | null;
  fornitore: string | null;
  imponibile_totale: number | null;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface DeterminaDetail {
  id: string;
  source: string;
  created_at: string;
  updated_at: string;
  data: Record<string, unknown>;
}

export interface ListResponse {
  total: number;
  page: number;
  size: number;
  items: DeterminaListItem[];
}

export const extractDetermina = async (file: File) => {
  const form = new FormData();
  form.append("file", file);
  const res = await api.post("/extract", form);
  return res.data;
};

export const processBulk = async (gcsPath: string) => {
  const res = await api.post("/bulk", { gcs_path: gcsPath });
  return res.data;
};

export const listDetermine = async (page = 1, size = 20): Promise<ListResponse> => {
  const res = await api.get("/determine", { params: { page, size } });
  return res.data;
};

export const getDetermina = async (id: string): Promise<DeterminaDetail> => {
  const res = await api.get(`/determine/${id}`);
  return res.data;
};

export const updateDetermina = async (id: string, data: Record<string, unknown>) => {
  const res = await api.put(`/determine/${id}`, data);
  return res.data;
};

export const deleteDetermina = async (id: string) => {
  await api.delete(`/determine/${id}`);
};

export const exportDetermina = (id: string) => {
  window.open(`/api/determine/${id}/export`, "_blank");
};

export const exportAll = (ids?: string[]) => {
  const params = ids?.length ? `?ids=${ids.join(",")}` : "";
  window.open(`/api/determine/export${params}`, "_blank");
};
