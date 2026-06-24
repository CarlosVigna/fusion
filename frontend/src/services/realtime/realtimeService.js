import SockJS
from "sockjs-client";

import { Client }
from "@stomp/stompjs";

import toast
from "react-hot-toast";

const API_BASE =
  import.meta.env.VITE_API_URL ||
  "http://localhost:8080";

class RealtimeService {

  constructor() {

    this.client = null;

    this.listeners = [];

  }

  connect() {

    if (
      this.client?.connected
    ) {

      return;

    }

    const socket =
      new SockJS(
        `${API_BASE}/ws`
      );

    this.client =
      new Client({

        webSocketFactory:
          () => socket,

        reconnectDelay:
          5000,

        debug: () => {},

        onConnect: () => {

          console.log(
            "Realtime conectado"
          );

          this.client.subscribe(

            "/topic/dashboard",

            (message) => {

              const payload =
                JSON.parse(
                  message.body
                );

              this.listeners.forEach(
                (listener) => {

                  listener(payload);

                }
              );

              this.showToast(
                payload
              );

            }
          );

        },

        onStompError:
          (frame) => {

            console.error(
              "Realtime error",
              frame
            );

          },

      });

    this.client.activate();

  }

  onDashboardEvent(
    callback
  ) {

    this.listeners.push(
      callback
    );

    return () => {

      this.listeners =
        this.listeners.filter(
          (listener) =>
            listener !== callback
        );

    };

  }

  showToast(payload) {

    const message =
      payload.message ||
      "Evento operacional";

    switch (payload.type) {

      case "ALERT_OPENED":

        toast.error(
          `🔴 ${message}`
        );

        break;

      case "ALERT_RESOLVED":

        toast.success(
          `🟢 ${message}`
        );

        break;

      default:

        toast(
          `📡 ${message}`
        );

    }

  }

}

export const realtimeService =
  new RealtimeService();