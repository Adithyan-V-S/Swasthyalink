import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import LoadingSpinner from "./common/LoadingSpinner";

const PrivateRoute = ({ children, requiredRole = null }) => {
  const { isAuthenticated, isEmailVerified, canAccessRoute, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <LoadingSpinner />
      </div>
    );
  }

  // Check if user is authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if email is verified (except for preset admin, doctors, and nurses)
  if (!isEmailVerified) {
    return <Navigate to="/login" state={{ from: location, message: "Please verify your email before accessing this page." }} replace />;
  }

  // Check role-based access if required
  if (requiredRole && !canAccessRoute(requiredRole)) {
    return <Navigate to="/login" state={{ from: location, message: "You don't have permission to access this page." }} replace />;
  }

  return children;
};

export default PrivateRoute; 