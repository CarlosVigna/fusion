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

    loadGridIfStale(
      filters = {},
      maxAgeMs = 30 * 60 * 1000
    ) {

      const { lastLoadedAt, loadGrid } =
        useGridStore.getState();

      const isStale =
        !lastLoadedAt ||
        Date.now() - lastLoadedAt > maxAgeMs;

      if (isStale) {
        return loadGrid(filters);
      }

      return Promise.resolve();

    },

    setVehicles(
      vehicles
    ) {

      set({
        vehicles,
      });

    },

    prependRealtimeEvent(
      plate,
      eventType
    ) {

      set((state) => ({

        vehicles:
          state.vehicles.map(
            (vehicle) => {

              if (
                vehicle.plate !== plate
              ) {

                return vehicle;

              }

              return {

                ...vehicle,

                realtimeEvent:
                  eventType,

              };

            }
          ),

      }));

    },

  }));