import express from "express";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import cors from "cors";

const app = express();
const PORT = 3001;
const MODEL_DIR = "/publicdata/model";

// 缓存机制
let portsCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5000; // 5秒缓存

// 允许跨域
app.use(cors({
  origin: "*", // 或者写成前端地址 "http://10.71.149.184:21600"
}));

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

app.get("/api/models", (req, res) => {
  fs.readdir(MODEL_DIR, { withFileTypes: true }, (err, files) => {
    if (err) return res.status(500).json({ error: err.message });

    const TEN_MB = 10 * 1024 * 1024;

    const models = files
      .filter((f) => f.isDirectory())
      .map((f) => {
        const fullPath = path.join(MODEL_DIR, f.name);
        let sizeBytes = -1;
        try {
          // 使用字节数，便于阈值过滤；加引号避免空格路径问题
          const out = execSync(`du -sb "${fullPath}" | cut -f1`).toString().trim();
          sizeBytes = parseInt(out, 10);
        } catch {}
        return { name: f.name, path: fullPath, sizeBytes };
      })
      .filter((m) => Number.isFinite(m.sizeBytes) && m.sizeBytes >= TEN_MB)
      .map((m) => ({ ...m, size: formatBytes(m.sizeBytes) }));

    res.json(models);
  });
});

app.get("/api/stats", (req, res) => {
  try {
    // 总目录大小
    const totalBytes = parseInt(execSync(`du -sb "${MODEL_DIR}" | cut -f1`).toString().trim(), 10);

    // 磁盘剩余空间（以 /dev/nvme1n1p1 为目标，获取其挂载点并查询可用空间）
    // 先通过 df 找到该设备的可用字节数（以 1B 单位输出）
    let freeBytes = null;
    try {
      const out = execSync(`df --output=avail -B1 | tail -n +2`).toString().trim().split(/\s+/);
      // 兜底：如果直接按设备名失败，就退化为最大可用空间分区的可用值（通常为根或主要数据盘）
      freeBytes = parseInt(out.sort((a,b)=>parseInt(b,10)-parseInt(a,10))[0], 10);
    } catch {}

    // 更精确按设备名取值
    try {
      const byDev = execSync(`df --output=avail,source -B1 | grep "/dev/nvme1n1p1" | awk '{print $1}'`).toString().trim();
      if (byDev) freeBytes = parseInt(byDev, 10);
    } catch {}

    res.json({
      totalBytes,
      total: formatBytes(totalBytes),
      freeBytes: Number.isFinite(freeBytes) ? freeBytes : null,
      free: Number.isFinite(freeBytes) ? formatBytes(freeBytes) : "未知",
      device: "/dev/nvme1n1p1",
      dir: MODEL_DIR,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 端口占用查看API
app.get("/api/ports", (req, res) => {
  try {
    // 检查缓存
    const now = Date.now();
    if (portsCache && (now - cacheTimestamp) < CACHE_DURATION) {
      return res.json(portsCache);
    }
    // 首先尝试使用netstat -tulnp获取完整信息
    let netstatOutput;
    let hasFullInfo = false;
    
    try {
      netstatOutput = execSync("netstat -tulnp 2>/dev/null", { encoding: 'utf8' });
      hasFullInfo = true;
    } catch (e) {
      // 如果失败，尝试不使用-p参数
      try {
        netstatOutput = execSync("netstat -tuln 2>/dev/null", { encoding: 'utf8' });
        hasFullInfo = false;
      } catch (e2) {
        throw new Error("无法获取端口信息，请检查netstat命令是否可用");
      }
    }
    
    const lines = netstatOutput.trim().split('\n');
    const ports = [];
    const processCache = new Map(); // 缓存进程信息
    
    // 收集所有唯一的PID
    const uniquePids = new Set();
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const parts = line.split(/\s+/);
      if (parts.length < 6) continue;
      
      const status = parts[5];
      if (status === 'LISTEN' || status === 'LISTENING') {
        if (hasFullInfo && parts.length > 6) {
          const pidProcess = parts[6];
          const match = pidProcess.match(/(\d+)\/(.+)/);
          if (match) {
            uniquePids.add(parseInt(match[1], 10));
          }
        }
      }
    }
    
    // 批量获取所有进程信息（一次性查询）
    if (uniquePids.size > 0) {
      try {
        const pidList = Array.from(uniquePids).join(',');
        // 一次性获取所有进程的内存和用户信息
        const psOutput = execSync(`ps -o pid,rss,user= -p ${pidList} 2>/dev/null`, { encoding: 'utf8' });
        const psLines = psOutput.trim().split('\n');
        
        for (let i = 1; i < psLines.length; i++) { // 跳过标题行
          const psLine = psLines[i].trim();
          if (!psLine) continue;
          
          const psParts = psLine.split(/\s+/);
          if (psParts.length >= 3) {
            const pid = parseInt(psParts[0], 10);
            const memoryKB = parseInt(psParts[1], 10);
            const user = psParts[2];
            
            processCache.set(pid, {
              memoryUsage: memoryKB * 1024, // 转换为字节
              user: user
            });
          }
        }
      } catch (e) {
        // 如果批量查询失败，忽略错误
      }
    }
    
    // 处理端口信息
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const parts = line.split(/\s+/);
      if (parts.length < 6) continue;
      
      const protocol = parts[0];
      const localAddress = parts[3];
      const remoteAddress = parts[4];
      const status = parts[5];
      
      // 只处理监听状态的端口
      if (status === 'LISTEN' || status === 'LISTENING') {
        // 解析PID和进程名（仅当有完整信息时）
        let pid = null;
        let process = null;
        let memoryUsage = null;
        let user = null;
        
        if (hasFullInfo && parts.length > 6) {
          const pidProcess = parts[6];
          const match = pidProcess.match(/(\d+)\/(.+)/);
          if (match) {
            pid = parseInt(match[1], 10);
            process = match[2];
            
            // 从缓存中获取进程信息
            const cachedInfo = processCache.get(pid);
            if (cachedInfo) {
              memoryUsage = cachedInfo.memoryUsage;
              user = cachedInfo.user;
            }
          }
        }
        
        // 判断IP版本
        const isIPv6 = localAddress.includes('::') || localAddress.includes('::1');
        const ipVersion = isIPv6 ? 'IPv6' : 'IPv4';
        
        ports.push({
          protocol,
          localAddress,
          remoteAddress: remoteAddress === '0.0.0.0:*' ? '-' : remoteAddress,
          status: 'LISTENING',
          pid,
          process: process || (hasFullInfo ? '权限不足' : '未知'),
          memoryUsage,
          ipVersion,
          user: user || (hasFullInfo ? '权限不足' : '未知')
        });
      }
    }
    
    // 按端口号排序
    ports.sort((a, b) => {
      const portA = parseInt(a.localAddress.split(':').pop() || '0', 10);
      const portB = parseInt(b.localAddress.split(':').pop() || '0', 10);
      return portA - portB;
    });
    
    // 更新缓存
    portsCache = ports;
    cacheTimestamp = now;
    
    res.json(ports);
  } catch (e) {
    res.status(500).json({ 
      error: e.message,
      suggestion: "建议以root权限运行服务或使用sudo pm2 restart model-server"
    });
  }
});

// GPU占用查看API
app.get("/api/gpu", (req, res) => {
  try {
    // 尝试使用nvidia-smi获取GPU信息
    let gpuOutput;
    let hasNvidiaSmi = false;
    
    try {
      gpuOutput = execSync("nvidia-smi --query-gpu=index,name,memory.used,memory.total,utilization.gpu,temperature.gpu,power.draw --format=csv,noheader,nounits", { encoding: 'utf8' });
      hasNvidiaSmi = true;
    } catch (e) {
      // 如果nvidia-smi不可用，尝试其他方法
      try {
        // 尝试使用lspci查看GPU设备
        gpuOutput = execSync("lspci | grep -i vga", { encoding: 'utf8' });
        hasNvidiaSmi = false;
      } catch (e2) {
        throw new Error("无法获取GPU信息，请检查nvidia-smi是否安装或GPU驱动是否正常");
      }
    }
    
    const gpus = [];
    
    if (hasNvidiaSmi) {
      // 解析nvidia-smi输出
      const lines = gpuOutput.trim().split('\n');
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        const parts = line.split(', ');
        if (parts.length >= 7) {
          const index = parseInt(parts[0], 10);
          const name = parts[1].trim();
          const memoryUsed = parseInt(parts[2], 10);
          const memoryTotal = parseInt(parts[3], 10);
          const gpuUtil = parseInt(parts[4], 10);
          const temperature = parseInt(parts[5], 10);
          const powerDraw = parseFloat(parts[6]);
          
          gpus.push({
            index,
            name,
            memoryUsed: memoryUsed * 1024 * 1024, // 转换为字节
            memoryTotal: memoryTotal * 1024 * 1024, // 转换为字节
            memoryUsedMB: memoryUsed,
            memoryTotalMB: memoryTotal,
            gpuUtilization: gpuUtil,
            temperature,
            powerDraw,
            memoryUtilization: Math.round((memoryUsed / memoryTotal) * 100)
          });
        }
      }
    } else {
      // 使用lspci信息
      const lines = gpuOutput.trim().split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        gpus.push({
          index: i,
          name: line,
          memoryUsed: null,
          memoryTotal: null,
          memoryUsedMB: null,
          memoryTotalMB: null,
          gpuUtilization: null,
          temperature: null,
          powerDraw: null,
          memoryUtilization: null,
          status: "基础信息"
        });
      }
    }
    
    res.json(gpus);
  } catch (e) {
    res.status(500).json({ 
      error: e.message,
      suggestion: "请确保已安装nvidia-smi或GPU驱动正常"
    });
  }
});

// GPU进程查看API
app.get("/api/gpu/processes", (req, res) => {
  try {
    // 使用nvidia-smi获取GPU进程信息
    let processesOutput;
    
    try {
      processesOutput = execSync("nvidia-smi --query-compute-apps=gpu_uuid,pid,process_name,used_memory --format=csv,noheader,nounits", { encoding: 'utf8' });
    } catch (e) {
      // 如果上面的命令失败，尝试另一种格式
      try {
        processesOutput = execSync("nvidia-smi pmon -c 1 -s um", { encoding: 'utf8' });
      } catch (e2) {
        throw new Error("无法获取GPU进程信息，请检查nvidia-smi是否支持进程查询");
      }
    }
    
    // 获取GPU列表以建立UUID到索引的映射
    let gpuUuidMap = new Map();
    try {
      const gpuUuidOutput = execSync("nvidia-smi --query-gpu=index,uuid --format=csv,noheader,nounits", { encoding: 'utf8' });
      const gpuLines = gpuUuidOutput.trim().split('\n');
      for (const line of gpuLines) {
        const parts = line.split(', ');
        if (parts.length >= 2) {
          const index = parseInt(parts[0], 10);
          const uuid = parts[1].trim();
          gpuUuidMap.set(uuid, index);
        }
      }
    } catch {}
    
    const processes = [];
    const lines = processesOutput.trim().split('\n');
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      // 解析CSV格式的输出
      const parts = line.split(', ');
      if (parts.length >= 4) {
        const gpuUuid = parts[0].trim();
        const pid = parseInt(parts[1], 10);
        const processName = parts[2].trim();
        const usedMemory = parseInt(parts[3], 10);
        
        // 获取进程的详细信息
        let user = null;
        let commandLine = null;
        
        try {
          const userInfo = execSync(`ps -o user= -p ${pid} 2>/dev/null`, { encoding: 'utf8' }).trim();
          if (userInfo) user = userInfo;
        } catch {}
        
        try {
          const cmdInfo = execSync(`ps -o cmd= -p ${pid} 2>/dev/null`, { encoding: 'utf8' }).trim();
          if (cmdInfo) commandLine = cmdInfo;
        } catch {}
        
        processes.push({
          gpuUuid,
          gpuIndex: gpuUuidMap.get(gpuUuid) !== undefined ? gpuUuidMap.get(gpuUuid) : null,
          pid,
          processName,
          usedMemoryMB: usedMemory,
          usedMemoryBytes: usedMemory * 1024 * 1024,
          user,
          commandLine: commandLine || null // 显示完整命令行，不截断
        });
      }
    }
    
    res.json(processes);
  } catch (e) {
    res.status(500).json({ 
      error: e.message,
      suggestion: "请确保nvidia-smi支持进程查询功能"
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
