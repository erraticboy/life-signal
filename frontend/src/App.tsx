import { AnimatePresence } from "framer-motion";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { PageTransition } from "./components/motion/PageTransition";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./lib/theme";
import { AdminAIAnalysisPage } from "./pages/admin/AdminAIAnalysisPage";
import { AdminComplaintsPage } from "./pages/admin/AdminComplaintsPage";
import { AdminDashboardPage } from "./pages/admin/AdminDashboardPage";
import { AdminDuplicatesPage } from "./pages/admin/AdminDuplicatesPage";
import { AdminExportsPage } from "./pages/admin/AdminExportsPage";
import { AdminHotspotsPage } from "./pages/admin/AdminHotspotsPage";
import { AdminMaintenancePage } from "./pages/admin/AdminMaintenancePage";
import { AdminMapPage } from "./pages/admin/AdminMapPage";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";
import { CitizenDashboardPage } from "./pages/citizen/CitizenDashboardPage";
import { CitizenSettingsPage } from "./pages/citizen/CitizenSettingsPage";
import { ComplaintDetailsPage } from "./pages/citizen/ComplaintDetailsPage";
import { ComplaintSuccessPage } from "./pages/citizen/ComplaintSuccessPage";
import { MyComplaintsPage } from "./pages/citizen/MyComplaintsPage";
import { RegisterComplaintPage } from "./pages/citizen/RegisterComplaintPage";
import { AboutPage } from "./pages/public/AboutPage";
import { ContactPage } from "./pages/public/ContactPage";
import { HowItWorksPage } from "./pages/public/HowItWorksPage";
import { LandingPage } from "./pages/public/LandingPage";
import { LoginPage } from "./pages/public/LoginPage";
import { RegisterPage } from "./pages/public/RegisterPage";
import { ResetPasswordPage } from "./pages/public/ResetPasswordPage";

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Public Routes */}
        <Route
          path="/"
          element={
            <PageTransition>
              <LandingPage />
            </PageTransition>
          }
        />
        <Route
          path="/about"
          element={
            <PageTransition>
              <AboutPage />
            </PageTransition>
          }
        />
        <Route
          path="/how-it-works"
          element={
            <PageTransition>
              <HowItWorksPage />
            </PageTransition>
          }
        />
        <Route
          path="/contact"
          element={
            <PageTransition>
              <ContactPage />
            </PageTransition>
          }
        />
        <Route
          path="/login"
          element={
            <PageTransition>
              <LoginPage />
            </PageTransition>
          }
        />
        <Route
          path="/register"
          element={
            <PageTransition>
              <RegisterPage />
            </PageTransition>
          }
        />
        <Route
          path="/reset-password"
          element={
            <PageTransition>
              <ResetPasswordPage />
            </PageTransition>
          }
        />

        {/* Citizen Routes */}
        <Route
          path="/citizen/dashboard"
          element={
            <ProtectedRoute>
              <CitizenDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/citizen/complaints/new"
          element={
            <ProtectedRoute>
              <RegisterComplaintPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/citizen/complaints"
          element={
            <ProtectedRoute>
              <MyComplaintsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/citizen/complaints/:id/success"
          element={
            <ProtectedRoute>
              <ComplaintSuccessPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/citizen/complaints/:id"
          element={
            <ProtectedRoute>
              <ComplaintDetailsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/citizen/settings"
          element={
            <ProtectedRoute>
              <CitizenSettingsPage />
            </ProtectedRoute>
          }
        />

        {/* Administrator Routes */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/complaints"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminComplaintsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/ai-analysis"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminAIAnalysisPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/duplicates"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDuplicatesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/map"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminMapPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/hotspots"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminHotspotsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/maintenance"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminMaintenancePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/exports"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminExportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminUsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute requiredRole="admin">
              <CitizenSettingsPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AnimatedRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
