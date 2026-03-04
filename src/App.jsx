import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Clock, AlertTriangle, Users, Calendar, Trophy, Plus, LogOut, X, Save, Lock, Edit2, Trash2, AlertCircle } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth'; 
import { getFirestore, collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];

// Konfigurasi Firebase disesuaikan kembali agar berjalan di semua environment
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

export default function App() {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState(false);

  const [employees, setEmployees] = useState([]);
  
  // State untuk Modals & Forms
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState(null); // Menyimpan ID data yang sedang diedit
  const [itemToDelete, setItemToDelete] = useState(null); // Menyimpan data yang akan dihapus
  
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpNid, setNewEmpNid] = useState('');
  const [newEmpData, setNewEmpData] = useState(Array.from({ length: 12 }, () => ({ hours: '', minutes: '' })));

  // Handler untuk otomatis huruf kapital
  const handleNameChange = (e) => {
    const input = e.target.value;
    // Mengubah huruf pertama dari setiap kata menjadi kapital
    const capitalized = input.replace(/\b\w/g, char => char.toUpperCase());
    setNewEmpName(capitalized);
  };

  const handleNidChange = (e) => {
    // Mengubah seluruh input NID menjadi huruf kapital
    setNewEmpNid(e.target.value.toUpperCase());
  };

  // --- Firebase Auth ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Gagal login:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // --- Fetch Data Realtime ---
  useEffect(() => {
    if (!user) return;
    
    const employeesRef = collection(db, 'artifacts', appId, 'public', 'data', 'employees');
    const unsubscribe = onSnapshot(employeesRef, (snapshot) => {
      const emps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEmployees(emps);
    }, (error) => {
      console.error("Gagal mengambil data dari database: ", error);
    });
    
    return () => unsubscribe();
  }, [user]);

  // --- Handlers ---
  const handleLogin = (e) => {
    e.preventDefault();
    if (passwordInput === 'ririn') {
      setIsAuthenticated(true);
      setLoginError(false);
      setPasswordInput('');
    } else {
      setLoginError(true);
    }
  };

  const handleLogout = () => setIsAuthenticated(false);

  const resetForm = () => {
    setNewEmpName('');
    setNewEmpNid('');
    setNewEmpData(Array.from({ length: 12 }, () => ({ hours: '', minutes: '' })));
    setEditingId(null);
    setShowAddModal(false);
  };

  // Simpan Data (Tambah Baru ATAU Update Data Lama)
  const handleSaveEmployee = async (e) => {
    e.preventDefault();
    if (!newEmpName.trim() || !newEmpNid.trim() || !user) return;

    const processedMonthlyData = newEmpData.map(data => {
      const h = Number(data.hours) || 0;
      const m = Number(data.minutes) || 0;
      return Number((h + (m / 60)).toFixed(2));
    });

    const totalHours = Number(processedMonthlyData.reduce((acc, val) => acc + val, 0).toFixed(2));
    const avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${newEmpName}&backgroundColor=1e293b,334155,475569&textColor=f8fafc`;

    try {
      if (editingId) {
        // Mode EDIT: Perbarui dokumen yang ada
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'employees', editingId);
        await updateDoc(docRef, {
          nid: newEmpNid,
          name: newEmpName,
          monthlyData: processedMonthlyData,
          totalHours: totalHours,
          avatar: avatarUrl
        });
      } else {
        // Mode TAMBAH BARU: Buat dokumen baru
        const newId = `EMP-${Date.now()}`;
        const newEmployee = {
          id: newId,
          nid: newEmpNid,
          name: newEmpName,
          monthlyData: processedMonthlyData,
          totalHours: totalHours,
          avatar: avatarUrl
        };
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'employees', newId);
        await setDoc(docRef, newEmployee);
      }
      resetForm();
    } catch (error) {
      console.error("Gagal menyimpan data ke database: ", error);
    }
  };

  const handleMonthChange = (index, field, value) => {
    const newData = [...newEmpData];
    newData[index] = { ...newData[index], [field]: value };
    setNewEmpData(newData);
  };

  // Memicu Modal Edit
  const handleEdit = (emp) => {
    setEditingId(emp.id);
    setNewEmpName(emp.name);
    setNewEmpNid(emp.nid || emp.id);

    // Konversi kembali dari format desimal jam ke Jam & Menit untuk Form
    const formatedData = emp.monthlyData.map(val => {
      const totalMinutes = Math.round(val * 60);
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      return { 
        hours: h > 0 ? h.toString() : '', 
        minutes: m > 0 ? m.toString() : '' 
      };
    });
    
    setNewEmpData(formatedData);
    setShowAddModal(true);
  };

  // Mengeksekusi Penghapusan Data
  const executeDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'employees', itemToDelete.id));
      setItemToDelete(null); // Tutup modal konfirmasi
    } catch (error) {
      console.error("Gagal menghapus data:", error);
    }
  };

  // --- Calculations ---
  const allEmployeesSorted = useMemo(() => {
    return [...employees].sort((a, b) => b.totalHours - a.totalHours);
  }, [employees]);

  const top10Employees = useMemo(() => allEmployeesSorted.slice(0, 10), [allEmployeesSorted]);

  const totalJamKeseluruhan = Number(employees.reduce((acc, emp) => acc + emp.totalHours, 0).toFixed(2));
  const rataRataPerKaryawan = employees.length ? (totalJamKeseluruhan / employees.length).toFixed(1) : 0;
  
  const bulanTertinggi = useMemo(() => {
    if (employees.length === 0) return '-';
    const monthlyTotals = BULAN.map((_, index) => {
      return employees.reduce((acc, emp) => acc + (emp.monthlyData[index] || 0), 0);
    });
    const maxIndex = monthlyTotals.indexOf(Math.max(...monthlyTotals));
    return BULAN[maxIndex];
  }, [employees]);

  // --- Render Layar Login ---
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 font-sans text-slate-800">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 sm:p-8 shadow-xl border border-slate-100">
          <div className="mb-8 flex flex-col items-center">
            <div className="mb-4 rounded-full bg-blue-100 p-4 text-blue-600">
              <Lock size={32} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Admin Login</h1>
            <p className="text-sm text-slate-500 text-center mt-2">Masuk untuk mengelola data keterlambatan.</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input 
                type="password" 
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Masukkan password..."
                className={`w-full rounded-lg border px-4 py-3 outline-none transition-colors ${loginError ? 'border-red-500' : 'border-slate-300 focus:border-blue-500'}`}
                autoFocus
              />
              {loginError && <p className="mt-2 text-sm text-red-600">Password salah!</p>}
            </div>
            <button type="submit" className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 transition-colors">
              Masuk ke Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- Render Dashboard ---
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-800 relative">
      <div className="mx-auto max-w-7xl space-y-6 md:space-y-8">
        
        {/* Header Responsif */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Dashboard Kedisiplinan</h1>
            <p className="text-sm md:text-base text-slate-500 mt-1">Laporan Akumulasi Keterlambatan Karyawan</p>
          </div>
          <div className="flex items-center space-x-3">
            <button onClick={() => { resetForm(); setShowAddModal(true); }} className="inline-flex flex-1 sm:flex-none justify-center items-center space-x-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
              <Plus size={18} /><span>Tambah Data</span>
            </button>
            <button onClick={handleLogout} className="inline-flex justify-center items-center space-x-2 rounded-lg bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-300 transition-colors">
              <LogOut size={18} />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </header>

        {/* Ringkasan Data (Grid Adaptif) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl bg-white p-5 md:p-6 shadow-sm border border-slate-100 flex items-center space-x-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><Users size={24} /></div>
            <div>
              <p className="text-xs md:text-sm font-medium text-slate-500">Total Karyawan</p>
              <p className="text-xl md:text-2xl font-bold text-slate-900">{employees.length}</p>
            </div>
          </div>
          <div className="rounded-xl bg-white p-5 md:p-6 shadow-sm border border-slate-100 flex items-center space-x-4">
            <div className="p-3 bg-red-50 text-red-600 rounded-lg"><Clock size={24} /></div>
            <div>
              <p className="text-xs md:text-sm font-medium text-slate-500">Total Jam Terlambat</p>
              <p className="text-xl md:text-2xl font-bold text-slate-900">{totalJamKeseluruhan} <span className="text-xs md:text-sm font-normal text-slate-400">jam</span></p>
            </div>
          </div>
          <div className="rounded-xl bg-white p-5 md:p-6 shadow-sm border border-slate-100 flex items-center space-x-4">
            <div className="p-3 bg-orange-50 text-orange-600 rounded-lg"><AlertTriangle size={24} /></div>
            <div>
              <p className="text-xs md:text-sm font-medium text-slate-500">Rata-rata / Karyawan</p>
              <p className="text-xl md:text-2xl font-bold text-slate-900">{rataRataPerKaryawan} <span className="text-xs md:text-sm font-normal text-slate-400">jam/thn</span></p>
            </div>
          </div>
          <div className="rounded-xl bg-white p-5 md:p-6 shadow-sm border border-slate-100 flex items-center space-x-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-lg"><Calendar size={24} /></div>
            <div>
              <p className="text-xs md:text-sm font-medium text-slate-500">Bulan Tertinggi</p>
              <p className="text-lg md:text-xl font-bold text-slate-900">{bulanTertinggi}</p>
            </div>
          </div>
        </div>

        {/* Chart Section */}
        <div className="rounded-xl bg-white p-5 md:p-6 shadow-sm border border-slate-100 overflow-hidden">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900">Top 10 Karyawan Terlambat Tertinggi</h2>
          </div>
          <div className="h-[350px] md:h-[400px] w-full">
            {top10Employees.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={top10Employees} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 12 }} width={90} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value) => [`${value} Jam`, 'Total Keterlambatan']} />
                  <Bar dataKey="totalHours" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-slate-400 flex-col space-y-2"><AlertTriangle size={32} className="opacity-50" /><p>Belum ada data karyawan.</p></div>
            )}
          </div>
        </div>

        {/* Tabel Data Section (Adaptif) */}
        <div className="rounded-xl bg-white shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-5 md:p-6 border-b border-slate-100 bg-white">
            <div className="flex items-center space-x-2">
              <Users className="text-blue-600" size={24} />
              <h2 className="text-lg font-bold text-slate-900">Daftar Seluruh Data Keterlambatan</h2>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 min-w-[700px]">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-medium w-16">No.</th>
                  <th className="px-6 py-4 font-medium">NID / ID</th>
                  <th className="px-6 py-4 font-medium">Profil Karyawan</th>
                  <th className="px-6 py-4 font-medium text-center">Total Keterlambatan</th>
                  <th className="px-6 py-4 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allEmployeesSorted.length > 0 ? (
                  allEmployeesSorted.map((emp, index) => (
                    <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-slate-500 font-medium">{index + 1}</td>
                      <td className="px-6 py-4 font-mono text-slate-500">{emp.nid || emp.id}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <img src={emp.avatar} alt={emp.name} className="h-10 w-10 rounded-full bg-slate-200 flex-shrink-0" />
                          <div className="font-semibold text-slate-900 whitespace-nowrap">{emp.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex items-center px-3 py-1 rounded-full bg-amber-50 text-amber-700 font-bold">{emp.totalHours} Jam</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button 
                          onClick={() => handleEdit(emp)} 
                          className="inline-flex items-center justify-center text-blue-600 hover:text-blue-900 bg-blue-50 p-2 rounded-lg mr-2 transition-colors"
                          title="Edit Data"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => setItemToDelete(emp)} 
                          className="inline-flex items-center justify-center text-red-600 hover:text-red-900 bg-red-50 p-2 rounded-lg transition-colors"
                          title="Hapus Data"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-400">Tidak ada data.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Tambah / Edit Data */}
      {showAddModal && (
        <div className="fixed inset-0 z-[50] flex items-center justify-center bg-slate-900/60 p-4 md:p-6 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 md:px-6 py-4 bg-slate-50 flex-shrink-0">
              <h3 className="text-lg font-bold text-slate-900">
                {editingId ? 'Edit Data Karyawan' : 'Tambah Data Karyawan Baru'}
              </h3>
              <button onClick={resetForm} className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="overflow-y-auto p-5 md:p-6 flex-grow">
              <form id="employee-form" onSubmit={handleSaveEmployee} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">NID Karyawan</label>
                    <input type="text" required value={newEmpNid} onChange={handleNidChange} placeholder="Contoh: 12345678" className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap Karyawan</label>
                    <input type="text" required value={newEmpName} onChange={handleNameChange} placeholder="Contoh: Budi Santoso" className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <h4 className="text-sm font-semibold text-slate-800 mb-4">Input Jam Keterlambatan per Bulan</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                    {BULAN.map((bulan, idx) => (
                      <div key={bulan} className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <label className="block text-sm font-bold text-slate-700 mb-2">{bulan}</label>
                        <div className="flex space-x-2">
                          <div className="flex-1">
                            <label className="block text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1">Jam</label>
                            <input type="number" min="0" value={newEmpData[idx].hours} onChange={(e) => handleMonthChange(idx, 'hours', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                          </div>
                          <div className="flex-1">
                            <label className="block text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1">Menit</label>
                            <input type="number" min="0" max="59" value={newEmpData[idx].minutes} onChange={(e) => handleMonthChange(idx, 'minutes', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </form>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-center justify-end sm:space-x-3 border-t border-slate-100 bg-slate-50 px-5 md:px-6 py-4 flex-shrink-0 gap-3 sm:gap-0">
              <button type="button" onClick={resetForm} className="w-full sm:w-auto px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-colors">
                Batal
              </button>
              <button type="submit" form="employee-form" className="w-full sm:w-auto inline-flex justify-center items-center space-x-2 px-5 py-2.5 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm">
                <Save size={16} />
                <span>{editingId ? 'Simpan Perubahan' : 'Simpan Data'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus */}
      {itemToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm md:max-w-md rounded-2xl bg-white p-6 shadow-2xl text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-4">
              <AlertCircle size={32} className="text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Hapus Data Karyawan?</h3>
            <p className="text-slate-500 mb-6 text-sm md:text-base">
              Anda yakin ingin menghapus data keterlambatan untuk <strong className="text-slate-800">{itemToDelete.name}</strong>? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-3">
              <button
                onClick={() => setItemToDelete(null)}
                className="w-full sm:w-auto px-6 py-2.5 rounded-lg text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={executeDelete}
                className="w-full sm:w-auto px-6 py-2.5 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}