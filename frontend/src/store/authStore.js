import { create } from "zustand";

function parseUser() {

  try {

    const user =
      localStorage.getItem(
        "fusion_user"
      );

    if (
      !user ||
      user === "undefined"
    ) {

      return null;

    }

    return JSON.parse(user);

  } catch {

    return null;

  }

}

export const useAuthStore =
  create((set) => ({

    token:
      localStorage.getItem(
        "fusion_token"
      ),

    user: parseUser(),

    authenticated:
      !!localStorage.getItem(
        "fusion_token"
      ),

    setAuth: ({
      token,
      user = null,
    }) => {

      localStorage.setItem(
        "fusion_token",
        token
      );

      localStorage.setItem(
        "fusion_user",
        JSON.stringify(user)
      );

      set({

        token,

        user,

        authenticated: true,

      });

    },

    logout: () => {

      localStorage.removeItem(
        "fusion_token"
      );

      localStorage.removeItem(
        "fusion_user"
      );

      set({

        token: null,

        user: null,

        authenticated: false,

      });

      window.location.href =
        "/login";

    },

  }));