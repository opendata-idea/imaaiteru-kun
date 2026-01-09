"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { RailwayOption, StationOption } from "@/lib/odpt";
import RailwaySelect from "./RailwaySelect";
type RailwayAndStationSelectorProps = {
  railwayOptions: RailwayOption[];
};

type FavoriteItem = {
  railwayId: string;
  stationId: string;
  railwayLabel: string;
  stationLabel: string;
  count: number;
};

export default function RailwayAndStationSelector({
  railwayOptions,
}: RailwayAndStationSelectorProps) {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [selectedRailway, setSelectedRailway] = useState("");
  const [stations, setStations] = useState<StationOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStation, setSelectedStation] = useState("");
  const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // 月は0から始まるため+1
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState(getTodayDateString);
  const minDate = getTodayDateString();
  const router = useRouter();

  const loadFavorites = () => {
    try {
      const savedFavorites = localStorage.getItem("imaaiteru-kun-favorites");
      if (savedFavorites) {
        const parsedFavorites: FavoriteItem[] = JSON.parse(savedFavorites);
        parsedFavorites.sort((a, b) => b.count - a.count);
        setFavorites(parsedFavorites.slice(0, 5));
      }
    } catch (error) {
      console.error("Failed to load favorites from localStorage", error);
    }
  };

  useEffect(() => {
    loadFavorites();
  }, []);

  const handleFavoriteClick = (favorite: FavoriteItem) => {
    setSelectedRailway(favorite.railwayId);
    setSelectedStation(favorite.stationId);
  };

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
        // Reset station only if the new list doesn't contain the current selection
        setSelectedStation(currentStation => {
            if (data.some(station => station.value === currentStation)) {
                return currentStation;
            }
            return "";
        });
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

    try {
      const savedFavorites = localStorage.getItem("imaaiteru-kun-favorites");
      const favorites: FavoriteItem[] = savedFavorites ? JSON.parse(savedFavorites) : [];
      
      const existingFavIndex = favorites.findIndex(
        (fav) => fav.railwayId === selectedRailway && fav.stationId === selectedStation
      );

      if (existingFavIndex > -1) {
        favorites[existingFavIndex].count += 1;
      } else {
        const railwayLabel = railwayOptions.find(opt => opt.value === selectedRailway)?.label || "";
        const stationLabel = stations.find(opt => opt.value === selectedStation)?.label || "";
        if (railwayLabel && stationLabel) {
          favorites.push({
            railwayId: selectedRailway,
            stationId: selectedStation,
            railwayLabel,
            stationLabel,
            count: 1,
          });
        }
      }
      
      localStorage.setItem("imaaiteru-kun-favorites", JSON.stringify(favorites));
      loadFavorites(); // Reload and sort favorites for UI update
    } catch (error) {
      console.error("Failed to update favorites in localStorage", error);
    }
    
    const stationName = stations.find(
      (s) => s.value === selectedStation
    )?.label;
    
    if (stationName) {
      router.push(
        `/venues?stationName=${encodeURIComponent(
          stationName
        )}&date=${selectedDate}`
      );
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      {favorites.length > 0 && (
        <div className="space-y-3">
          <h2 className="block text-sm font-medium text-gray-800">よく使う組み合わせ</h2>
          <div className="flex flex-wrap gap-2">
            {favorites.map((fav) => (
              <button
                key={`${fav.railwayId}-${fav.stationId}`}
                type="button"
                onClick={() => handleFavoriteClick(fav)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm px-3 py-1 rounded-full transition-colors"
              >
                {fav.railwayLabel}・{fav.stationLabel}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-3">
        <h2 className="block text-sm font-medium text-gray-800">日付選択</h2>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          min={minDate}
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
                disabled={!selectedStation}
                className="w-full bg-pink-200 hover:bg-pink-300 text-gray-800 font-medium py-3 rounded-lg transition-colors disabled:opacity-50"
              >
                検索
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

