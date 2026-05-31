import { useEffect } from "react";

import AppRoutes from "./routes/AppRoutes";

import { realtimeService } from "./services/realtime/realtimeService";

function App() {

  useEffect(() => {

    realtimeService.connect();

  }, []);

  return <AppRoutes />;

}

export default App;