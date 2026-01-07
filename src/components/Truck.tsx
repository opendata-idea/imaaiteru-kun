"use client";

type TruckProps = {
  compact?: boolean; // コンパクトモード（ロードバー用）
};

const Truck = ({ compact = false }: TruckProps) => {
  const color = "#2DD4BF";

  const TruckCar = ({ offsetX = 0 }: { offsetX?: number }) => (
    <g transform={`translate(${offsetX}, 0) scale(0.35)`}>
      {/* タイヤ（車体の後ろ） - 回転アニメーション */}
      <g
        className="animate-spin-wheel"
        style={{ transformOrigin: "130px 225px" }}
      >
        <circle cx="130" cy="225" r="30" fill={color} />
        <circle cx="130" cy="225" r="10" fill="white" />
      </g>
      <g
        className="animate-spin-wheel"
        style={{ transformOrigin: "200px 225px" }}
      >
        <circle cx="200" cy="225" r="30" fill={color} />
        <circle cx="200" cy="225" r="10" fill="white" />
      </g>
      <g
        className="animate-spin-wheel"
        style={{ transformOrigin: "440px 225px" }}
      >
        <circle cx="440" cy="225" r="30" fill={color} />
        <circle cx="440" cy="225" r="10" fill="white" />
      </g>
      <g
        className="animate-spin-wheel"
        style={{ transformOrigin: "510px 225px" }}
      >
        <circle cx="510" cy="225" r="30" fill={color} />
        <circle cx="510" cy="225" r="10" fill="white" />
      </g>

      {/* 車体の枠（1つの大きな長方形） */}
      <rect
        x="60"
        y="60"
        width="510"
        height="160"
        rx="25"
        fill="white"
        stroke={color}
        strokeWidth="6"
      />

      {/* 上部の窓（左3個） */}
      <rect x="80" y="90" width="60" height="60" rx="12" fill={color} />
      <rect x="150" y="90" width="60" height="60" rx="12" fill={color} />
      <rect x="220" y="90" width="60" height="60" rx="12" fill={color} />

      {/* 中央のドア（縦長2本、車体を貫通） */}
      <rect x="295" y="90" width="40" height="130" fill={color} />
      <rect x="340" y="90" width="40" height="130" fill={color} />

      {/* ドアの取っ手（楕円形） */}
      <ellipse cx="320" cy="155" rx="6" ry="10" fill="white" />
      <ellipse cx="355" cy="155" rx="6" ry="10" fill="white" />

      {/* 上部の窓（右2個） */}
      <rect x="400" y="90" width="60" height="60" rx="12" fill={color} />
      <rect x="470" y="90" width="60" height="60" rx="12" fill={color} />

      {/* フロントガラス（右端の縦長） */}
      <rect x="535" y="75" width="30" height="100" rx="8" fill={color} />

      {/* 水平線（ドアの左右） */}
      <line x1="70" y1="165" x2="290" y2="165" stroke={color} strokeWidth="5" />
      <line
        x1="385"
        y1="165"
        x2="530"
        y2="165"
        stroke={color}
        strokeWidth="5"
      />

      {/* サイドミラー（右下の丸） */}
      <circle cx="550" cy="190" r="14" fill={color} />
    </g>
  );

  // コンパクトモード（ロードバー用）
  if (compact) {
    return (
      <div className="w-full overflow-hidden bg-pink-50 rounded-lg py-2">
        <svg
          width="100%"
          height="80"
          viewBox="-100 0 1500 200"
          preserveAspectRatio="xMidYMid meet"
        >
          <g className="animate-train">
            <TruckCar offsetX={0} />
            <TruckCar offsetX={190} />
            <TruckCar offsetX={380} />
            <TruckCar offsetX={570} />
            <TruckCar offsetX={760} />
            <TruckCar offsetX={950} />
          </g>
        </svg>
      </div>
    );
  }

  // フルスクリーンモード
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-100 overflow-hidden">
      {/* 6両編成のトラック */}
      <div className="w-full max-w-full">
        <svg
          width="100%"
          height="200"
          viewBox="-100 0 1500 200"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* 6両のトラックを横並びに配置 */}
          <g className="animate-train">
            <TruckCar offsetX={0} />
            <TruckCar offsetX={190} />
            <TruckCar offsetX={380} />
            <TruckCar offsetX={570} />
            <TruckCar offsetX={760} />
            <TruckCar offsetX={950} />
          </g>
        </svg>
      </div>

      {/* ローディングテキスト */}
      <div className="mt-8 text-2xl font-bold text-teal-500 animate-pulse">
        検索中...
      </div>
    </div>
  );
};

export default Truck;
