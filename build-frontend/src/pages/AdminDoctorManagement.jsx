import React, { useState, useEffect } from 'react';
import * as adminService from '../services/adminService';

const AdminDoctorManagement = () => {
  const [registrations, setRegistrations] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [selectedRegistration, setSelectedRegistration] = useState(null);
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchRegistrations = async () => {
    try {
      const data = await adminService.getPendingDoctorRegistrations();
      if (data.success) {
        setRegistrations(data.registrations || []);
      }
    } catch (err) {
      console.error('Failed to fetch registrations', err);
    }
  };

  const fetchDoctors = async () => {
    try {
      const data = await adminService.getAllDoctors();
      if (data.success) {
        setDoctors(data.doctors || []);
      }
    } catch (err) {
      console.error('Failed to fetch doctors', err);
    }
  };

  useEffect(() => {
    fetchRegistrations();
    fetchDoctors();
  }, []);

  const handleApprove = async (registration) => {
    if (!loginId || !password) {
      setError('Login ID and password are required to approve');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await adminService.approveDoctorRegistration(registration.id, loginId, password);
      if (data.success) {
        setSelectedRegistration(null);
        setLoginId('');
        setPassword('');
        fetchRegistrations();
        fetchDoctors();
      } else {
        setError(data.error || 'Failed to approve registration');
      }
    } catch (err) {
      setError('Error approving registration');
      console.error(err);
    }
    setLoading(false);
  };

  const handleReject = async (registration) => {
    setLoading(true);
    setError('');
    try {
      const data = await adminService.rejectDoctorRegistration(registration.id);
      if (data.success) {
        fetchRegistrations();
      } else {
        setError(data.error || 'Failed to reject registration');
      }
    } catch (err) {
      setError('Error rejecting registration');
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="p-6 bg-gray-900 text-white min-h-screen">
      <h1 className="text-3xl font-bold mb-6">Admin Doctor Management</h1>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold mb-4">Pending Doctor Registrations</h2>
        {registrations.length === 0 && <p>No pending registrations.</p>}
        {registrations.map((reg) => (
          <div key={reg.id} className="border border-gray-700 rounded p-4 mb-4">
            <p><strong>Name:</strong> {reg.name}</p>
            <p><strong>Email:</strong> {reg.email}</p>
            <p><strong>Specialization:</strong> {reg.specialization}</p>
            <p><strong>License:</strong> {reg.license}</p>
            <p><strong>Experience:</strong> {reg.experience}</p>
            <p><strong>Description:</strong> {reg.description}</p>
            <p><strong>Phone:</strong> {reg.phone}</p>
            {selectedRegistration === reg.id ? (
              <div className="mt-4 space-y-2">
                <input
                  type="text"
                  placeholder="Login ID"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  className="w-full p-2 rounded bg-gray-800 border border-gray-600"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-2 rounded bg-gray-800 border border-gray-600"
                />
                {error && <p className="text-red-500">{error}</p>}
                <div className="flex space-x-4">
                  <button
                    onClick={() => handleApprove(reg)}
                    disabled={loading}
                    className="bg-green-600 px-4 py-2 rounded hover:bg-green-700"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      setSelectedRegistration(null);
                      setError('');
                    }}
                    className="bg-gray-600 px-4 py-2 rounded hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-x-4">
                <button
                  onClick={() => setSelectedRegistration(reg.id)}
                  className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-700"
                >
                  Provide Credentials & Approve
                </button>
                <button
                  onClick={() => handleReject(reg)}
                  disabled={loading}
                  className="bg-red-600 px-4 py-2 rounded hover:bg-red-700"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">Approved Doctors</h2>
        {doctors.length === 0 && <p>No approved doctors.</p>}
        <table className="w-full table-auto border-collapse border border-gray-700">
          <thead>
            <tr className="bg-gray-800">
              <th className="border border-gray-600 px-4 py-2">Name</th>
              <th className="border border-gray-600 px-4 py-2">Email</th>
              <th className="border border-gray-600 px-4 py-2">Specialization</th>
              <th className="border border-gray-600 px-4 py-2">License</th>
              <th className="border border-gray-600 px-4 py-2">Experience</th>
              <th className="border border-gray-600 px-4 py-2">Phone</th>
              <th className="border border-gray-600 px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {doctors.map((doc) => (
              <tr key={doc.email} className="odd:bg-gray-700 even:bg-gray-800">
                <td className="border border-gray-600 px-4 py-2">{doc.name}</td>
                <td className="border border-gray-600 px-4 py-2">{doc.email}</td>
                <td className="border border-gray-600 px-4 py-2">{doc.specialization}</td>
                <td className="border border-gray-600 px-4 py-2">{doc.license}</td>
                <td className="border border-gray-600 px-4 py-2">{doc.experience}</td>
                <td className="border border-gray-600 px-4 py-2">{doc.phone}</td>
                <td className="border border-gray-600 px-4 py-2">{doc.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
};

export default AdminDoctorManagement;
