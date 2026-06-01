"use client";

import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { createClient, type Session, type User } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

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

  useEffect(() => {
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

  const filteredTransactions = filterMonth
    ? transactions.filter((item) => item.date.startsWith(filterMonth))
    : transactions;

  const formatRupiah = (value: number) => {
    const formattedNumber = new Intl.NumberFormat("id-ID", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

    return `Rp. ${formattedNumber}`;
  };

  const formatTanggal = (value: string) => {
    if (!value) return "-";

    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  };

  const totalPemasukan = filteredTransactions
    .filter((item) => item.type === "Pemasukan")
    .reduce((total, item) => total + Number(item.amount), 0);

  const totalPengeluaran = filteredTransactions
    .filter((item) => item.type === "Pengeluaran")
    .reduce((total, item) => total + Number(item.amount), 0);

  const saldo = totalPemasukan - totalPengeluaran;

  const handleRegister = async () => {
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
    const confirmLogout = confirm("Yakin ingin logout?");

    if (!confirmLogout) return;

    await supabase.auth.signOut();
    setTransactions([]);
  };

  const handleSubmit = async () => {
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
      ? `rekap-keuangan-${filterMonth}.xlsx`
      : "rekap-keuangan-pribadi.xlsx";

    XLSX.writeFile(workbook, namaFile);
  };

  if (loadingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-rose-50 p-6">
        <div className="rounded-xl bg-sky-100 p-6 text-center shadow">
          <p className="font-semibold text-gray-900">Memuat aplikasi...</p>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-rose-50 px-4 py-8">
        <div className="w-full max-w-md rounded-2xl bg-sky-100 p-6 shadow">
          <h1 className="text-2xl font-bold text-gray-900">
            Rekap Keuangan Pribadi
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            Masuk atau daftar akun untuk menyimpan data keuangan secara online.
          </p>

          <div className="mt-6 space-y-4">
            {isRegister && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900">
                  Nama
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Masukkan nama"
                  className="w-full rounded-lg border border-blue-400 bg-white p-3 font-medium text-black placeholder:text-gray-600 focus:border-blue-700 focus:outline-none"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contoh@email.com"
                className="w-full rounded-lg border border-blue-400 bg-white p-3 font-medium text-black placeholder:text-gray-600 focus:border-blue-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full rounded-lg border border-blue-400 bg-white p-3 font-medium text-black placeholder:text-gray-600 focus:border-blue-700 focus:outline-none"
              />
            </div>

            {isRegister ? (
              <button
                type="button"
                onClick={handleRegister}
                className="w-full rounded-lg bg-green-600 p-3 font-semibold text-white hover:bg-green-700"
              >
                Daftar Akun
              </button>
            ) : (
              <button
                type="button"
                onClick={handleLogin}
                className="w-full rounded-lg bg-blue-600 p-3 font-semibold text-white hover:bg-blue-700"
              >
                Login
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsRegister(!isRegister)}
              className="w-full rounded-lg bg-red-300 p-3 font-semibold text-red-950 hover:bg-red-400"
            >
              {isRegister
                ? "Sudah punya akun? Login"
                : "Belum punya akun? Daftar"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-rose-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold leading-tight text-gray-900 sm:text-3xl">
              Rekap Keuangan Pribadi
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-700 sm:text-base">
              Catat pemasukan, pengeluaran, dan pantau saldo keuanganmu dengan mudah.
            </p>
            <p className="mt-2 text-sm font-medium text-gray-800">
              Login sebagai: {user?.email}
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-700"
          >
            Logout
          </button>
        </div>

        <div className="mb-6 rounded-xl bg-sky-100 p-4 shadow sm:p-5">
          <label className="mb-2 block text-sm font-semibold text-gray-900">
            Rekap Bulan
          </label>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full rounded-lg border border-blue-400 bg-white p-3 font-medium text-black focus:border-blue-700 focus:outline-none sm:w-auto"
            />

            <button
              type="button"
              onClick={() => setFilterMonth("")}
              className="w-full rounded-lg bg-red-300 px-4 py-3 font-semibold text-red-950 hover:bg-red-400 sm:w-auto"
            >
              Tampilkan Semua
            </button>

            <button
              type="button"
              onClick={fetchTransactions}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 sm:w-auto"
            >
              Refresh Data
            </button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:mb-8 sm:grid-cols-3">
          <div className="rounded-xl bg-sky-100 p-5 shadow sm:p-6">
            <p className="text-sm text-gray-700">Total Pemasukan</p>
            <h2 className="mt-2 break-words text-xl font-bold text-green-600 sm:text-2xl">
              {formatRupiah(totalPemasukan)}
            </h2>
          </div>

          <div className="rounded-xl bg-sky-100 p-5 shadow sm:p-6">
            <p className="text-sm text-gray-700">Total Pengeluaran</p>
            <h2 className="mt-2 break-words text-xl font-bold text-red-600 sm:text-2xl">
              {formatRupiah(totalPengeluaran)}
            </h2>
          </div>

          <div className="rounded-xl bg-sky-100 p-5 shadow sm:p-6">
            <p className="text-sm text-gray-700">Saldo Saat Ini</p>
            <h2
              className={`mt-2 break-words text-xl font-bold sm:text-2xl ${
                saldo >= 0 ? "text-blue-600" : "text-red-600"
              }`}
            >
              {formatRupiah(saldo)}
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-xl bg-sky-100 p-5 shadow sm:p-6">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">
              Tambah Transaksi
            </h2>

            <form className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900">
                  Jenis Transaksi
                </label>
                <select
                  value={type}
                  onChange={(e) =>
                    setType(e.target.value as "Pemasukan" | "Pengeluaran")
                  }
                  className="w-full rounded-lg border border-blue-400 bg-white p-3 font-medium text-black focus:border-blue-700 focus:outline-none"
                >
                  <option value="Pemasukan">Pemasukan</option>
                  <option value="Pengeluaran">Pengeluaran</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900">
                  Kategori
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Contoh: Makan, Gaji, Transportasi"
                  className="w-full rounded-lg border border-blue-400 bg-white p-3 font-medium text-black placeholder:text-gray-600 focus:border-blue-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900">
                  Nominal
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Contoh: 300000"
                  className="w-full rounded-lg border border-blue-400 bg-white p-3 font-medium text-black placeholder:text-gray-600 focus:border-blue-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900">
                  Tanggal
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-blue-400 bg-white p-3 font-medium text-black focus:border-blue-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900">
                  Keterangan
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Catatan tambahan"
                  rows={3}
                  className="w-full rounded-lg border border-blue-400 bg-white p-3 font-medium text-black placeholder:text-gray-600 focus:border-blue-700 focus:outline-none"
                ></textarea>
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                className="w-full rounded-lg bg-blue-600 p-3 font-semibold text-white hover:bg-blue-700"
              >
                Simpan Transaksi
              </button>
            </form>
          </div>

          <div className="rounded-xl bg-sky-100 p-5 shadow sm:p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                Daftar Transaksi
              </h2>

              <button
                type="button"
                onClick={handleExportExcel}
                className="w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 sm:w-auto"
              >
                Export Excel
              </button>
            </div>

            {loadingData ? (
              <div className="rounded-lg bg-white p-4 text-sm font-semibold text-gray-800">
                Memuat data transaksi...
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[650px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b bg-red-300 text-left text-red-950">
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
                          <td className="p-3 text-gray-800" colSpan={5}>
                            Belum ada transaksi.
                          </td>
                        </tr>
                      ) : (
                        filteredTransactions.map((item) => (
                          <tr key={item.id} className="border-b border-sky-200">
                            <td className="p-3 font-semibold text-black">
                              {formatTanggal(item.date)}
                            </td>

                            <td className="p-3 text-black">
                              <div className="font-semibold text-black">
                                {item.category}
                              </div>

                              {item.description && (
                                <div className="text-xs text-gray-700">
                                  {item.description}
                                </div>
                              )}
                            </td>

                            <td
                              className={`p-3 font-semibold ${
                                item.type === "Pemasukan"
                                  ? "text-green-700"
                                  : "text-red-700"
                              }`}
                            >
                              {item.type}
                            </td>

                            <td className="p-3 font-semibold text-black">
                              {formatRupiah(Number(item.amount))}
                            </td>

                            <td className="p-3">
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="rounded-lg bg-red-100 px-3 py-1 text-red-600 hover:bg-red-400"
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
                    <div className="rounded-lg bg-white p-4 text-sm text-gray-800">
                      Belum ada transaksi.
                    </div>
                  ) : (
                    filteredTransactions.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl bg-white p-4 shadow-sm"
                      >
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {item.category}
                            </p>
                            <p className="text-xs text-gray-600">
                              {formatTanggal(item.date)}
                            </p>
                          </div>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              item.type === "Pemasukan"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {item.type}
                          </span>
                        </div>

                        <p className="text-lg font-bold text-gray-900">
                          {formatRupiah(Number(item.amount))}
                        </p>

                        {item.description && (
                          <p className="mt-1 text-sm text-gray-700">
                            {item.description}
                          </p>
                        )}

                        <button
                          onClick={() => handleDelete(item.id)}
                          className="mt-3 w-full rounded-lg bg-red-100 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-300"
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
              <p className="mt-4 text-sm text-gray-700">
                Menampilkan rekap bulan:{" "}
                <span className="font-semibold">{filterMonth}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}