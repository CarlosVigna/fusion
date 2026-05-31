import { create }
from "zustand";

import { getDashboard }
from "../services/dashboardService";

export const useDashboardStore =
  create((set) => ({

    dashboard: null,

    loading: false,

    realtimeEvents: [],

    async loadDashboard() {

      try {

        set({
          loading: true,
        });

        const data =
          await getDashboard();

        set({
          dashboard: data,
        });

      } finally {

        set({
          loading: false,
        });

      }

    },

    pushRealtimeEvent(
      event
    ) {

      set((state) => ({

        realtimeEvents: [
          event,
          ...state.realtimeEvents,
        ].slice(0, 20),

      }));

    },

  }));