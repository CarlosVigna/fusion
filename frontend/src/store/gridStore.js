import { create }
from "zustand";

import { getOperationalGrid }
from "../services/gridService";

export const useGridStore =
  create((set) => ({

    vehicles: [],

    loading: false,

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