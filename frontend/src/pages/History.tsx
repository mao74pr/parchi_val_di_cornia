import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  listDetermine,
  deleteDetermina,
  exportDetermina,
  exportAll,
  type DeterminaListItem,
} from "../api/client";

export default function History() {
  const [items, setItems] = useState<DeterminaListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const size = 20;

  const load = useCallback(async () => {
    const res = await listDetermine(page, size);
    setItems(res.items);
    setTotal(res.total);
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminare questa determina?")) return;
    await deleteDetermina(id);
    load();
  };

  const totalPages = Math.ceil(total / size);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-800">Storico Determine</h1>
        <div className="flex gap-3">
          {selected.size > 0 && (
            <button
              onClick={() => exportAll(Array.from(selected))}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
            >
              Esporta selezionate ({selected.size})
            </button>
          )}
          <button
            onClick={() => exportAll()}
            className="px-4 py-2 border border-green-600 text-green-700 rounded-lg text-sm hover:bg-green-50"
          >
            Esporta tutto
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-gray-500 text-center py-12">Nessuna determina processata.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
              <tr>
                <th className="px-4 py-3">
                  <input type="checkbox" checked={selected.size === items.length && items.length > 0} onChange={toggleAll} />
                </th>
                <th className="px-4 py-3 text-left">N°</th>
                <th className="px-4 py-3 text-left">Data</th>
                <th className="px-4 py-3 text-left">Fornitore</th>
                <th className="px-4 py-3 text-right">Imponibile</th>
                <th className="px-4 py-3 text-left">Fonte</th>
                <th className="px-4 py-3 text-left">Processata il</th>
                <th className="px-4 py-3 text-center">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">{item.numero ?? "—"}</td>
                  <td className="px-4 py-3">{item.data ?? "—"}</td>
                  <td className="px-4 py-3">{item.fornitore ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {item.imponibile_totale != null
                      ? `€ ${item.imponibile_totale.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      item.source === "upload" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                    }`}>
                      {item.source === "upload" ? "Upload" : "GCS Bulk"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(item.created_at).toLocaleDateString("it-IT")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => navigate(`/determina/${item.id}`)}
                        className="text-green-600 hover:underline"
                      >
                        Dettaglio
                      </button>
                      <button
                        onClick={() => exportDetermina(item.id)}
                        className="text-blue-600 hover:underline"
                      >
                        Export
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-red-500 hover:underline"
                      >
                        Elimina
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 rounded border disabled:opacity-40"
          >
            ←
          </button>
          <span className="px-3 py-1 text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 rounded border disabled:opacity-40"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
