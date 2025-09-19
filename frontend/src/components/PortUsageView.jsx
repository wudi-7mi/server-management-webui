import { useEffect, useState } from "react";
import { RefreshCw, AlertCircle, CheckCircle, Clock, Search, Filter } from "lucide-react";

function PortUsageView() {
  const [ports, setPorts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [ipVersion, setIpVersion] = useState("ipv4"); // 'all', 'ipv4', 'ipv6'
  const [statusFilter, setStatusFilter] = useState("all"); // 'all', 'LISTENING', 'ESTABLISHED', etc.
  const [userFilter, setUserFilter] = useState("all"); // 'all', specific user

  const fetchPorts = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("http://10.71.149.184:3001/api/ports");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setPorts(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPorts();
  }, []);

  // debounce search input
  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const formatBytes = (bytes) => {
    if (!Number.isFinite(bytes) || bytes < 0) return "未知";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let i = 0;
    let n = bytes;
    while (n >= 1024 && i < units.length - 1) {
      n = n / 1024;
      i++;
    }
    return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)}${units[i]}`;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "LISTENING":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "ESTABLISHED":
        return <CheckCircle className="w-4 h-4 text-blue-500" />;
      case "TIME_WAIT":
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "LISTENING":
        return "bg-green-100 text-green-800";
      case "ESTABLISHED":
        return "bg-blue-100 text-blue-800";
      case "TIME_WAIT":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // 过滤端口数据
  const filteredPorts = ports.filter(port => {
    // 搜索过滤
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      const matchesSearch = 
        port.localAddress.toLowerCase().includes(searchLower) ||
        port.remoteAddress.toLowerCase().includes(searchLower) ||
        port.protocol.toLowerCase().includes(searchLower) ||
        (port.process && port.process.toLowerCase().includes(searchLower)) ||
        (port.user && port.user.toLowerCase().includes(searchLower)) ||
        port.pid?.toString().includes(searchLower);
      
      if (!matchesSearch) return false;
    }

    // IP版本过滤
    if (ipVersion !== "all") {
      if (ipVersion === "ipv4") {
        if (port.ipVersion !== "IPv4") return false;
      } else if (ipVersion === "ipv6") {
        if (port.ipVersion !== "IPv6") return false;
      }
    }

    // 状态过滤
    if (statusFilter !== "all") {
      if (port.status !== statusFilter) return false;
    }

    // 用户过滤
    if (userFilter !== "all") {
      if (port.user !== userFilter) return false;
    }

    return true;
  });

  // 获取所有唯一的状态和用户用于筛选器
  const uniqueStatuses = [...new Set(ports.map(port => port.status))].sort();
  const uniqueUsers = [...new Set(ports.map(port => port.user).filter(Boolean))].sort();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold tracking-tight">端口占用查看</h2>
        <button
          onClick={fetchPorts}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? '刷新中...' : '刷新'}
        </button>
      </div>

      {lastUpdated && (
        <div className="mb-4 text-sm text-neutral-600">
          最后更新: {lastUpdated.toLocaleString('zh-CN')}
        </div>
      )}

      {/* 搜索和筛选控件 */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* 搜索框 */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="搜索端口、地址、进程、用户..."
              className="w-full pl-10 pr-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
          </div>

          {/* 筛选器和统计 */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-neutral-500" />
              <span className="text-sm font-medium text-neutral-700">筛选:</span>
            </div>
            
            {/* IP版本筛选 */}
            <select
              value={ipVersion}
              onChange={e => setIpVersion(e.target.value)}
              className="px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">所有IP版本</option>
              <option value="ipv4">仅IPv4</option>
              <option value="ipv6">仅IPv6</option>
            </select>

            {/* 状态筛选 */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">所有状态</option>
              {uniqueStatuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>

            {/* 用户筛选 */}
            <select
              value={userFilter}
              onChange={e => setUserFilter(e.target.value)}
              className="px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">所有用户</option>
              {uniqueUsers.map(user => (
                <option key={user} value={user}>{user}</option>
              ))}
            </select>

            {/* 结果统计 */}
            <div className="text-sm text-neutral-600 whitespace-nowrap">
              显示 {filteredPorts.length} / {ports.length} 个端口
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">加载失败</span>
          </div>
          <p className="mt-1 text-sm text-red-700">{error}</p>
        </div>
      )}

      {filteredPorts.length === 0 && !loading && !error && (
        <div className="text-center py-12 text-neutral-500">
          {ports.length === 0 ? "暂无端口占用信息" : "没有匹配的端口"}
        </div>
      )}

      {filteredPorts.length > 0 && (
        <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    协议
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    IP版本
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    本地地址
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    远程地址
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    状态
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    用户
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    PID/进程
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    内存使用
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {filteredPorts.map((port, index) => (
                  <tr key={index} className="hover:bg-neutral-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-900">
                      {port.protocol}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        port.ipVersion === 'IPv6' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {port.ipVersion}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                      {port.localAddress}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                      {port.remoteAddress || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(port.status)}`}>
                        {getStatusIcon(port.status)}
                        {port.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                      {port.user ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          {port.user}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                      {port.pid ? (
                        <div>
                          <div className="font-medium">{port.pid}</div>
                          {port.process && (
                            <div className="text-xs text-neutral-500 truncate max-w-32" title={port.process}>
                              {port.process}
                            </div>
                          )}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                      {port.memoryUsage ? formatBytes(port.memoryUsage) : '-'}
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

export default PortUsageView;
