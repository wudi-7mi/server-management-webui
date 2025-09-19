import { Copy } from "lucide-react";
import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

function ModelCard({ model }) {
  const [copied, setCopied] = useState(null); // 'name' | 'path' | null
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const legacyCopy = (text) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    let success = false;
    try {
      success = document.execCommand('copy');
    } catch (e) {
      success = false;
    }
    document.body.removeChild(textarea);
    return success;
  };

  const copy = async (text, key) => {
    // optimistic UI: show success feedback regardless, then attempt copy
    setCopied(key);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(null), 1200);

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ok = legacyCopy(text);
        if (!ok && navigator.clipboard) {
          // try clipboard even if not secure context (may still work in some envs)
          await navigator.clipboard.writeText(text);
        }
      }
    } catch (e) {
      // swallow errors; UI already showed feedback
    }
  };

  const btnClass = "inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-gradient-to-b from-white to-neutral-50/80 px-2.5 py-1.5 text-xs text-neutral-800 shadow-sm hover:from-white hover:to-neutral-100 active:scale-[0.99] active:shadow-xs transition-colors";

  return (
    <div className="group relative rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm ring-1 ring-black/[0.02] transition-all hover:shadow-md hover:-translate-y-[1px]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-medium text-neutral-900 truncate" title={model.name}>
            {model.name}
          </h2>
          <p className="mt-1 text-xs text-neutral-500">大小: {model.size}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => copy(model.name, 'name')}
          className={btnClass}
          aria-live="polite"
        >
          {copied === 'name' ? (<><Check size={16} /> 已复制</>) : (<><Copy size={16} /> 名称</>)}
        </button>
        <button
          onClick={() => copy(model.path, 'path')}
          className={btnClass}
          aria-live="polite"
        >
          {copied === 'path' ? (<><Check size={16} /> 已复制</>) : (<><Copy size={16} /> 路径</>)}
        </button>
      </div>
    </div>
  );
}

export default ModelCard;


