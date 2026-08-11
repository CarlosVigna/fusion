import { create }
from "zustand";

import { getOperationalGrid }
from "../services/gridService";

export const useGridStore =
  create((set) => ({

    vehicles: [],

    loading: false,

    lastLoadedAt: null,

    async loadGrid(
      filters = {}
    ) {

      try {

        set({
          loading: true,
        });

        const data =
          await getOperationalGrid(
            filters
          );

        set({
          vehicles: data,
          loading: false,
          lastLoadedAt: Date.now(),
        });

      } catch (error) {

        console.error(error);

        set({
          loading: false,
        });

      }

    },

    setVehicles(
      vehicles
    ) {

      set({
        vehicles,
      });

    },

  }));