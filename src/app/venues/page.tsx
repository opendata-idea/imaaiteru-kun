"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

// --- 型定義 ---

interface Venue {
  Id: string;
  Name: string;
  Property: {
    Address: string;
    Genre: {
      Name: string;
    }[];
  };
}

interface VenueData {
  search_station: string;
  coordinates: {
    lat: string;
    lon:string;
  };
  venue_results: {
    ResultInfo: {
      Count: number;
    };
    Feature: Venue[];
  };
}

interface EventInfo {
  facility_name: string;
  event_name: string | null;
  scale: number;
  reason: string;
}

// --- ヘルパー関数 ---

// 今日の日付をYYYY-MM-DD形式で取得
const getTodayString = () => {
  const today = new Date();
  today.setHours(today.getHours() + 9); // JSTに調整
  return today.toISOString().split("T")[0];
};

// 混雑度のスケールに応じて色を返す
const getScaleColor = (scale: number) => {
  if (scale >= 8) return "bg-red-500";
  if (scale >= 5) return "bg-yellow-500";
  if (scale >= 3) return "bg-blue-500";
  return "bg-gray-500";
};


// --- コンポーネント ---

export default function VenuesPage() {
  const searchParams = useSearchParams();
  const stationName = searchParams.get("stationName");

  // 周辺施設の状態
  const [venueData, setVenueData] = useState<VenueData | null>(null);
  const [isVenueLoading, setIsVenueLoading] = useState(true);
  const [venueError, setVenueError] = useState<string | null>(null);

  // イベント情報の状態
  const [targetDate, setTargetDate] = useState(getTodayString());
  const [eventData, setEventData] = useState<EventInfo[] | null>(null);
  const [isEventLoading, setIsEventLoading] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);


  // biome-ignore lint/correctness/useExhaustiveDependencies: stationNameが変更された時のみ実行
  useEffect(() => {
    if (!stationName) {
      setVenueError("駅名が指定されていません。");
      setIsVenueLoading(false);
      return;
    }

    const fetchVenueData = async () => {
      setIsVenueLoading(true);
      setVenueError(null);
      try {
        const res = await fetch(
          `/api/search-venues?stationName=${stationName}`,
        );
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(
            errorData.detail || `エラーが発生しました (HTTP ${res.status})`,
          );
        }
        const result: VenueData = await res.json();
        setVenueData(result);
      } catch (e: any) {
        setVenueError(e.message || "データの取得に失敗しました。");
      } finally {
        setIsVenueLoading(false);
      }
    };

    fetchVenueData();
  }, [stationName]);

  const handleSearchEvents = async () => {
    if (!venueData || venueData.venue_results.Feature.length === 0) {
      setEventError("イベントを検索する施設がありません。");
      return;
    }

    setIsEventLoading(true);
    setEventError(null);
    setEventData(null);

    const facilityList = venueData.venue_results.Feature.map(
      (venue) => venue.Name,
    );

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_date: targetDate,
          facility_list: facilityList,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        let errorMessage = errorData.detail || "イベント情報の取得に失敗しました。";
        if (errorData.error) {
          errorMessage += ` (詳細: ${errorData.error})`;
        }
        throw new Error(errorMessage);
      }

      const events: EventInfo[] = await res.json();
      setEventData(events);
    } catch (e: any) {
      setEventError(e.message);
    } finally {
      setIsEventLoading(false);
    }
  };


  const renderContent = () => {
    if (isVenueLoading) {
      return <p>周辺の施設を検索中...</p>;
    }

    if (venueError) {
      return <p className="text-red-500">{venueError}</p>;
    }

    if (!venueData || venueData.venue_results.ResultInfo.Count === 0) {
      return <p>周辺に該当する施設は見つかりませんでした。</p>;
    }

    return (
      <div>
        <div className="my-4 p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-100 dark:bg-slate-800 shadow-md">
          <h2 className="text-lg font-semibold mb-3 text-slate-800 dark:text-slate-200">イベント混雑予測</h2>
          <div className="flex flex-wrap items-center gap-4">
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={handleSearchEvents}
              disabled={isEventLoading}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isEventLoading ? "検索中..." : "混雑状況を予測"}
            </button>
          </div>
          {eventError && <p className="text-red-500 mt-3">{eventError}</p>}
        </div>

        <h2 className="text-xl font-semibold mb-2">
          検索結果 ({venueData.venue_results.ResultInfo.Count}件) - {targetDate}
        </h2>
        <ul className="space-y-3">
          {venueData.venue_results.Feature.map((venue) => {
            const event = eventData?.find(
              (e) => e.facility_name === venue.Name,
            );
            return (
              <li key={venue.Id} className="p-3 border rounded-md">
                <p className="font-bold">{venue.Name}</p>
                <p className="text-sm">{venue.Property?.Address}</p>
                <p className="text-xs mb-2">
                  カテゴリ: {venue.Property?.Genre?.[0]?.Name || "N/A"}
                </p>
                {isEventLoading && (
                   <div className="mt-2 p-2 rounded-md bg-gray-100 animate-pulse">
                    <div className="h-4 bg-gray-300 rounded w-3/4" />
                    <div className="h-3 bg-gray-300 rounded w-1/2 mt-1" />
                  </div>
                )}
                {event && (
                  <div className="mt-2 p-2 rounded-md bg-green-50 border border-green-200">
                    <p className="font-semibold text-green-800">
                      {event.event_name || "特に大きなイベントはなし"}
                    </p>
                    <div className="flex items-center gap-2">
                       <span
                        className={`inline-block w-4 h-4 rounded-full ${getScaleColor(
                          event.scale,
                        )}`}
                       />
                      <p className="text-sm text-gray-600">
                        混雑予測: {event.scale}/10
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      ({event.reason})
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">
        「{stationName}」周辺の施設
      </h1>
      {renderContent()}
    </main>
  );
}
