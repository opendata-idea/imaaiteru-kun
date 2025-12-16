"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { RailwayOption, StationOption } from "@/lib/odpt";
import RailwaySelect from "./RailwaySelect";

type RailwayAndStationSelectorProps = {
  railwayOptions: RailwayOption[];
};

export default function RailwayAndStationSelector({
  railwayOptions,
}: RailwayAndStationSelectorProps) {
  const [selectedRailway, setSelectedRailway] = useState("");
  const [stations, setStations] = useState<StationOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStation, setSelectedStation] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to midnight
    return today.toISOString().split("T")[0]; // Format as YYYY-MM-DD
  });
  const router = useRouter();

  useEffect(() => {
    if (!selectedRailway) {
      setStations([]);
      setSelectedStation(""); // 路線がクリアされたら駅もクリア
      return;
    }

    const fetchStations = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/stations?railwayId=${selectedRailway}`);
        if (!res.ok) {
          throw new Error("Failed to fetch stations");
        }
        const data: StationOption[] = await res.json();
        setStations(data);
        setSelectedStation(""); // 新しい駅リストが来たら選択をリセット
      } catch (e) {
        setError("駅情報の取得に失敗しました");
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStations();
  }, [selectedRailway]);

  const handleSearch = () => {
    if (!selectedStation) return;
    const stationName = stations.find(
      (s) => s.value === selectedStation,
    )?.label;
    if (stationName) {
      router.push(
        `/venues?stationName=${encodeURIComponent(
          stationName,
        )}&date=${selectedDate}`,
      );
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <h2 className="text-xl font-bold mb-2">日付選択</h2>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-md"
        />
      </div>
      <div>
        <h2 className="text-xl font-bold mb-2">路線選択</h2>
        <RailwaySelect
          options={railwayOptions}
          value={selectedRailway}
          onChange={setSelectedRailway}
        />
      </div>

      {selectedRailway && (
        <div>
          <h2 className="text-xl font-bold mb-2">駅選択</h2>
          {isLoading && <p>読み込み中...</p>}
          {error && <p className="text-red-500">{error}</p>}
          {!isLoading && !error && stations.length > 0 && (
            <div className="flex items-center space-x-2">
              <select
                value={selectedStation}
                onChange={(e) => setSelectedStation(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-md"
              >
                <option value="" disabled>
                  駅を選択
                </option>
                {stations.map((station) => (
                  <option key={station.value} value={station.value}>
                    {station.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleSearch}
                disabled={!selectedStation}
                className="px-4 py-2 bg-blue-500 text-white rounded-md disabled:bg-gray-300"
              >
                検索
              </button>
            </div>
          )}
          {!isLoading && !error && stations.length === 0 && (
            <p>駅情報が見つかりませんでした。</p>
          )}
        </div>
      )}
    </div>
  );
}
