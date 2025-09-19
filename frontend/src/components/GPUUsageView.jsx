import { useEffect, useState } from "react";
import { AlertCircle, Thermometer, Zap, HardDrive, BarChart3, Copy, Check } from "lucide-react";

function GPUUsageView() {
  const [gpus, setGpus] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showProcesses, setShowProcesses] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState(null);

  const fetchGPUs = async () => {
    setLoading(true);
    setError(null);
    try {
      const [gpuResponse, processesResponse] = await Promise.all([
        fetch("http://10.71.149.184:3001/api/gpu"),
        fetch("http://10.71.149.184:3001/api/gpu/processes")
      ]);
      
      if (!gpuResponse.ok) {
        throw new Error(`HTTP error! status: ${gpuResponse.status}`);
      }
      
      const gpuData = await gpuResponse.json();
      setGpus(gpuData);
      
      // 进程信息可能失败，但不影响GPU信息显示
      if (processesResponse.ok) {
        const processesData = await processesResponse.json();
        setProcesses(processesData);
      }
      
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGPUs();
    
    // 设置自动刷新，每秒更新一次
    const interval = setInterval(fetchGPUs, 1000);
    
    return () => clearInterval(interval);
  }, []);

  const copyCommand = async (command, index) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      // 降级到传统方法
      const textarea = document.createElement('textarea');
      textarea.value = command;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  };

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

  const getUtilizationColor = (utilization) => {
    if (utilization === null) return "bg-gray-100 text-gray-800";
    if (utilization < 30) return "bg-green-100 text-green-800";
    if (utilization < 70) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  const getTemperatureColor = (temp) => {
    if (temp === null) return "bg-gray-100 text-gray-800";
    if (temp < 60) return "bg-blue-100 text-blue-800";
    if (temp < 80) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  const getMemoryColor = (memoryUtil) => {
    if (memoryUtil === null) return "bg-gray-100 text-gray-800";
    if (memoryUtil < 50) return "bg-green-100 text-green-800";
    if (memoryUtil < 80) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight">GPU占用查看</h2>
      </div>

      {lastUpdated && (
        <div className="mb-4 text-sm text-neutral-600">
          最后更新: {lastUpdated.toLocaleString('zh-CN')}
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">加载失败</span>
          </div>
          <p className="mt-1 text-sm text-red-700">{error}</p>
        </div>
      )}

      {gpus.length === 0 && !loading && !error && (
        <div className="text-center py-12 text-neutral-500">
          暂无GPU信息
        </div>
      )}

      {gpus.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：GPU卡片 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-neutral-900">GPU状态</h3>
            {gpus.map((gpu) => (
              <div key={gpu.index} className="bg-white rounded-lg border border-neutral-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <h4 className="text-base font-semibold text-neutral-900">
                      GPU {gpu.index}: {gpu.name}
                    </h4>
                  </div>
                  {gpu.status && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {gpu.status}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* GPU利用率 */}
                  <div className="bg-neutral-50 rounded-lg p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <BarChart3 className="w-3 h-3 text-neutral-600" />
                      <span className="text-xs font-medium text-neutral-700">GPU利用率</span>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getUtilizationColor(gpu.gpuUtilization)}`}>
                      {gpu.gpuUtilization !== null ? `${gpu.gpuUtilization}%` : '未知'}
                    </span>
                  </div>

                  {/* 显存使用 */}
                  <div className="bg-neutral-50 rounded-lg p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <HardDrive className="w-3 h-3 text-neutral-600" />
                      <span className="text-xs font-medium text-neutral-700">显存使用</span>
                    </div>
                    <div className="space-y-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getMemoryColor(gpu.memoryUtilization)}`}>
                        {gpu.memoryUtilization !== null ? `${gpu.memoryUtilization}%` : '未知'}
                      </span>
                      {gpu.memoryUsedMB !== null && gpu.memoryTotalMB !== null && (
                        <div className="text-xs text-neutral-600">
                          {gpu.memoryUsedMB}MB / {gpu.memoryTotalMB}MB
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 温度 */}
                  <div className="bg-neutral-50 rounded-lg p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <Thermometer className="w-3 h-3 text-neutral-600" />
                      <span className="text-xs font-medium text-neutral-700">温度</span>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getTemperatureColor(gpu.temperature)}`}>
                      {gpu.temperature !== null ? `${gpu.temperature}°C` : '未知'}
                    </span>
                  </div>

                  {/* 功耗 */}
                  <div className="bg-neutral-50 rounded-lg p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <Zap className="w-3 h-3 text-neutral-600" />
                      <span className="text-xs font-medium text-neutral-700">功耗</span>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      {gpu.powerDraw !== null ? `${gpu.powerDraw}W` : '未知'}
                    </span>
                  </div>
                </div>

                {/* 显存使用进度条 */}
                {gpu.memoryUsedMB !== null && gpu.memoryTotalMB !== null && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-neutral-600 mb-1">
                      <span>显存使用</span>
                      <span>{gpu.memoryUsedMB}MB / {gpu.memoryTotalMB}MB</span>
                    </div>
                    <div className="w-full bg-neutral-200 rounded-full h-1.5">
                      <div 
                        className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${gpu.memoryUtilization}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 右侧：GPU进程信息 */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-neutral-900">GPU进程占用</h3>
              <button
                onClick={() => setShowProcesses(!showProcesses)}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors"
              >
                {showProcesses ? '隐藏进程' : '显示进程'}
              </button>
            </div>
            
            {showProcesses && (
              <>
                {processes.length === 0 ? (
                  <div className="text-center py-8 text-neutral-500 bg-neutral-50 rounded-lg">
                    当前没有GPU进程占用
                  </div>
                ) : (
                  <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full table-fixed">
                        <thead className="bg-neutral-50">
                          <tr>
                            <th className="w-24 px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                              GPU设备
                            </th>
                            <th className="w-20 px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                              PID
                            </th>
                            <th className="w-28 px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                              进程名
                            </th>
                            <th className="w-24 px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                              用户
                            </th>
                            <th className="w-32 px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                              显存占用
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                              命令行
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200">
                          {processes.map((process, index) => {
                            // 根据GPU索引找到对应的GPU设备
                            const gpuDevice = gpus.find(gpu => gpu.index === process.gpuIndex);
                            
                            return (
                              <tr key={index} className="hover:bg-neutral-50">
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-900">
                                  {gpuDevice ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                      GPU {gpuDevice.index}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-neutral-500 font-mono">
                                      {process.gpuUuid.substring(0, 8)}...
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-900">
                                  {process.pid}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-900">
                                  {process.processName}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-900">
                                  {process.user ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                      {process.user}
                                    </span>
                                  ) : (
                                    <span className="text-neutral-500">-</span>
                                  )}
                                </td>
                                <td className="px-6 py-3 whitespace-nowrap text-sm text-neutral-900">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    {process.usedMemoryMB}MB
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-neutral-900">
                                  <div className="flex items-center gap-1">
                                    <div className="flex-1 min-w-0 overflow-hidden">
                                      <div className="truncate text-xs" title={process.commandLine}>
                                        {process.commandLine ? (
                                          <span className="text-neutral-600">
                                            {process.commandLine.length > 40 
                                              ? `${process.commandLine.substring(0, 40)}...` 
                                              : process.commandLine}
                                          </span>
                                        ) : (
                                          '-'
                                        )}
                                      </div>
                                    </div>
                                    {process.commandLine && (
                                      <button
                                        onClick={() => copyCommand(process.commandLine, index)}
                                        className="flex-shrink-0 p-0.5 text-neutral-400 hover:text-neutral-600 transition-colors"
                                        title="复制完整命令行"
                                      >
                                        {copiedIndex === index ? (
                                          <Check className="w-3 h-3 text-green-600" />
                                        ) : (
                                          <Copy className="w-3 h-3" />
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default GPUUsageView;
