export default function Tabs({ tabs, activeKey, onChange }) {

  return (
    <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-3">

      {tabs.map((tab) => {

        const isActive = tab.key === activeKey;

        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`
              flex items-center gap-2
              rounded-2xl px-4 py-2.5
              text-sm font-semibold
              transition
              ${isActive
                ? "bg-white text-black"
                : "border border-zinc-800 bg-zinc-950 text-zinc-400 hover:bg-zinc-900 hover:text-white"}
            `}
          >
            {tab.label}

            {tab.count != null && tab.count > 0 && (
              <span
                className={`
                  rounded-full px-2 py-0.5 text-xs font-bold
                  ${isActive
                    ? "bg-black/10 text-black"
                    : "bg-red-500 text-white"}
                `}
              >
                {tab.count}
              </span>
            )}
          </button>
        );

      })}

    </div>
  );
}
