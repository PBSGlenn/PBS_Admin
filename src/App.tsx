// PBS Admin - Main Application Component

import { Dashboard } from "./components/Dashboard/Dashboard";
import { Toaster } from "sonner";

function App() {
  return (
    <>
      <Dashboard />
      <Toaster position="top-right" richColors closeButton />
    </>
  );
}

export default App;
