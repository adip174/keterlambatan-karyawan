import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Clock, AlertTriangle, Users, Calendar, Trophy, Plus, LogOut, X, Save, Lock } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth'; // CustomToken dihapus
import { getFirestore, collection, onSnapshot, doc, setDoc } from 'firebase/firestore';

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];

// BACA KONFIGURASI DARI FILE .env LOKAL
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "dashboard-karyawan-app"; // Nama unik aplikasi Anda

export default function App() {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState(false);

  const [employees, setEmployees] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);

  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpNid, setNewEmpNid] = useState('');
  const [newEmpData, setNewEmpData] = useState(Array.from({ length: 12 }, () => ({ hours: '', minutes: '' })));

  // --- Firebase Auth ---
  useEffect(() => {
    // Di PC Lokal, kita langsung login anonim agar bisa akses Firestore
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Gagal login anonim", error);
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

  // --- Handler Login baca dari .env ---
  const handleLogin = (e) => {
    e.preventDefault();
    if (passwordInput === import.meta.env.VITE_ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setLoginError(false);
      setPasswordInput('');
    } else {
      setLoginError(true);
    }
  };

  const handleLogout = () => setIsAuthenticated(false);

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    if (!newEmpName.trim() || !newEmpNid.trim() || !user) return;

    const processedMonthlyData = newEmpData.map(data => {
      const h = Number(data.hours) || 0;
      const m = Number(data.minutes) || 0;
      return Number((h + (m / 60)).toFixed(2));
    });

    const totalHours = Number(processedMonthlyData.reduce((acc, val) => acc + val, 0).toFixed(2));
    const newId = `EMP-${Date.now()}`;
    
    const newEmployee = {
      id: newId,
      nid: newEmpNid,
      name: newEmpName,
      monthlyData: processedMonthlyData,
      totalHours: totalHours,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${newEmpName}&backgroundColor=1e293b,334155,475569&textColor=f8fafc`
    };

    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'employees', newId);
      await setDoc(docRef, newEmployee);
    } catch (error) {
      console.error("Gagal menyimpan data ke database: ", error);
    }
    
    setNewEmpName('');
    setNewEmpNid('');
    setNewEmpData(Array.from({ length: 12 }, () => ({ hours: '', minutes: '' })));
    setShowAddModal(false);
  };

  const handleMonthChange = (index, field, value) => {
    const newData = [...newEmpData];
    newData[index] = { ...newData[index], [field]: value };
    setNewEmpData(newData);
  };

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

  // Render Layar Login
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 font-sans text-slate-800">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl border border-slate-100">
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
            <button type="submit" className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700">
              Masuk ke Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Render Dashboard
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-800 relative">
      <div className="mx-auto max-w-6xl space-y-8">
        
        <header className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Dashboard Kedisiplinan</h1>
            <p className="text-slate-500 mt-1">Laporan Akumulasi Keterlambatan Karyawan</p>
          </div>
          <div className="flex items-center space-x-3">
            <button onClick={() => setShowAddModal(true)} className="inline-flex items-center space-x-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              <Plus size={18} /><span>Tambah Data</span>
            </button>
            <button onClick={handleLogout} className="inline-flex items-center space-x-2 rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300">
              <LogOut size={18} /><span>Keluar</span>
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-100 flex items-center space-x-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><Users size={24} /></div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Karyawan</p>
              <p className="text-2xl font-bold text-slate-900">{employees.length}</p>
            </div>
          </div>
          <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-100 flex items-center space-x-4">
            <div className="p-3 bg-red-50 text-red-600 rounded-lg"><Clock size={24} /></div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Jam Terlambat</p>
              <p className="text-2xl font-bold text-slate-900">{totalJamKeseluruhan} <span className="text-sm font-normal text-slate-400">jam</span></p>
            </div>
          </div>
          <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-100 flex items-center space-x-4">
            <div className="p-3 bg-orange-50 text-orange-600 rounded-lg"><AlertTriangle size={24} /></div>
            <div>
              <p className="text-sm font-medium text-slate-500">Rata-rata / Karyawan</p>
              <p className="text-2xl font-bold text-slate-900">{rataRataPerKaryawan} <span className="text-sm font-normal text-slate-400">jam/thn</span></p>
            </div>
          </div>
          <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-100 flex items-center space-x-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-lg"><Calendar size={24} /></div>
            <div>
              <p className="text-sm font-medium text-slate-500">Bulan Tertinggi</p>
              <p className="text-xl font-bold text-slate-900">{bulanTertinggi}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-100">
          <div className="mb-6"><h2 className="text-lg font-bold text-slate-900">Top 10 Karyawan Terlambat Tertinggi</h2></div>
          <div className="h-[400px] w-full">
            {top10Employees.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={top10Employees} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 12 }} width={100} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value) => [`${value} Jam`, 'Total Keterlambatan']} />
                  <Bar dataKey="totalHours" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-slate-400 flex-col space-y-2"><AlertTriangle size={32} className="opacity-50" /><p>Belum ada data karyawan.</p></div>
            )}
          </div>
        </div>

        <div className="rounded-xl bg-white shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-white">
            <div className="flex items-center space-x-2"><Users className="text-blue-600" size={24} /><h2 className="text-lg font-bold text-slate-900">Daftar Seluruh Data Keterlambatan</h2></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-medium">No.</th>
                  <th className="px-6 py-4 font-medium">NID / ID</th>
                  <th className="px-6 py-4 font-medium">Profil Karyawan</th>
                  <th className="px-6 py-4 font-medium text-center">Total Keterlambatan</th>
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
                          <img src={emp.avatar} alt={emp.name} className="h-10 w-10 rounded-full bg-slate-200" />
                          <div className="font-semibold text-slate-900">{emp.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex items-center px-3 py-1 rounded-full bg-amber-50 text-amber-700 font-bold">{emp.totalHours} Jam</div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="4" className="px-6 py-8 text-center text-slate-400">Tidak ada data.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900">Tambah Data Karyawan Baru</h3>
              <button onClick={() => setShowAddModal(false)}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
            </div>
            
            <div className="overflow-y-auto p-6">
              <form id="add-employee-form" onSubmit={handleAddEmployee} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">NID Karyawan</label>
                    <input type="text" required value={newEmpNid} onChange={(e) => setNewEmpNid(e.target.value)} className="w-full rounded-lg border border-slate-300 px-4 py-2 outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap Karyawan</label>
                    <input type="text" required value={newEmpName} onChange={(e) => setNewEmpName(e.target.value)} className="w-full rounded-lg border border-slate-300 px-4 py-2 outline-none focus:border-blue-500" />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <h4 className="text-sm font-semibold text-slate-800 mb-4">Input Jam Keterlambatan</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {BULAN.map((bulan, idx) => (
                      <div key={bulan} className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <label className="block text-sm font-bold text-slate-700 mb-2">{bulan}</label>
                        <div className="flex space-x-2">
                          <div className="flex-1">
                            <label className="block text-[10px] uppercase font-semibold text-slate-500 mb-1">Jam</label>
                            <input type="number" min="0" value={newEmpData[idx].hours} onChange={(e) => handleMonthChange(idx, 'hours', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white" />
                          </div>
                          <div className="flex-1">
                            <label className="block text-[10px] uppercase font-semibold text-slate-500 mb-1">Menit</label>
                            <input type="number" min="0" max="59" value={newEmpData[idx].minutes} onChange={(e) => handleMonthChange(idx, 'minutes', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </form>
            </div>

            <div className="flex items-center justify-end space-x-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-200">Batal</button>
              <button type="submit" form="add-employee-form" className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700"><Save size={16} /><span>Simpan Data</span></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
