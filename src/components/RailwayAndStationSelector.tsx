"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { RailwayOption, StationOption } from "@/lib/odpt";
import RailwaySelect from "./RailwaySelect";
import Truck from "./Truck";

type RailwayAndStationSelectorProps = {
  railwayOptions: RailwayOption[];
};

export default function RailwayAndStationSelector({
  railwayOptions,
}: RailwayAndStationSelectorProps) {
  const [selectedRailway, setSelectedRailway] = useState("");
  const [stations, setStations] = useState<StationOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStation, setSelectedStation] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString().split("T")[0];
  });
  const router = useRouter();

  useEffect(() => {
    if (!selectedRailway) {
      setStations([]);
      setSelectedStation("");
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
        setSelectedStation("");
      } catch (e) {
        setError("駅情報の取得に失敗しました");
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStations();
  }, [selectedRailway]);

  const handleSearch = async () => {
    if (!selectedStation) return;
    
    const stationName = stations.find(
      (s) => s.value === selectedStation
    )?.label;
    
    if (stationName) {
      console.log('🚀 検索開始 - Truck表示');
      setIsSearching(true);
      
      // 5秒間Truckを表示
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      console.log('✅ ページ遷移開始');
      router.push(
        `/venues?stationName=${encodeURIComponent(
          stationName
        )}&date=${selectedDate}`
      );
    }
  };

  // 検索中はTruckを全画面表示
  if (isSearching) {
    return <Truck />;
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <div className="space-y-3">
        <h2 className="block text-sm font-medium text-gray-800">日付選択</h2>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-full bg-pink-100 text-gray-900 rounded-lg px-4 py-3 outline-none border border-transparent focus:ring-2 focus:ring-pink-300"
        />
      </div>
      <div className="space-y-3">
        <h2 className="block text-sm font-medium text-gray-800">路線選択</h2>
        <RailwaySelect
          options={railwayOptions}
          value={selectedRailway}
          onChange={setSelectedRailway}
        />
      </div>

      {selectedRailway && (
        <div className="space-y-3">
          <h2 className="block text-sm font-medium text-gray-800">駅選択</h2>
          {isLoading && <p className="text-sm text-gray-600">読み込み中...</p>}
          {error && <p className="text-red-500">{error}</p>}
          {!isLoading && !error && stations.length > 0 && (
            <div className="flex flex-col gap-8">
              <div className="relative">
                <select
                  value={selectedStation}
                  onChange={(e) => setSelectedStation(e.target.value)}
                  className="w-full appearance-none bg-pink-100 text-gray-900 rounded-lg px-4 py-3 pr-10 text-left outline-none border border-transparent focus:ring-2 focus:ring-pink-300"
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
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-gray-600"
                >
                  ▼
                </span>
              </div>
              <button
                type="button"
                onClick={handleSearch}
                disabled={!selectedStation || isSearching}
                className="w-full bg-pink-200 hover:bg-pink-300 text-gray-800 font-medium py-3 rounded-lg transition-colors disabled:opacity-50"
              >
                {isSearching ? '検索中...' : '検索'}
              </button>
            </div>
          )}
          {!isLoading && !error && stations.length === 0 && (
            <p className="text-sm text-gray-600">
              駅情報が見つかりませんでした。
            </p>
          )}
        </div>
      )}
    </div>
  );
}