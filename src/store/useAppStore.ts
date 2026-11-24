"use client";

import { create } from "zustand";
import type { Me, WomanListItem } from "@/lib/pulso";

export type ViewId =
  | "contacts"
  | "woman"
  | "coach"
  | "today"
  | "dates"
  | "tools"
  | "medals"
  | "settings";

type AppState = {
  booted: boolean;
  me: Me | null;
  view: ViewId;
  selectedWomanId: string | null;
  women: WomanListItem[];
  womenLoaded: boolean;
  setBooted: (v: boolean) => void;
  setMe: (me: Me | null) => void;
  setView: (v: ViewId, womanId?: string | null) => void;
  setSelectedWoman: (id: string | null) => void;
  setWomen: (list: WomanListItem[]) => void;
  setWomenLoaded: (v: boolean) => void;
  refreshQuota: (used: number) => void;
  reset: () => void;
};

export const useAppStore = create<AppState>((set) => ({
  booted: false,
  me: null,
  view: "contacts",
  selectedWomanId: null,
  women: [],
  womenLoaded: false,
  setBooted: (v) => set({ booted: v }),
  setMe: (me) => set({ me }),
  setView: (v, womanId) =>
    set((s) => ({ view: v, selectedWomanId: womanId !== undefined ? womanId : s.selectedWomanId })),
  setSelectedWoman: (id) => set({ selectedWomanId: id }),
  setWomen: (list) => set({ women: list, womenLoaded: true }),
  setWomenLoaded: (v) => set({ womenLoaded: v }),
  refreshQuota: (used) =>
    set((s) => (s.me ? { me: { ...s.me, quota: { ...s.me.quota, used } } } : {})),
  reset: () => set({ me: null, view: "contacts", selectedWomanId: null, women: [], womenLoaded: false, booted: false }),
}));
