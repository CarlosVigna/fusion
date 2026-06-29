import { useEffect } from "react";

import AppRoutes from "./routes/AppRoutes";

import { realtimeService } from "./services/realtime/realtimeService";

import { getMe } from "./services/authService";

import { useAuthStore } from "./store/authStore";

import { useThemeStore } from "./store/themeStore";

function App() {

  const loadTheme = useThemeStore((state) => state.loadTheme);

  const setUser = useAuthStore((state) => state.setUser);

  useEffect(() => {

    realtimeService.connect();

    // So busca a preferencia de tema do backend se ja tiver sessao —
    // a tela de login fica com o ultimo tema aplicado localmente
    // (default "dark") ate o usuario logar.
    if (localStorage.getItem("fusion_token")) {

      loadTheme();

      // Sessoes que ja estavam logadas antes desta versao nunca
      // tiveram "user" populado de verdade (so' o token) — busca
      // uma vez no boot pra preencher nome/foto no Header.
      if (!useAuthStore.getState().user) {

        getMe()
          .then(setUser)
          .catch((error) => console.error(error));

      }

    }

  }, []);

  return <AppRoutes />;

}

export default App;