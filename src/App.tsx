// PBS Admin - Main Application Component

import { Dashboard } from "./components/Dashboard/Dashboard";
import { Toaster } from "sonner";
import { ErrorBoundary } from "./components/ui/error-boundary";
import { WindowProvider } from "./contexts/WindowContext";
import { WindowManager } from "./components/WindowManager";

function App() {
  return (
    <ErrorBoundary>
      <WindowProvider>
        <Dashboard />
        <WindowManager />
        <Toaster position="top-right" richColors closeButton />
      </WindowProvider>
    </ErrorBoundary>
  );
}

export default App;
