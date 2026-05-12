import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Tasks from "./pages/Tasks";
import Organizations from "./pages/Organizations";
import SettingsPage from "./pages/Settings";
import PrivacyPage from "./pages/Privacy";
import DocumentationPage from "./pages/Documentation";
import AuthCallback from "./pages/AuthCallback";

import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          
          {/* Protected Routes */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
          <Route path="/projects/:id" element={<ProtectedRoute><ProjectDetail /></ProtectedRoute>} />
          <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
          <Route path="/organizations" element={<ProtectedRoute><Organizations /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/docs" element={<DocumentationPage />} />
        </Routes>
        <Analytics />
      </div>
    </Router>
  );
}

export default App;
