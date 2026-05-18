import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getDetermina, updateDetermina, exportDetermina } from "../api/client";

export default function Detail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    getDetermina(id).then((res) => setData(res.data));
  }, [id]);

  if (!data) return <p className="text-gray-400 text-center py-12">Caricamento...</p>;

  const det = (data.determina as Record<string, unknown>) ?? {};
  const fornitore = (data.fornitore as Record<string, unknown>) ?? {};
  const importo = (data.importo as Record<string, unknown>) ?? {};
  const imputazioni = (data.imputazione as Record<string, unknown>[]) ?? [];
  const ruoli = (data.ruoli as Record<string, unknown>) ?? {};

  const updateField = (path: string[], value: unknown) => {
    setData((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      let obj: Record<string, unknown> = next;
      for (let i = 0; i < path.length - 1; i++) {
        obj = obj[path[i]] as Record<string, unknown>;
      }
      obj[path[path.length - 1]] = value;
      return next;
    });
    setSaved(false);
  };

  const updateImputazione = (index: number, key: string, value: unknown) => {
    setData((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      (next.imputazione as Record<string, unknown>[])[index][key] = value;
      return next;
    });
    setSaved(false);
  };

  const addImputazione = () => {
    setData((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      (next.imputazione as Record<string, unknown>[]).push({
        centro_di_costo: null,
        voce_di_spesa: null,
        importo: null,
      });
      return next;
    });
  };

  const removeImputazione = (index: number) => {
    setData((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      (next.imputazione as Record<string, unknown>[]).splice(index, 1);
      return next;
    });
  };

  const handleSave = async () => {
    if (!id || !data) return;
    setSaving(true);
    await updateDetermina(id, data);
    setSaving(false);
    setSaved(true);
  };

  const Field = ({
    label,
    path,
    value,
    type = "text",
  }: {
    label: string;
    path: string[];
    value: unknown;
    type?: string;
  }) => (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={value == null ? "" : String(value)}
        onChange={(e) => updateField(path, e.target.value || null)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
      />
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate("/storico")} className="text-sm text-gray-500 hover:text-gray-700">
          ← Storico
        </button>
        <h1 className="text-2xl font-semibold text-gray-800">
          Determina {det.numero as string ?? "—"}
        </h1>
      </div>

      {/* Determina */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-700">Dati Determina</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Numero" path={["determina", "numero"]} value={det.numero} />
          <Field label="Data" path={["determina", "data"]} value={det.data} />
          <Field label="CIG" path={["determina", "cig"]} value={det.cig} />
          <Field label="CUP" path={["determina", "cup"]} value={det.cup} />
        </div>
        <Field label="Oggetto" path={["determina", "oggetto"]} value={det.oggetto} />
        <Field label="Base normativa" path={["base_normativa"]} value={data.base_normativa} />
      </section>

      {/* Fornitore */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-700">Fornitore</h2>
        <Field label="Nome" path={["fornitore", "nome"]} value={fornitore.nome} />
      </section>

      {/* Importo */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-700">Importo</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Imponibile totale (€)" path={["importo", "imponibile_totale"]} value={importo.imponibile_totale} type="number" />
          <Field label="Importo annuale (€)" path={["importo", "importo_annuale"]} value={importo.importo_annuale} type="number" />
          <Field label="Numero anni" path={["importo", "numero_anni"]} value={importo.numero_anni} type="number" />
          <div className="flex items-center gap-2 pt-5">
            <input
              type="checkbox"
              id="pluriennale"
              checked={!!importo.pluriennale}
              onChange={(e) => updateField(["importo", "pluriennale"], e.target.checked)}
            />
            <label htmlFor="pluriennale" className="text-sm text-gray-600">Pluriennale</label>
          </div>
        </div>
      </section>

      {/* Imputazioni */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-700">Imputazioni</h2>
          <button
            onClick={addImputazione}
            className="text-sm text-green-600 hover:underline"
          >
            + Aggiungi
          </button>
        </div>
        {imputazioni.map((imp, i) => (
          <div key={i} className="grid grid-cols-3 gap-3 items-end border border-gray-100 rounded-lg p-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Centro di costo</label>
              <input
                value={imp.centro_di_costo == null ? "" : String(imp.centro_di_costo)}
                onChange={(e) => updateImputazione(i, "centro_di_costo", e.target.value || null)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Voce di spesa</label>
              <input
                value={imp.voce_di_spesa == null ? "" : String(imp.voce_di_spesa)}
                onChange={(e) => updateImputazione(i, "voce_di_spesa", e.target.value || null)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Importo (€)</label>
                <input
                  type="number"
                  value={imp.importo == null ? "" : String(imp.importo)}
                  onChange={(e) => updateImputazione(i, "importo", e.target.value ? Number(e.target.value) : null)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <button
                onClick={() => removeImputazione(i)}
                className="text-red-400 hover:text-red-600 pb-2"
                title="Rimuovi"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </section>

      {/* Ruoli */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-700">Ruoli</h2>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(ruoli).map(([key, val]) => (
            <Field
              key={key}
              label={key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              path={["ruoli", key]}
              value={val}
            />
          ))}
        </div>
      </section>

      {/* Azioni */}
      <div className="flex gap-4 pb-8">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {saving ? "Salvataggio..." : "Salva modifiche"}
        </button>
        {saved && <span className="text-green-600 text-sm self-center">✓ Salvato</span>}
        <button
          onClick={() => id && exportDetermina(id)}
          className="px-6 py-2 border border-green-600 text-green-700 rounded-lg hover:bg-green-50"
        >
          Esporta JSON
        </button>
      </div>
    </div>
  );
}
