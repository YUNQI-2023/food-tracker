"use client";

import { useState, useRef } from "react";
import { Upload, FileText, ClipboardPaste, Check, X, PlusCircle, AlertTriangle } from "lucide-react";
import { CATEGORIES } from "@/lib/categories";

interface ParsedItem {
  rawName: string;
  parsedName: string;
  category: string;
  quantity: number;
  unit: string;
  totalWeightGrams: number | null;
  totalVolumeMl: number | null;
  purchaseDate: string | null;
  expiryDate?: string | null;
  confidence: number;
  needsReview: boolean;
  isFood: boolean;
}

type Tab = "csv" | "text" | "pdf" | "manual";

export default function ImportsPage() {
  const [tab, setTab] = useState<Tab>("pdf");
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [importId, setImportId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [status, setStatus] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Manual entry form state
  const [manual, setManual] = useState({
    name: "",
    brand: "",
    category: "other",
    quantity: 1,
    unit: "unit",
    totalWeightGrams: "" as string,
    totalVolumeMl: "" as string,
    purchaseDate: new Date().toISOString().slice(0, 10),
    expiryDate: "",
    storageLocation: "",
    storageType: "" as string,
    notes: "",
    isFood: true,
  });

  async function handleFileUpload(sourceType: "csv" | "pdf") {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatus("");
    const formData = new FormData();
    formData.append("sourceType", sourceType);
    formData.append("file", file);

    try {
      const res = await fetch("/api/imports", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        setItems(data.items);
        setImportId(data.importId);
        setStatus(`Parsed ${data.items.length} items`);
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch {
      setStatus("Upload failed");
    }
    setLoading(false);
  }

  async function handleTextParse() {
    if (!textInput.trim()) return;

    setLoading(true);
    setStatus("");
    const formData = new FormData();
    formData.append("sourceType", "text");
    formData.append("text", textInput);

    try {
      const res = await fetch("/api/imports", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        setItems(data.items);
        setImportId(data.importId);
        setStatus(`Parsed ${data.items.length} items`);
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch {
      setStatus("Parse failed");
    }
    setLoading(false);
  }

  async function handleConfirmImport() {
    if (!importId || items.length === 0) return;

    setLoading(true);
    try {
      const res = await fetch("/api/imports/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importId, items }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus(`Imported ${data.created} items to inventory!`);
        setItems([]);
        setImportId(null);
      } else {
        setStatus(`Error: ${JSON.stringify(data.error)}`);
      }
    } catch {
      setStatus("Import failed");
    }
    setLoading(false);
  }

  async function handleManualSubmit() {
    if (!manual.name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/inventory/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...manual,
          totalWeightGrams: manual.totalWeightGrams ? parseFloat(manual.totalWeightGrams) : null,
          totalVolumeMl: manual.totalVolumeMl ? parseFloat(manual.totalVolumeMl) : null,
          expiryDate: manual.expiryDate || null,
          storageType: manual.storageType || undefined,
        }),
      });
      if (res.ok) {
        setStatus(`Added "${manual.name}" to inventory!`);
        setManual({
          name: "", brand: "", category: "other", quantity: 1, unit: "unit",
          totalWeightGrams: "", totalVolumeMl: "",
          purchaseDate: new Date().toISOString().slice(0, 10),
          expiryDate: "", storageLocation: "", storageType: "", notes: "", isFood: true,
        });
      } else {
        const data = await res.json();
        setStatus(`Error: ${data.error}`);
      }
    } catch {
      setStatus("Add failed");
    }
    setLoading(false);
  }

  function updateItem(index: number, field: keyof ParsedItem, value: string | number | boolean | null) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const allCategories = [...CATEGORIES];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Import Purchases</h1>

      {/* Tab selection */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id: "pdf" as Tab, label: "PDF Upload", icon: FileText },
          { id: "csv" as Tab, label: "CSV Upload", icon: Upload },
          { id: "text" as Tab, label: "Paste Text", icon: ClipboardPaste },
          { id: "manual" as Tab, label: "Manual Entry", icon: PlusCircle },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
              tab === id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Input area */}
      <div className="bg-card rounded-lg border border-border p-4">
        {(tab === "csv" || tab === "pdf") && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                Upload {tab.toUpperCase()} file
              </label>
              <input
                ref={fileRef}
                type="file"
                accept={tab === "csv" ? ".csv" : ".pdf"}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {tab === "csv"
                ? "Expected columns: Product/Item, Qty/Quantity, Size/Weight, Date, Price"
                : "Upload a text-based PDF (e.g. Walmart order details)"}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleFileUpload(tab)}
                disabled={loading}
                className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? "Parsing..." : "Parse File"}
              </button>
              {tab === "csv" && (
                <a
                  href="/samples/walmart-sample.csv"
                  download
                  className="text-sm text-primary hover:underline flex items-center gap-1 px-4 py-2"
                >
                  Download sample CSV
                </a>
              )}
            </div>
          </div>
        )}

        {tab === "text" && (
          <div className="space-y-3">
            <label className="block text-sm font-medium mb-1">
              Paste purchase text
            </label>
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              rows={8}
              placeholder={`Paste Walmart receipt or order text here...\n\nExample:\nGreat Value White Eggs 12 ct $3.48\n2% Reduced Fat Milk 1 gal $3.52\nBoneless Chicken Breast 2 lb $6.98`}
              className="w-full border border-border rounded-lg p-3 text-sm bg-background resize-y"
            />
            <button
              onClick={handleTextParse}
              disabled={loading}
              className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Parsing..." : "Parse Text"}
            </button>
          </div>
        )}

        {tab === "manual" && (
          <div className="space-y-4">
            <h3 className="font-medium text-sm">Add Item Manually</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="text-xs text-muted-foreground">Name *</label>
                <input
                  value={manual.name}
                  onChange={(e) => setManual({ ...manual, name: e.target.value })}
                  className="w-full border border-border rounded px-3 py-2 mt-1 bg-background text-sm"
                  placeholder="e.g. Fresh Blueberries"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Brand</label>
                <input
                  value={manual.brand}
                  onChange={(e) => setManual({ ...manual, brand: e.target.value })}
                  className="w-full border border-border rounded px-3 py-2 mt-1 bg-background text-sm"
                  placeholder="e.g. Great Value"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Category</label>
                <select
                  value={manual.category}
                  onChange={(e) => setManual({ ...manual, category: e.target.value })}
                  className="w-full border border-border rounded px-3 py-2 mt-1 bg-background text-sm"
                >
                  {allCategories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Quantity</label>
                <input
                  type="number"
                  value={manual.quantity}
                  onChange={(e) => setManual({ ...manual, quantity: parseFloat(e.target.value) || 1 })}
                  min={0}
                  step={0.1}
                  className="w-full border border-border rounded px-3 py-2 mt-1 bg-background text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Unit</label>
                <input
                  value={manual.unit}
                  onChange={(e) => setManual({ ...manual, unit: e.target.value })}
                  className="w-full border border-border rounded px-3 py-2 mt-1 bg-background text-sm"
                  placeholder="unit, lb, oz, bag..."
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Weight (g)</label>
                <input
                  type="number"
                  value={manual.totalWeightGrams}
                  onChange={(e) => setManual({ ...manual, totalWeightGrams: e.target.value })}
                  className="w-full border border-border rounded px-3 py-2 mt-1 bg-background text-sm"
                  placeholder="optional"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Volume (ml)</label>
                <input
                  type="number"
                  value={manual.totalVolumeMl}
                  onChange={(e) => setManual({ ...manual, totalVolumeMl: e.target.value })}
                  className="w-full border border-border rounded px-3 py-2 mt-1 bg-background text-sm"
                  placeholder="optional"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Purchase Date</label>
                <input
                  type="date"
                  value={manual.purchaseDate}
                  onChange={(e) => setManual({ ...manual, purchaseDate: e.target.value })}
                  className="w-full border border-border rounded px-3 py-2 mt-1 bg-background text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Expiry Date</label>
                <input
                  type="date"
                  value={manual.expiryDate}
                  onChange={(e) => setManual({ ...manual, expiryDate: e.target.value })}
                  className="w-full border border-border rounded px-3 py-2 mt-1 bg-background text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Storage Type</label>
                <select
                  value={manual.storageType}
                  onChange={(e) => setManual({ ...manual, storageType: e.target.value })}
                  className="w-full border border-border rounded px-3 py-2 mt-1 bg-background text-sm"
                >
                  <option value="">Auto-detect</option>
                  <option value="refrigerated">🧊 Refrigerated</option>
                  <option value="frozen">❄️ Frozen</option>
                  <option value="pantry">🏠 Pantry</option>
                  <option value="room_temp">🌡️ Room Temp</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Storage Location</label>
                <input
                  value={manual.storageLocation}
                  onChange={(e) => setManual({ ...manual, storageLocation: e.target.value })}
                  className="w-full border border-border rounded px-3 py-2 mt-1 bg-background text-sm"
                  placeholder="e.g. top shelf, door..."
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Notes</label>
                <input
                  value={manual.notes}
                  onChange={(e) => setManual({ ...manual, notes: e.target.value })}
                  className="w-full border border-border rounded px-3 py-2 mt-1 bg-background text-sm"
                  placeholder="optional"
                />
              </div>
              <div className="col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={manual.isFood}
                    onChange={(e) => setManual({ ...manual, isFood: e.target.checked })}
                    className="rounded"
                  />
                  This is a food item
                </label>
              </div>
            </div>
            <button
              onClick={handleManualSubmit}
              disabled={loading || !manual.name.trim()}
              className="bg-green-600 text-white px-6 py-2 rounded text-sm hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? "Adding..." : "Add to Inventory"}
            </button>
          </div>
        )}
      </div>

      {/* Status */}
      {status && (
        <div
          className={`p-3 rounded-lg text-sm ${
            status.startsWith("Error") || status.endsWith("failed")
              ? "bg-red-50 text-red-700"
              : "bg-green-50 text-green-700"
          }`}
        >
          {status}
        </div>
      )}

      {/* Review Table */}
      {items.length > 0 && (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold">Review Parsed Items ({items.length})</h2>
            <button
              onClick={handleConfirmImport}
              disabled={loading}
              className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Check className="h-4 w-4" />
              Confirm Import
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary">
                <tr>
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Category</th>
                  <th className="text-left p-3">Qty</th>
                  <th className="text-left p-3">Unit</th>
                  <th className="text-left p-3">Weight(g)</th>
                  <th className="text-left p-3">Vol(ml)</th>
                  <th className="text-left p-3">Purchase Date</th>
                  <th className="text-left p-3">Expiry Date</th>
                  <th className="text-left p-3">Food?</th>
                  <th className="text-left p-3">Confidence</th>
                  <th className="text-left p-3"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr
                    key={i}
                    className={`border-t border-border ${
                      !item.isFood ? "bg-gray-50 opacity-60" : item.needsReview ? "bg-amber-50/50" : ""
                    }`}
                  >
                    <td className="p-3">
                      <input
                        value={item.parsedName}
                        onChange={(e) => updateItem(i, "parsedName", e.target.value)}
                        className="border border-border rounded px-2 py-1 w-full text-sm bg-background"
                      />
                      {item.rawName !== item.parsedName && (
                        <div className="text-xs text-muted-foreground mt-0.5 truncate" title={item.rawName}>
                          raw: {item.rawName}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <select
                        value={item.category}
                        onChange={(e) => updateItem(i, "category", e.target.value)}
                        className="border border-border rounded px-2 py-1 text-sm bg-background"
                      >
                        {allCategories.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(i, "quantity", parseFloat(e.target.value) || 1)}
                        className="border border-border rounded px-2 py-1 w-16 text-sm bg-background"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        value={item.unit}
                        onChange={(e) => updateItem(i, "unit", e.target.value)}
                        className="border border-border rounded px-2 py-1 w-16 text-sm bg-background"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="number"
                        value={item.totalWeightGrams ?? ""}
                        onChange={(e) =>
                          updateItem(i, "totalWeightGrams", e.target.value ? parseFloat(e.target.value) : null)
                        }
                        className="border border-border rounded px-2 py-1 w-20 text-sm bg-background"
                        placeholder="—"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="number"
                        value={item.totalVolumeMl ?? ""}
                        onChange={(e) =>
                          updateItem(i, "totalVolumeMl", e.target.value ? parseFloat(e.target.value) : null)
                        }
                        className="border border-border rounded px-2 py-1 w-20 text-sm bg-background"
                        placeholder="—"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="date"
                        value={item.purchaseDate ?? ""}
                        onChange={(e) => updateItem(i, "purchaseDate", e.target.value || null)}
                        className="border border-border rounded px-2 py-1 text-sm bg-background"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="date"
                        value={item.expiryDate ?? ""}
                        onChange={(e) => updateItem(i, "expiryDate", e.target.value || null)}
                        className="border border-border rounded px-2 py-1 text-sm bg-background"
                        placeholder="optional"
                      />
                    </td>
                    <td className="p-3">
                      {!item.isFood ? (
                        <span className="flex items-center gap-1 text-xs text-amber-600">
                          <AlertTriangle className="h-3 w-3" />
                          Non-food
                        </span>
                      ) : (
                        <span className="text-xs text-green-600">✓ Food</span>
                      )}
                      <button
                        onClick={() => updateItem(i, "isFood", !item.isFood)}
                        className="text-xs text-primary hover:underline block"
                      >
                        toggle
                      </button>
                    </td>
                    <td className="p-3">
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          item.confidence >= 0.7
                            ? "bg-green-100 text-green-700"
                            : item.confidence >= 0.5
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {Math.round(item.confidence * 100)}%
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => removeItem(i)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
