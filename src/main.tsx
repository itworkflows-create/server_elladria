import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppProvider, useUser } from "./context";
import { Layout } from "./components/layout";
import { Login } from "./pages/login";
import { Dashboard } from "./pages/dashboard";
import { DepartmentDetails, Departments } from "./pages/departments";
import { SearchFiles, StorageDetails } from "./pages/files";
import { UploadFile } from "./pages/upload";
import { ActivityPage, PermissionsPage, UsersPage } from "./pages/admin";
import { SettingsPage } from "./pages/settings";
import { Empty } from "./components/common";
import type { Role } from "./types";
import "./index.css";
const StoragePage = React.lazy(() =>
  import("./pages/storage").then((module) => ({ default: module.StoragePage })),
);
const client = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30000, retry: 1, refetchOnWindowFocus: false },
  },
});
function Guard({
  roles,
  children,
}: {
  roles: Role[];
  children: React.ReactNode;
}) {
  const user = useUser();
  return roles.includes(user.role) ? children : <Navigate to="/" replace />;
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="dashboard" element={<Navigate to="/" replace />} />
              <Route
                path="my-department"
                element={<Departments mode="mine" />}
              />
              <Route path="shared" element={<Departments mode="shared" />} />
              <Route
                path="departments"
                element={
                  <Guard roles={["Admin", "Executive"]}>
                    <Departments />
                  </Guard>
                }
              />
              <Route path="departments/:id" element={<DepartmentDetails />} />
              <Route path="storage/:id" element={<StorageDetails />} />
              <Route
                path="upload"
                element={
                  <Guard roles={["Admin", "Department Member"]}>
                    <UploadFile />
                  </Guard>
                }
              />
              <Route path="search" element={<SearchFiles />} />
              <Route
                path="storage"
                element={
                  <Guard roles={["Admin", "Executive"]}>
                    <React.Suspense
                      fallback={
                        <div
                          role="status"
                          aria-label="Loading storage overview"
                          className="skeleton h-64"
                        />
                      }
                    >
                      <StoragePage />
                    </React.Suspense>
                  </Guard>
                }
              />
              <Route
                path="users"
                element={
                  <Guard roles={["Admin"]}>
                    <UsersPage />
                  </Guard>
                }
              />
              <Route
                path="permissions"
                element={
                  <Guard roles={["Admin"]}>
                    <PermissionsPage />
                  </Guard>
                }
              />
              <Route
                path="activity"
                element={
                  <Guard roles={["Admin", "Executive"]}>
                    <ActivityPage />
                  </Guard>
                }
              />
              <Route path="settings" element={<SettingsPage />} />
              <Route
                path="*"
                element={
                  <Empty
                    title="Page not found"
                    description="Use the workspace navigation to find your way back."
                  />
                }
              />
            </Route>
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
