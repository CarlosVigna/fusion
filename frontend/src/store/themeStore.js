import { create } from "zustand";

import {
  getPreference,
  savePreference,
} from "../services/preferencesService";

const STORAGE_KEY = "fusion_theme";

const THEME_PREFERENCE_KEY = "theme";

const VALID_THEMES = ["dark", "light", "blue"];

function applyTheme(theme) {

  document.documentElement.setAttribute("data-theme", theme);

  localStorage.setItem(STORAGE_KEY, theme);

}

export const useThemeStore = create((set) => ({

  theme: localStorage.getItem(STORAGE_KEY) || "dark",

  loaded: false,

  async loadTheme() {

    try {

      const saved = await getPreference(THEME_PREFERENCE_KEY);

      const theme = VALID_THEMES.includes(saved) ? saved : "dark";

      applyTheme(theme);

      set({ theme, loaded: true });

    } catch (error) {

      console.error(error);

      set({ loaded: true });

    }

  },

  async setTheme(theme) {

    if (!VALID_THEMES.includes(theme)) {
      return;
    }

    applyTheme(theme);

    set({ theme });

    try {

      await savePreference(THEME_PREFERENCE_KEY, theme);

    } catch (error) {

      console.error(error);

    }

  },

}));
