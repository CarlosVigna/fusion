import { create }
from "zustand";

export const useRealtimeStore =
  create((set) => ({
    connected: false,

    events: [],

    setConnected: (
      connected
    ) =>
      set({
        connected,
      }),

    pushEvent: (event) =>
      set((state) => ({
        events: [
          event,
          ...state.events,
        ].slice(0, 50),
      })),
  }));