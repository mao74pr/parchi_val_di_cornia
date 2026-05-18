import { Routes, Route, NavLink } from "react-router-dom";
import Upload from "./pages/Upload";
import History from "./pages/History";
import Detail from "./pages/Detail";

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-green-700 text-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-8">
          <span className="font-bold text-lg">Parchi Val di Cornia — Determine</span>
          <nav className="flex gap-6 text-sm font-medium">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                isActive ? "underline underline-offset-4" : "hover:underline"
              }
            >
              Upload
            </NavLink>
            <NavLink
              to="/storico"
              className={({ isActive }) =>
                isActive ? "underline underline-offset-4" : "hover:underline"
              }
            >
              Storico
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<Upload />} />
          <Route path="/storico" element={<History />} />
          <Route path="/determina/:id" element={<Detail />} />
        </Routes>
      </main>
    </div>
  );
}
