import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
const Sidebar = ({ open, onClose }) => {
  const { userRole } = useAuth();
  const location = useLocation();

  // Show different menu items based on user role
  const getMenuItems = () => {
    const baseItems = [
      { to: "/", label: "Home" },
      { to: "/about", label: "About" },
    ];

    const roleSpecificItems = {
      admin: [
        { to: "/admindashboard", label: "Admin Dashboard" },
        { to: "/settings", label: "Settings" },
      ],
      doctor: [
        { to: "/doctordashboard", label: "Doctor Dashboard" },
        { to: "/settings", label: "Settings" },
      ],
      nurse: [
        { to: "/nursedashboard", label: "Nurse Dashboard" },
        { to: "/settings", label: "Settings" },
      ],
      patient: [
        { to: "/patientdashboard", label: "Patient Dashboard" },
        { to: "/healthanalytics", label: "Health Analytics" },
        { to: "/familydashboard", label: "Family Access" },
        { to: "/report-analyzer", label: "Smart Reports" },
        { to: "/exercise-coach", label: "AI Coach" },
        { to: "/settings", label: "Settings" },
      ],
    };

    return [...baseItems, ...(roleSpecificItems[userRole] || [])];
  };

  const menuItems = getMenuItems();

  return (
    <div
      className={`fixed top-0 left-0 h-screen w-64 z-[100] bg-slate-900 border-r border-slate-800 shadow-2xl text-white transform transition-transform duration-200 flex flex-col ${open ? 'translate-x-0' : '-translate-x-full'}`}
      onMouseLeave={onClose}
    >
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-800">
        <span className="text-xl font-bold text-white/90">Menu</span>
        <button onClick={onClose} className="text-white/70 hover:text-red-400">
          <span className="material-icons">close</span>
        </button>
      </div>
      <ul className="flex-1 overflow-y-auto bg-gray-100 flex flex-col gap-0 p-0 text-black font-medium">
        {menuItems.map((item, index) => (
          <li key={index} className="m-0">
            <Link
              to={item.to}
              className={`${location.pathname === item.to ? 'bg-blue-600 text-white' : 'text-black'} block w-full px-4 py-3 transition-colors`}
              onClick={onClose}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Sidebar; 