"use client";

import { useState, useEffect } from "react";
import RailwaySelect from "./RailwaySelect";
import { RailwayOption, StationOption } from "@/lib/odpt";

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

  useEffect(() => {
    if (!selectedRailway) {
      setStations([]);
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
      } catch (e) {
        setError("駅情報の取得に失敗しました");
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStations();
  }, [selectedRailway]);

  return (
    <div className="p-4 space-y-4">
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
          )}
          {!isLoading && !error && stations.length === 0 && (
            <p>駅情報が見つかりませんでした。</p>
          )}
        </div>
      )}
    </div>
  );
}
