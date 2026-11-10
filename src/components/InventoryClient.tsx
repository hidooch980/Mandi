"use client";

import { useState } from "react";
import { Boxes, Plus, Save, Warehouse as WarehouseIcon } from "lucide-react";
import { formatNumberFa, formatUsd } from "@/lib/jalali";
import { FUEL_LABELS } from "@/lib/pricing-engine";
import type { FuelType, MarketConfig, Product, Warehouse } from "@/lib/types";

export function InventoryClient({
  initialProducts,
  initialWarehouses,
  initialConfig,
}: {
  initialProducts: Product[];
  initialWarehouses: Warehouse[];
  initialConfig: MarketConfig;
}) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [warehouses, setWarehouses] = useState<Warehouse[]>(initialWarehouses);
  const [gasolinePrice, setGasolinePrice] = useState<string>(
    String(initialConfig.publishedGasolineBarrelToman)
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddWarehouse, setShowAddWarehouse] = useState(false);

  // Add Product form
  const [pName, setPName] = useState("");
  const [pFuelType, setPFuelType] = useState<FuelType>("DIESEL");
  const [pBarrelType, setPBarrelType] = useState("بشکه فلزی نو ۲۲۰ لیتر");
  const [pLiters, setPLiters] = useState("220");
  const [pDensity, setPDensity] = useState("0.835");
  const [pWarehouseId, setPWarehouseId] = useState(
    String(initialWarehouses[0]?.id ?? 1)
  );
  const [pStock, setPStock] = useState("100");
  const [pMode, setPMode] = useState<"AUTO_DISCOVERY" | "MANUAL">("AUTO_DISCOVERY");
  const [pManualPrice, setPManualPrice] = useState("11500000");

  // Add Warehouse form
  const [wName, setWName] = useState("");
  const [wCity, setWCity] = useState("تهران");
  const [wAddress, setWAddress] = useState("");
  const [wEmpty, setWEmpty] = useState("200");
  const [wManager, setWManager] = useState("");

  async function saveGasolineRate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publishedGasolineBarrelToman: Number(gasolinePrice),
        }),
      });
      if (res.ok) {
        const prodRes = await fetch("/api/products");
        const prodData = await prodRes.json();
        if (prodData.ok) setProducts(prodData.products);
        setMsg("نرخ فروش روز بنزین بشکه‌ای بروزرسانی شد.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function updateProductField(
    id: number,
    patch: Partial<{
      stockBarrels: number;
      pricingMode: "AUTO_DISCOVERY" | "MANUAL";
      manualPricePerBarrelToman: number;
      isActive: boolean;
    }>
  ) {
    setBusy(true);
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (data.ok) setProducts(data.products);
    } finally {
      setBusy(false);
    }
  }

  async function updateEmptyBarrels(id: number, emptyBarrels: number) {
    setBusy(true);
    try {
      const res = await fetch("/api/warehouses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, emptyBarrels }),
      });
      const data = await res.json();
      if (data.ok) setWarehouses(data.warehouses);
    } finally {
      setBusy(false);
    }
  }

  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: pName,
          fuelType: pFuelType,
          barrelType: pBarrelType,
          barrelLiters: Number(pLiters),
          density: Number(pDensity),
          warehouseId: Number(pWarehouseId),
          stockBarrels: Number(pStock),
          pricingMode: pMode,
          manualPricePerBarrelToman: Number(pManualPrice),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setProducts(data.products);
        setShowAddProduct(false);
        setPName("");
        setMsg("کد محصول بشکه‌ای جدید اضافه شد.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleAddWarehouse(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: wName,
          city: wCity,
          address: wAddress,
          emptyBarrels: Number(wEmpty),
          managerName: wManager,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setWarehouses(data.warehouses);
        setShowAddWarehouse(false);
        setWName("");
        setMsg("انبار جدید ثبت شد.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Boxes className="w-6 h-6 text-amber-600" />
            <span>انبار و محصولات بشکه‌ای بنزین و گازوئیل</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            موجودی بشکه‌های بنزین و گازوئیل، اتصال گازوئیل به موتور کشف قیمت و تنظیم نرخ بنزین
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowAddProduct(true)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            افزودن کد بنزین / گازوئیل
          </button>
          <button
            type="button"
            onClick={() => setShowAddWarehouse(true)}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <WarehouseIcon className="w-4 h-4" />
            تعریف انبار جدید
          </button>
        </div>
      </div>

      {msg && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 font-medium">
          {msg}
        </div>
      )}

      {/* Gasoline Reference Rate Quick Bar */}
      <form
        onSubmit={saveGasolineRate}
        className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div className="text-xs sm:text-sm text-amber-950">
          <strong>نرخ فروش روز بنزین بشکه‌ای (۲۲۰ لیتری):</strong>{" "}
          <span className="text-amber-800 text-xs">
            (گازوئیل از موتور کشف قیمت چندنفره تغذیه می‌شود و نرخ بنزین از اینجا تنظیم می‌گردد)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            dir="ltr"
            value={gasolinePrice}
            onChange={(e) => setGasolinePrice(e.target.value)}
            className="w-44 rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-bold tabular-nums"
          />
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            ثبت نرخ بنزین
          </button>
        </div>
      </form>

      {/* Warehouses Strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {warehouses.map((w) => (
          <div
            key={w.id}
            className="rounded-2xl bg-white border border-slate-200 p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-sm text-slate-900">{w.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {w.city} • مسئول: {w.managerName || "نامشخص"}
                </p>
              </div>
              <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-800 text-[11px] font-bold">
                بشکه خالی: {formatNumberFa(w.emptyBarrels)}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">{w.address}</p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={busy}
                onClick={() => updateEmptyBarrels(w.id, w.emptyBarrels + 20)}
                className="flex-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold cursor-pointer"
              >
                +۲۰ بشکه خالی
              </button>
              <button
                type="button"
                disabled={busy || w.emptyBarrels < 20}
                onClick={() =>
                  updateEmptyBarrels(w.id, Math.max(0, w.emptyBarrels - 20))
                }
                className="flex-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold cursor-pointer"
              >
                -۲۰ بشکه خالی
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Products Table */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 sm:p-5 border-b border-slate-100">
          <h2 className="font-bold text-slate-900 text-sm sm:text-base">
            موجودی بنزین و گازوئیل بشکه‌ای
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">نوع سوخت و نام کد</th>
                <th className="py-3 px-3">انبار</th>
                <th className="py-3 px-3">موجودی (بشکه / لیتر)</th>
                <th className="py-3 px-3">رزرو فروش</th>
                <th className="py-3 px-3">منبع نرخ</th>
                <th className="py-3 px-3">نرخ فروش فعال</th>
                <th className="py-3 px-3">عملیات موجودی</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => {
                const avail = Math.max(p.stockBarrels - p.reservedBarrels, 0);
                return (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            p.fuelType === "DIESEL"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {FUEL_LABELS[p.fuelType]}
                        </span>
                        <span className="font-bold text-slate-900">{p.name}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {p.sku} • {formatNumberFa(p.barrelLiters)} لیتر (چگالی {p.density})
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="font-semibold text-slate-800">{p.warehouseName}</div>
                      <div className="text-[11px] text-slate-500">{p.warehouseCity}</div>
                    </td>
                    <td className="py-3.5 px-3 tabular-nums">
                      <div className="font-extrabold text-emerald-700">
                        {formatNumberFa(avail)} قابل فروش
                      </div>
                      <div className="text-[11px] text-slate-500">
                        کل: {formatNumberFa(p.stockBarrels)} ({formatNumberFa(p.stockBarrels * p.barrelLiters)} لیتر)
                      </div>
                    </td>
                    <td className="py-3.5 px-3 tabular-nums text-amber-700 font-bold">
                      {formatNumberFa(p.reservedBarrels)} بشکه
                    </td>
                    <td className="py-3.5 px-3">
                      <select
                        value={p.pricingMode}
                        onChange={(e) =>
                          updateProductField(p.id, {
                            pricingMode: e.target.value as "AUTO_DISCOVERY" | "MANUAL",
                          })
                        }
                        className="rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-semibold bg-white"
                      >
                        <option value="AUTO_DISCOVERY">
                          {p.fuelType === "DIESEL"
                            ? "متصل به کشف قیمت گازوئیل"
                            : "متصل به نرخ روز بنزین"}
                        </option>
                        <option value="MANUAL">نرخ دستی ثابت</option>
                      </select>
                    </td>
                    <td className="py-3.5 px-3 tabular-nums">
                      <div className="font-extrabold text-slate-900">
                        {formatNumberFa(p.effectivePricePerBarrelToman)} ت
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {formatNumberFa(p.effectivePricePerLiterToman)} ت/لیتر •{" "}
                        {formatUsd(p.effectivePricePerBarrelUsd)}
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            updateProductField(p.id, {
                              stockBarrels: p.stockBarrels + 10,
                            })
                          }
                          className="px-2 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold cursor-pointer"
                        >
                          +۱۰
                        </button>
                        <button
                          type="button"
                          disabled={busy || p.stockBarrels < 10}
                          onClick={() =>
                            updateProductField(p.id, {
                              stockBarrels: Math.max(0, p.stockBarrels - 10),
                            })
                          }
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                        >
                          -۱۰
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            updateProductField(p.id, { isActive: !p.isActive })
                          }
                          className={`px-2 py-1 rounded-lg font-bold cursor-pointer ${
                            p.isActive
                              ? "bg-sky-100 text-sky-800"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {p.isActive ? "فعال" : "متوقف"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Product Modal */}
      {showAddProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleAddProduct}
            className="w-full max-w-lg rounded-2xl bg-white p-5 space-y-4 shadow-2xl"
          >
            <h3 className="font-bold text-base text-slate-900">
              افزودن کد جدید بنزین یا گازوئیل بشکه‌ای
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">نام محصول *</label>
                <input
                  required
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                  placeholder="مثلاً بنزین بشکه فلزی ۲۲۰ لیتری"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">نوع فرآورده</label>
                <select
                  value={pFuelType}
                  onChange={(e) => {
                    const next = e.target.value as FuelType;
                    setPFuelType(next);
                    setPDensity(next === "GASOLINE" ? "0.745" : "0.835");
                  }}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                >
                  <option value="DIESEL">گازوئیل</option>
                  <option value="GASOLINE">بنزین</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">انبار محل نگهداری</label>
                <select
                  value={pWarehouseId}
                  onChange={(e) => setPWarehouseId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.city})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">نوع بشکه</label>
                <input
                  value={pBarrelType}
                  onChange={(e) => setPBarrelType(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">حجم بشکه (لیتر)</label>
                <input
                  type="number"
                  dir="ltr"
                  value={pLiters}
                  onChange={(e) => setPLiters(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">چگالی</label>
                <input
                  type="number"
                  step="0.005"
                  dir="ltr"
                  value={pDensity}
                  onChange={(e) => setPDensity(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">موجودی اولیه (بشکه)</label>
                <input
                  type="number"
                  dir="ltr"
                  value={pStock}
                  onChange={(e) => setPStock(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">مدل قیمت</label>
                <select
                  value={pMode}
                  onChange={(e) =>
                    setPMode(e.target.value as "AUTO_DISCOVERY" | "MANUAL")
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                >
                  <option value="AUTO_DISCOVERY">خودکار از نرخ روز / کشف قیمت</option>
                  <option value="MANUAL">دستی</option>
                </select>
              </div>
              {pMode === "MANUAL" && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">قیمت دستی هر بشکه</label>
                  <input
                    type="number"
                    dir="ltr"
                    value={pManualPrice}
                    onChange={(e) => setPManualPrice(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddProduct(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer"
              >
                ثبت محصول
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Warehouse Modal */}
      {showAddWarehouse && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleAddWarehouse}
            className="w-full max-w-md rounded-2xl bg-white p-5 space-y-4 shadow-2xl"
          >
            <h3 className="font-bold text-base text-slate-900">تعریف انبار جدید</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">نام انبار *</label>
                <input
                  required
                  value={wName}
                  onChange={(e) => setWName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">شهر *</label>
                  <input
                    required
                    value={wCity}
                    onChange={(e) => setWCity(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">بشکه خالی موجود</label>
                  <input
                    type="number"
                    dir="ltr"
                    value={wEmpty}
                    onChange={(e) => setWEmpty(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">نام انباردار</label>
                <input
                  value={wManager}
                  onChange={(e) => setWManager(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">آدرس</label>
                <input
                  value={wAddress}
                  onChange={(e) => setWAddress(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddWarehouse(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
              >
                ذخیره انبار
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
