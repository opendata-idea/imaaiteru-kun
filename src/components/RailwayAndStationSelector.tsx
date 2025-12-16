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
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    return new Date().getMonth() + 1;
  });
  const router = useRouter();

  const pad2 = (n: number) => String(n).padStart(2, "0");
  const weekDays = ["日", "月", "火", "水", "木", "金", "土"];

  const getDaysInMonth = (monthNum: number) => {
    const year = new Date().getFullYear();
    return new Date(year, monthNum, 0).getDate();
  };

  const [selectedYearStr, selectedMonthStr, selectedDayStr] =
    selectedDate.split("-");
  const selectedMonthNum = Number(selectedMonthStr);
  const selectedDayNum = Number(selectedDayStr);
  const displayDate =
    Number.isFinite(selectedMonthNum) && Number.isFinite(selectedDayNum)
      ? `${selectedMonthNum}月${selectedDayNum}日`
      : "日付を選択";

  const handleToggleCalendar = () => {
    if (!isCalendarOpen && Number.isFinite(selectedMonthNum) && selectedMonthNum) {
      setCalendarMonth(selectedMonthNum);
    }
    setIsCalendarOpen((prev) => !prev);
  };

  const handlePrevMonth = () => {
    setCalendarMonth((prev) => (prev === 1 ? 12 : prev - 1));
  };

  const handleNextMonth = () => {
    setCalendarMonth((prev) => (prev === 12 ? 1 : prev + 1));
  };

  const handleDaySelect = (monthNum: number, dayNum: number) => {
    const year = new Date().getFullYear();
    setSelectedDate(`${year}-${pad2(monthNum)}-${pad2(dayNum)}`);
    setIsCalendarOpen(false);
  };

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
    <div className="w-full max-w-md mx-auto space-y-6">
      <div className="space-y-3">
        <h2 className="block text-sm font-medium text-gray-800">日付選択</h2>
        <div className="relative">
          <button
            type="button"
            onClick={handleToggleCalendar}
            className="w-full bg-pink-100 text-gray-900 rounded-lg px-4 py-3 text-left outline-none flex items-center justify-between border border-transparent focus:ring-2 focus:ring-pink-300"
          >
            <span className="text-gray-900">{displayDate}</span>
            <span className="text-2xl">📅</span>
          </button>

          {isCalendarOpen && (
            <div className="absolute z-10 w-full mt-1 bg-pink-50 rounded-lg shadow-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1 hover:bg-pink-200 rounded text-sm"
                >
                  ◀
                </button>
                <div className="font-bold text-base text-gray-900">
                  {calendarMonth}月
                </div>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1 hover:bg-pink-200 rounded text-sm"
                >
                  ▶
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-1">
                {weekDays.map((weekDay) => (
                  <div
                    key={weekDay}
                    className="text-center text-xs font-medium text-gray-600"
                  >
                    {weekDay}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {Array.from(
                  { length: getDaysInMonth(calendarMonth) },
                  (_, i) => i + 1,
                ).map((d) => (
                  <button
                    type="button"
                    key={d}
                    onClick={() => handleDaySelect(calendarMonth, d)}
                    className={`aspect-square flex items-center justify-center rounded text-xs border border-pink-200
                      ${
                        selectedMonthNum === calendarMonth && selectedDayNum === d
                          ? "bg-pink-400 text-white font-bold"
                          : "hover:bg-pink-200 bg-white text-gray-900"
                      }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
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
            <div className="flex flex-col gap-4">
              <select
                value={selectedStation}
                onChange={(e) => setSelectedStation(e.target.value)}
                className="w-full bg-pink-100 text-gray-900 rounded-lg px-4 py-3 text-left outline-none border border-transparent focus:ring-2 focus:ring-pink-300"
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
                className="w-full bg-pink-200 hover:bg-pink-300 text-gray-800 font-medium py-3 rounded-lg transition-colors disabled:opacity-50"
              >
                検索
              </button>
            </div>
          )}
          {!isLoading && !error && stations.length === 0 && (
            <p className="text-sm text-gray-600">駅情報が見つかりませんでした。</p>
          )}
        </div>
      )}
    </div>
  );
}
