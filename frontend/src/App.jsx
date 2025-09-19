import { useState } from "react";
import ModelView from "./components/ModelView.jsx";
import PortUsageView from "./components/PortUsageView.jsx";
import GPUUsageView from "./components/GPUUsageView.jsx";

function App() {
  const [activeTab, setActiveTab] = useState("models");

  const tabs = [
    { id: "models", label: "模型信息", component: <ModelView /> },
    { id: "ports", label: "端口占用查看", component: <PortUsageView /> },
    { id: "gpu", label: "GPU占用查看", component: <GPUUsageView /> }
  ];

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-7xl p-6">
        <h1 className="text-3xl font-semibold mb-6 tracking-tight text-center flex items-center justify-center gap-3">
          系统管理面板
          <img
            src="/capoo.jpg"
            alt="icon"
            style={{ height: "1.5em", width: "auto" }}
          />
        </h1>

        {/* Tab导航 */}
        <div className="flex justify-center mb-8">
          <div className="flex space-x-1 bg-neutral-100 p-1 rounded-lg">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 text-sm font-medium rounded-md transition-all duration-200 ${activeTab === tab.id
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50"
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab内容 */}
        <div className="tab-content">
          {tabs.find(tab => tab.id === activeTab)?.component}
        </div>
      </div>
    </div>
  );
}

export default App;
