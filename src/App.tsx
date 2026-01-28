// PBS Admin - Main Application Component

import { Dashboard } from "./components/Dashboard/Dashboard";
import { Toaster } from "sonner";
import { ErrorBoundary } from "./components/ui/error-boundary";

function App() {
  return (
    <ErrorBoundary>
      <Dashboard />
      <Toaster position="top-right" richColors closeButton />
    </ErrorBoundary>
  );
}

export default App;
