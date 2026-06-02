"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { createClient, type Session, type User } from "@supabase/supabase-js";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey)
  : null;

type Transaction = {
  id: string;
  user_id: string;
  type: "Pemasukan" | "Pengeluaran";
  category: string;
  amount: number;
  date: string;
  description: string | null;
  created_at: string;
};

type MonthlyChartData = {
  key: string;
  bulan: string;
  pemasukan: number;
  pengeluaran: number;
  saldo: number;
};

type CategoryChartData = {
  name: string;
  value: number;
};

const incomeCategories = [
  "Gaji",
  "Bonus",
  "Freelance",
  "Penjualan",
  "Hadiah",
  "Uang dari Keluarga",
  "Tabungan Masuk",
  "Investasi / Dividen",
  "Refund / Pengembalian Dana",
  "Lain-lain",
];

const expenseCategories = [
  "Makan & Minum",
  "Transportasi",
  "Belanja Harian",
  "Tagihan",
  "Pulsa / Internet",
  "Kesehatan",
  "Pendidikan",
  "Hiburan",
  "Cicilan / Hutang",
  "Sewa / Kos",
  "Donasi / Sedekah",
  "Tabungan",
  "Investasi",
  "Darurat",
  "Lain-lain",
];

const pieColors = [
  "#2563eb",
  "#16a34a",
  "#dc2626",
  "#9333ea",
  "#ea580c",
  "#0891b2",
  "#be123c",
  "#4f46e5",
  "#65a30d",
  "#c026d3",
];

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingData, setLoadingData] = useState(false);

  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [type, setType] = useState<"Pemasukan" | "Pengeluaran">("Pengeluaran");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [filterMonth, setFilterMonth] = useState("");

  const categoryOptions =
    type === "Pemasukan" ? incomeCategories : expenseCategories;

  useEffect(() => {
    if (!supabase) {
      setLoadingAuth(false);
      return;
    }

    const initAuth = async () => {
      const { data } = await supabase.auth.getSession();

      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoadingAuth(false);

      if (data.session?.user) {
        fetchTransactions();
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        fetchTransactions();
      } else {
        setTransactions([]);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchTransactions = async () => {
    if (!supabase) return;

    setLoadingData(true);

    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      alert("Gagal mengambil data transaksi: " + error.message);
      setLoadingData(false);
      return;
    }

    const formattedData =
      data?.map((item) => ({
        ...item,
        amount: Number(item.amount),
      })) ?? [];

    setTransactions(formattedData as Transaction[]);
    setLoadingData(false);
  };

  const filteredTransactions = useMemo(() => {
    return filterMonth
      ? transactions.filter((item) => item.date.startsWith(filterMonth))
      : transactions;
  }, [transactions, filterMonth]);

  const formatRupiah = (value: number) => {
    const formattedNumber = new Intl.NumberFormat("id-ID", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

    return `Rp. ${formattedNumber}`;
  };

  const formatCompactRupiah = (value: number) => {
    if (value >= 1_000_000_000) {
      return `Rp ${(value / 1_000_000_000).toFixed(1)} M`;
    }

    if (value >= 1_000_000) {
      return `Rp ${(value / 1_000_000).toFixed(1)} jt`;
    }

    if (value >= 1_000) {
      return `Rp ${(value / 1_000).toFixed(0)} rb`;
    }

    return `Rp ${value}`;
  };

  const formatTanggal = (value: string) => {
    if (!value) return "-";

    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  };

  const formatBulan = (value: string) => {
    if (!value) return "-";

    const [year, month] = value.split("-");
    const dateObj = new Date(Number(year), Number(month) - 1, 1);

    return dateObj.toLocaleDateString("id-ID", {
      month: "short",
      year: "numeric",
    });
  };

  const totalPemasukan = filteredTransactions
    .filter((item) => item.type === "Pemasukan")
    .reduce((total, item) => total + Number(item.amount), 0);

  const totalPengeluaran = filteredTransactions
    .filter((item) => item.type === "Pengeluaran")
    .reduce((total, item) => total + Number(item.amount), 0);

  const saldo = totalPemasukan - totalPengeluaran;

  const monthlyChartData = useMemo<MonthlyChartData[]>(() => {
    const monthlyMap = new Map<
      string,
      {
        key: string;
        bulan: string;
        pemasukan: number;
        pengeluaran: number;
      }
    >();

    transactions.forEach((item) => {
      const monthKey = item.date.slice(0, 7);

      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, {
          key: monthKey,
          bulan: formatBulan(monthKey),
          pemasukan: 0,
          pengeluaran: 0,
        });
      }

      const currentData = monthlyMap.get(monthKey);

      if (!currentData) return;

      if (item.type === "Pemasukan") {
        currentData.pemasukan += Number(item.amount);
      } else {
        currentData.pengeluaran += Number(item.amount);
      }
    });

    const sortedData = Array.from(monthlyMap.values()).sort((a, b) =>
      a.key.localeCompare(b.key)
    );

    let runningSaldo = 0;

    return sortedData.map((item) => {
      runningSaldo += item.pemasukan - item.pengeluaran;

      return {
        ...item,
        saldo: runningSaldo,
      };
    });
  }, [transactions]);

  const categoryExpenseData = useMemo<CategoryChartData[]>(() => {
    const categoryMap = new Map<string, number>();

    filteredTransactions
      .filter((item) => item.type === "Pengeluaran")
      .forEach((item) => {
        const currentValue = categoryMap.get(item.category) ?? 0;
        categoryMap.set(item.category, currentValue + Number(item.amount));
      });

    return Array.from(categoryMap.entries())
      .map(([name, value]) => ({
        name,
        value,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions]);

  const handleRegister = async () => {
    if (!supabase) {
      alert("Supabase belum terhubung. Periksa environment variable.");
      return;
    }

    if (!name || !email || !password) {
      alert("Nama, email, dan password wajib diisi.");
      return;
    }

    if (password.length < 6) {
      alert("Password minimal 6 karakter.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
      },
    });

    if (error) {
      alert("Gagal daftar akun: " + error.message);
      return;
    }

    if (!data.session) {
      alert(
        "Akun berhasil dibuat. Jika diminta konfirmasi email, cek inbox email terlebih dahulu."
      );
    } else {
      alert("Akun berhasil dibuat dan kamu sudah login.");
    }

    setName("");
    setEmail("");
    setPassword("");
    setIsRegister(false);
  };

  const handleLogin = async () => {
    if (!supabase) {
      alert("Supabase belum terhubung. Periksa environment variable.");
      return;
    }

    if (!email || !password) {
      alert("Email dan password wajib diisi.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("Gagal login: " + error.message);
      return;
    }

    setEmail("");
    setPassword("");
  };

  const handleLogout = async () => {
    if (!supabase) return;

    const confirmLogout = confirm("Yakin ingin logout?");

    if (!confirmLogout) return;

    await supabase.auth.signOut();
    setTransactions([]);
  };

  const handleSubmit = async () => {
    if (!supabase) {
      alert("Supabase belum terhubung. Periksa environment variable.");
      return;
    }

    if (!user) {
      alert("Kamu harus login terlebih dahulu.");
      return;
    }

    if (!category || !amount || !date) {
      alert("Kategori, nominal, dan tanggal wajib diisi.");
      return;
    }

    if (Number(amount) <= 0) {
      alert("Nominal harus lebih dari 0.");
      return;
    }

    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      type,
      category,
      amount: Number(amount),
      date,
      description: description || null,
    });

    if (error) {
      alert("Gagal menyimpan transaksi: " + error.message);
      return;
    }

    setType("Pengeluaran");
    setCategory("");
    setAmount("");
    setDate("");
    setDescription("");

    fetchTransactions();
  };

  const handleDelete = async (id: string) => {
    if (!supabase) return;

    const confirmDelete = confirm("Yakin ingin menghapus transaksi ini?");

    if (!confirmDelete) return;

    const { error } = await supabase.from("transactions").delete().eq("id", id);

    if (error) {
      alert("Gagal menghapus transaksi: " + error.message);
      return;
    }

    fetchTransactions();
  };

  const handleExportExcel = () => {
    if (filteredTransactions.length === 0) {
      alert("Belum ada transaksi untuk diexport.");
      return;
    }

    const dataExcel: Record<string, string | number>[] = filteredTransactions.map(
      (item, index) => ({
        No: index + 1,
        Tanggal: formatTanggal(item.date),
        Jenis: item.type,
        Kategori: item.category,
        Nominal: formatRupiah(Number(item.amount)),
        Keterangan: item.description || "-",
      })
    );

    dataExcel.push({
      No: "",
      Tanggal: "",
      Jenis: "",
      Kategori: "TOTAL PEMASUKAN",
      Nominal: formatRupiah(totalPemasukan),
      Keterangan: "",
    });

    dataExcel.push({
      No: "",
      Tanggal: "",
      Jenis: "",
      Kategori: "TOTAL PENGELUARAN",
      Nominal: formatRupiah(totalPengeluaran),
      Keterangan: "",
    });

    dataExcel.push({
      No: "",
      Tanggal: "",
      Jenis: "",
      Kategori: "SALDO",
      Nominal: formatRupiah(saldo),
      Keterangan: "",
    });

    const worksheet = XLSX.utils.json_to_sheet(dataExcel);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Keuangan");

    const namaFile = filterMonth
      ? `kas-kepiting-${filterMonth}.xlsx`
      : "kas-kepiting.xlsx";

    XLSX.writeFile(workbook, namaFile);
  };

  if (loadingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cyan-200 via-sky-100 to-yellow-100 p-6">
        <div className="rounded-3xl border-4 border-yellow-300 bg-white p-6 text-center shadow-2xl">
          <p className="text-4xl">🦀💰</p>
          <p className="mt-3 font-extrabold text-slate-900">
            Memuat peti harta...
          </p>
        </div>
      </main>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cyan-200 via-sky-100 to-yellow-100 p-6">
        <div className="w-full max-w-lg rounded-3xl border-4 border-yellow-300 bg-white p-6 shadow-2xl">
          <div className="text-5xl">🦀</div>
          <h1 className="mt-3 text-2xl font-extrabold text-red-700">
            Supabase Belum Terhubung
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">
            Periksa file .env.local di project lokal dan Environment Variables di
            Vercel. Pastikan sudah ada NEXT_PUBLIC_SUPABASE_URL dan
            NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
          </p>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cyan-200 via-sky-100 to-yellow-100 px-4 py-8">
        <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border-4 border-yellow-300 bg-sky-100 p-6 shadow-2xl">
          <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-yellow-300 opacity-70"></div>
          <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-cyan-300 opacity-70"></div>

          <div className="relative z-10">
            <div className="mb-5 rounded-3xl border-4 border-yellow-400 bg-gradient-to-r from-yellow-200 via-amber-100 to-cyan-100 p-5 text-center shadow">
              <div className="mb-2 text-5xl">🦀💰</div>
              <h1 className="text-3xl font-extrabold text-red-700">
                Kas Kepiting
              </h1>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-800">
                Jaga pemasukan, pengeluaran, dan saldo seperti menjaga peti harta
                pribadi.
              </p>
            </div>

            <div className="rounded-3xl bg-white/95 p-5 shadow">
              <div className="mb-4 text-center">
                <p className="text-2xl">🪙</p>
                <h2 className="text-xl font-extrabold text-slate-900">
                  {isRegister ? "Daftar Kru Kepiting" : "Masuk ke Peti Harta"}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {isRegister
                    ? "Buat akun untuk mulai mencatat keuanganmu."
                    : "Login untuk membuka rekap keuangan pribadimu."}
                </p>
              </div>

              <div className="space-y-4">
                {isRegister && (
                  <div>
                    <label className="mb-1 block text-sm font-bold text-slate-900">
                      Nama Kru
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Masukkan nama"
                      className="w-full rounded-2xl border-2 border-yellow-400 bg-yellow-50 p-3 font-semibold text-black placeholder:text-gray-500 focus:border-red-500 focus:outline-none"
                    />
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-sm font-bold text-slate-900">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contoh@email.com"
                    className="w-full rounded-2xl border-2 border-yellow-400 bg-yellow-50 p-3 font-semibold text-black placeholder:text-gray-500 focus:border-red-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-bold text-slate-900">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="w-full rounded-2xl border-2 border-yellow-400 bg-yellow-50 p-3 font-semibold text-black placeholder:text-gray-500 focus:border-red-500 focus:outline-none"
                  />
                </div>

                {isRegister ? (
                  <button
                    type="button"
                    onClick={handleRegister}
                    className="w-full rounded-2xl bg-green-600 p-3 font-extrabold text-white shadow hover:bg-green-700"
                  >
                    🪙 Daftar Akun
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleLogin}
                    className="w-full rounded-2xl bg-red-600 p-3 font-extrabold text-white shadow hover:bg-red-700"
                  >
                    🔐 Buka Peti Harta
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsRegister(!isRegister)}
                  className="w-full rounded-2xl bg-yellow-300 p-3 font-extrabold text-yellow-950 shadow hover:bg-yellow-400"
                >
                  {isRegister
                    ? "Sudah punya akun? Login"
                    : "Belum punya akun? Daftar Kru"}
                </button>
              </div>
            </div>

            <p className="mt-5 text-center text-xs font-semibold text-slate-700">
              🦀 Sistem rekap keuangan pribadi dengan data aman per akun.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-gradient-to-br from-cyan-200 via-sky-100 to-yellow-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-6 overflow-hidden rounded-[2rem] border-4 border-yellow-300 bg-gradient-to-r from-cyan-300 via-sky-200 to-yellow-100 p-5 shadow-2xl sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 text-5xl">🦀💰🪙</div>
              <h1 className="text-3xl font-extrabold leading-tight text-red-700 sm:text-4xl">
                Kas Kepiting
              </h1>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-slate-800 sm:text-base">
                Pantau pemasukan, pengeluaran, dan saldo seperti menjaga peti
                harta pribadi.
              </p>
              <p className="mt-2 text-sm font-bold text-slate-900">
                Login sebagai: {user?.email}
              </p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-extrabold text-white shadow-lg hover:bg-red-700"
            >
              Logout dari Peti
            </button>
          </div>
        </div>

        <div className="mb-6 rounded-3xl border-4 border-yellow-300 bg-white/90 p-4 shadow sm:p-5">
          <label className="mb-2 block text-sm font-extrabold text-slate-900">
            🗓️ Rekap Bulan
          </label>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full rounded-2xl border-2 border-yellow-400 bg-yellow-50 p-3 font-bold text-black focus:border-red-500 focus:outline-none sm:w-auto"
            />

            <button
              type="button"
              onClick={() => setFilterMonth("")}
              className="w-full rounded-2xl bg-yellow-300 px-4 py-3 font-extrabold text-yellow-950 shadow hover:bg-yellow-400 sm:w-auto"
            >
              Tampilkan Semua
            </button>

            <button
              type="button"
              onClick={fetchTransactions}
              className="w-full rounded-2xl bg-cyan-600 px-4 py-3 font-extrabold text-white shadow hover:bg-cyan-700 sm:w-auto"
            >
              Refresh Data
            </button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:mb-8 sm:grid-cols-3">
          <div className="rounded-3xl border-4 border-green-300 bg-green-100 p-5 shadow-lg sm:p-6">
            <p className="text-sm font-extrabold text-green-900">
              💵 Total Pemasukan
            </p>
            <h2 className="mt-2 break-words text-xl font-extrabold text-green-700 sm:text-2xl">
              {formatRupiah(totalPemasukan)}
            </h2>
          </div>

          <div className="rounded-3xl border-4 border-red-300 bg-red-100 p-5 shadow-lg sm:p-6">
            <p className="text-sm font-extrabold text-red-900">
              🧾 Total Pengeluaran
            </p>
            <h2 className="mt-2 break-words text-xl font-extrabold text-red-700 sm:text-2xl">
              {formatRupiah(totalPengeluaran)}
            </h2>
          </div>

          <div className="rounded-3xl border-4 border-yellow-400 bg-yellow-100 p-5 shadow-lg sm:p-6">
            <p className="text-sm font-extrabold text-yellow-900">
              🪙 Saldo Peti Harta
            </p>
            <h2
              className={`mt-2 break-words text-xl font-extrabold sm:text-2xl ${
                saldo >= 0 ? "text-blue-700" : "text-red-700"
              }`}
            >
              {formatRupiah(saldo)}
            </h2>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border-4 border-yellow-300 bg-white/90 p-5 shadow-xl sm:p-6">
            <h2 className="mb-4 text-xl font-extrabold text-slate-900">
              📊 Grafik Pemasukan vs Pengeluaran
            </h2>

            {monthlyChartData.length === 0 ? (
              <div className="rounded-2xl bg-yellow-50 p-4 text-sm font-semibold text-slate-800">
                Belum ada data untuk grafik.
              </div>
            ) : (
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="bulan" />
                    <YAxis
                      tickFormatter={(value) =>
                        formatCompactRupiah(Number(value))
                      }
                    />
                    <Tooltip
                      formatter={(value) => formatRupiah(Number(value))}
                    />
                    <Legend />
                    <Bar
                      dataKey="pemasukan"
                      name="Pemasukan"
                      fill="#16a34a"
                    />
                    <Bar
                      dataKey="pengeluaran"
                      name="Pengeluaran"
                      fill="#dc2626"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="rounded-3xl border-4 border-yellow-300 bg-white/90 p-5 shadow-xl sm:p-6">
            <h2 className="mb-4 text-xl font-extrabold text-slate-900">
              📈 Grafik Saldo Akumulatif
            </h2>

            {monthlyChartData.length === 0 ? (
              <div className="rounded-2xl bg-yellow-50 p-4 text-sm font-semibold text-slate-800">
                Belum ada data untuk grafik.
              </div>
            ) : (
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="bulan" />
                    <YAxis
                      tickFormatter={(value) =>
                        formatCompactRupiah(Number(value))
                      }
                    />
                    <Tooltip
                      formatter={(value) => formatRupiah(Number(value))}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="saldo"
                      name="Saldo"
                      stroke="#2563eb"
                      strokeWidth={3}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        <div className="mb-6 rounded-3xl border-4 border-yellow-300 bg-white/90 p-5 shadow-xl sm:p-6">
          <h2 className="mb-4 text-xl font-extrabold text-slate-900">
            🥧 Grafik Pengeluaran per Kategori
          </h2>

          {categoryExpenseData.length === 0 ? (
            <div className="rounded-2xl bg-yellow-50 p-4 text-sm font-semibold text-slate-800">
              Belum ada data pengeluaran untuk grafik kategori.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryExpenseData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={110}
                    >
                      {categoryExpenseData.map((entry, index) => (
                        <Cell
                          key={`cell-${entry.name}`}
                          fill={pieColors[index % pieColors.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => formatRupiah(Number(value))}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-3">
                {categoryExpenseData.map((item, index) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between rounded-2xl border-2 border-yellow-200 bg-yellow-50 p-3 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="h-4 w-4 rounded-full"
                        style={{
                          backgroundColor: pieColors[index % pieColors.length],
                        }}
                      ></span>
                      <p className="font-extrabold text-slate-900">
                        {item.name}
                      </p>
                    </div>

                    <p className="font-extrabold text-red-600">
                      {formatRupiah(item.value)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border-4 border-yellow-300 bg-white/90 p-5 shadow-xl sm:p-6">
            <h2 className="mb-4 text-xl font-extrabold text-slate-900">
              🪙 Tambah Transaksi
            </h2>

            <form className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-extrabold text-slate-900">
                  Jenis Transaksi
                </label>
                <select
                  value={type}
                  onChange={(e) => {
                    setType(e.target.value as "Pemasukan" | "Pengeluaran");
                    setCategory("");
                  }}
                  className="w-full rounded-2xl border-2 border-yellow-400 bg-yellow-50 p-3 font-bold text-black focus:border-red-500 focus:outline-none"
                >
                  <option value="Pemasukan">Pemasukan</option>
                  <option value="Pengeluaran">Pengeluaran</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-extrabold text-slate-900">
                  Kategori
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-2xl border-2 border-yellow-400 bg-yellow-50 p-3 font-bold text-black focus:border-red-500 focus:outline-none"
                >
                  <option value="">Pilih kategori</option>
                  {categoryOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-extrabold text-slate-900">
                  Nominal
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Contoh: 300000"
                  className="w-full rounded-2xl border-2 border-yellow-400 bg-yellow-50 p-3 font-bold text-black placeholder:text-gray-500 focus:border-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-extrabold text-slate-900">
                  Tanggal
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-2xl border-2 border-yellow-400 bg-yellow-50 p-3 font-bold text-black focus:border-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-extrabold text-slate-900">
                  Keterangan
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Catatan tambahan"
                  rows={3}
                  className="w-full rounded-2xl border-2 border-yellow-400 bg-yellow-50 p-3 font-bold text-black placeholder:text-gray-500 focus:border-red-500 focus:outline-none"
                ></textarea>
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                className="w-full rounded-2xl bg-red-600 p-3 font-extrabold text-white shadow hover:bg-red-700"
              >
                Simpan ke Peti Harta
              </button>
            </form>
          </div>

          <div className="rounded-3xl border-4 border-yellow-300 bg-white/90 p-5 shadow-xl sm:p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-extrabold text-slate-900">
                📜 Daftar Transaksi
              </h2>

              <button
                type="button"
                onClick={handleExportExcel}
                className="w-full rounded-2xl bg-green-600 px-4 py-3 text-sm font-extrabold text-white shadow hover:bg-green-700 sm:w-auto"
              >
                Export Harta ke Excel
              </button>
            </div>

            {loadingData ? (
              <div className="rounded-2xl bg-yellow-50 p-4 text-sm font-bold text-slate-800">
                Memuat data transaksi...
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[650px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b bg-yellow-300 text-left text-yellow-950">
                        <th className="p-3">Tanggal</th>
                        <th className="p-3">Kategori</th>
                        <th className="p-3">Jenis</th>
                        <th className="p-3">Nominal</th>
                        <th className="p-3">Aksi</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredTransactions.length === 0 ? (
                        <tr>
                          <td className="p-3 font-semibold text-slate-800" colSpan={5}>
                            Belum ada transaksi.
                          </td>
                        </tr>
                      ) : (
                        filteredTransactions.map((item) => (
                          <tr key={item.id} className="border-b border-yellow-200">
                            <td className="p-3 font-bold text-black">
                              {formatTanggal(item.date)}
                            </td>

                            <td className="p-3 text-black">
                              <div className="font-bold text-black">
                                {item.category}
                              </div>

                              {item.description && (
                                <div className="text-xs font-semibold text-slate-600">
                                  {item.description}
                                </div>
                              )}
                            </td>

                            <td
                              className={`p-3 font-extrabold ${
                                item.type === "Pemasukan"
                                  ? "text-green-700"
                                  : "text-red-700"
                              }`}
                            >
                              {item.type}
                            </td>

                            <td className="p-3 font-bold text-black">
                              {formatRupiah(Number(item.amount))}
                            </td>

                            <td className="p-3">
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="rounded-xl bg-red-100 px-3 py-1 font-bold text-red-600 hover:bg-red-300"
                              >
                                Hapus
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-3 md:hidden">
                  {filteredTransactions.length === 0 ? (
                    <div className="rounded-2xl bg-yellow-50 p-4 text-sm font-semibold text-slate-800">
                      Belum ada transaksi.
                    </div>
                  ) : (
                    filteredTransactions.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border-2 border-yellow-300 bg-yellow-50 p-4 shadow-sm"
                      >
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-extrabold text-slate-900">
                              {item.category}
                            </p>
                            <p className="text-xs font-semibold text-slate-600">
                              {formatTanggal(item.date)}
                            </p>
                          </div>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-extrabold ${
                              item.type === "Pemasukan"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {item.type}
                          </span>
                        </div>

                        <p className="text-lg font-extrabold text-slate-900">
                          {formatRupiah(Number(item.amount))}
                        </p>

                        {item.description && (
                          <p className="mt-1 text-sm font-semibold text-slate-700">
                            {item.description}
                          </p>
                        )}

                        <button
                          onClick={() => handleDelete(item.id)}
                          className="mt-3 w-full rounded-2xl bg-red-100 px-3 py-2 text-sm font-extrabold text-red-600 hover:bg-red-300"
                        >
                          Hapus
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {filterMonth && (
              <p className="mt-4 text-sm font-semibold text-slate-700">
                Menampilkan rekap bulan:{" "}
                <span className="font-extrabold">{filterMonth}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}