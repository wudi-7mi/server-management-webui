import { useEffect, useState } from "react";
import ModelCard from "./ModelCard.jsx";

function ModelView() {
  const [models, setModels] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortKey, setSortKey] = useState("name"); // 'name' | 'size'
  const [sortOrder, setSortOrder] = useState("asc"); // 'asc' | 'desc'
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch("http://10.71.149.184:3001/api/models")
      .then(res => res.json())
      .then(setModels);

    fetch("http://10.71.149.184:3001/api/stats")
      .then(res => res.json())
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  // debounce search input
  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const filtered = models
    .filter(m => m.name.toLowerCase().includes(debouncedSearch.toLowerCase()))
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") {
        cmp = a.name.localeCompare(b.name, "zh-Hans-CN");
      } else {
        const sa = a.sizeBytes ?? 0;
        const sb = b.sizeBytes ?? 0;
        cmp = sa - sb;
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });

  const toggleOrder = () => setSortOrder(prev => (prev === "asc" ? "desc" : "asc"));

  const btnClass = "rounded-lg border border-neutral-200 bg-gradient-to-b from-white to-neutral-50/80 px-3 py-2 text-sm text-neutral-800 shadow-sm hover:from-white hover:to-neutral-100 active:scale-[0.99]";

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4 tracking-tight">模型目录</h2>

      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between mb-4">
        <div className="w-full max-w-xl">
          <input
            type="text"
            placeholder="搜索模型..."
            className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none shadow-sm"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            className="rounded-lg border border-neutral-200 bg-gradient-to-b from-white to-neutral-50/80 px-3 py-2 text-sm text-neutral-800 shadow-sm focus:outline-none"
            value={sortKey}
            onChange={e => setSortKey(e.target.value)}
          >
            <option value="name">按名称</option>
            <option value="size">按大小</option>
          </select>
          <button
            onClick={toggleOrder}
            className={btnClass}
            aria-label="切换排序顺序"
          >
            {sortOrder === "asc" ? "升序" : "降序"}
          </button>
        </div>
      </div>

      {stats && (
        <div className="mb-4 text-sm text-neutral-600 text-center sm:text-left">
          <span className="mr-4">现有模型总大小：{stats.total}</span>
          <span>模型目录剩余空间：{stats.free}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4">
        {filtered.map(m => (
          <ModelCard key={m.name} model={m} />
        ))}
      </div>
    </div>
  );
}

export default ModelView;
