import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { extractDetermina } from "../api/client";

interface FileResult {
  filename: string;
  status: "processing" | "ok" | "error";
  id?: string;
  data?: Record<string, unknown>;
  error?: string;
}

export default function Upload() {
  const [results, setResults] = useState<FileResult[]>([]);
  const [dragging, setDragging] = useState(false);
  const navigate = useNavigate();

  const processFiles = useCallback(async (files: File[]) => {
    const pdfs = files.filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (!pdfs.length) return;

    const initial: FileResult[] = pdfs.map((f) => ({
      filename: f.name,
      status: "processing",
    }));
    setResults((prev) => [...initial, ...prev]);

    for (const file of pdfs) {
      try {
        const res = await extractDetermina(file);
        setResults((prev) =>
          prev.map((r) =>
            r.filename === file.name && r.status === "processing"
              ? { ...r, status: "ok", id: res.id, data: res.data }
              : r
          )
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Errore sconosciuto";
        setResults((prev) =>
          prev.map((r) =>
            r.filename === file.name && r.status === "processing"
              ? { ...r, status: "error", error: msg }
              : r
          )
        );
      }
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      processFiles(Array.from(e.dataTransfer.files));
    },
    [processFiles]
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-800">Carica Determine</h1>

      <div
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
          dragging ? "border-green-500 bg-green-50" : "border-gray-300 hover:border-green-400"
        }`}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <p className="text-gray-500 text-lg">
          Trascina uno o più PDF qui, oppure <span className="text-green-600 font-medium">clicca per selezionare</span>
        </p>
        <p className="text-sm text-gray-400 mt-2">Solo file PDF</p>
        <input
          id="file-input"
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={(e) => processFiles(Array.from(e.target.files ?? []))}
        />
      </div>

      {results.length > 0 && (
        <div className="space-y-3">
          {results.map((r, i) => (
            <div
              key={i}
              className={`rounded-lg border p-4 ${
                r.status === "ok"
                  ? "border-green-300 bg-green-50"
                  : r.status === "error"
                  ? "border-red-300 bg-red-50"
                  : "border-yellow-300 bg-yellow-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-700">{r.filename}</span>
                <div className="flex items-center gap-3">
                  {r.status === "processing" && (
                    <span className="text-yellow-600 text-sm animate-pulse">Elaborazione...</span>
                  )}
                  {r.status === "ok" && (
                    <>
                      <span className="text-green-600 text-sm font-medium">✓ Estratto</span>
                      <button
                        onClick={() => navigate(`/determina/${r.id}`)}
                        className="text-sm text-green-700 underline"
                      >
                        Apri
                      </button>
                    </>
                  )}
                  {r.status === "error" && (
                    <span className="text-red-600 text-sm">{r.error}</span>
                  )}
                </div>
              </div>
              {r.status === "ok" && r.data && (
                <details className="mt-3">
                  <summary className="text-sm text-gray-500 cursor-pointer">Anteprima JSON</summary>
                  <pre className="mt-2 text-xs bg-white rounded border p-3 overflow-auto max-h-64">
                    {JSON.stringify(r.data, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))}
          <button
            onClick={() => navigate("/storico")}
            className="mt-2 text-sm text-green-700 underline"
          >
            Vai allo storico →
          </button>
        </div>
      )}
    </div>
  );
}
