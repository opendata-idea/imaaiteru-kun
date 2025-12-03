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
    lon: string;
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
  const date = searchParams.get("date");

  const [venueData, setVenueData] = useState<VenueData | null>(null);
  const [eventData, setEventData] = useState<EventInfo[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!stationName || !date) {
      setError("駅名と日付が指定されていません。");
      setIsLoading(false);
      return;
    }

    const fetchAllData = async () => {
      setIsLoading(true);
      setError(null);
      setVenueData(null);
      setEventData(null);

      try {
        // 1. Fetch venues
        const venueRes = await fetch(
          `/api/search-venues?stationName=${stationName}`,
        );
        if (!venueRes.ok) {
          const errorData = await venueRes.json();
          throw new Error(
            errorData.detail || `会場の検索に失敗しました (HTTP ${venueRes.status})`,
          );
        }
        const venues: VenueData = await venueRes.json();
        setVenueData(venues);

        // 2. Fetch events if venues are found
        if (venues.venue_results.Feature.length > 0) {
          const facilityList = venues.venue_results.Feature.map(
            (venue) => venue.Name,
          );

          const eventRes = await fetch("/api/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              target_date: date,
              facility_list: facilityList,
            }),
          });

          if (!eventRes.ok) {
            const errorData = await eventRes.json();
            let errorMessage = errorData.detail || "イベント情報の取得に失敗しました。";
            if (errorData.error) {
              errorMessage += ` (詳細: ${errorData.error})`;
            }
            // Don't throw an error, just set it so venue results can still be displayed
            setError(errorMessage);
          } else {
            const events: EventInfo[] = await eventRes.json();
            setEventData(events);
          }
        }
      } catch (e: any) {
        setError(e.message || "データの取得に失敗しました。");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();
  }, [stationName, date]);

  const renderContent = () => {
    if (isLoading) {
      return <p>周辺の施設とイベント情報を検索中...</p>;
    }

    if (error && !venueData) {
      return <p className="text-red-500">{error}</p>;
    }
    
    if (!venueData || venueData.venue_results.ResultInfo.Count === 0) {
      return <p>周辺に該当する施設は見つかりませんでした。</p>;
    }

    return (
      <div>
        {error && <p className="text-red-500 my-4">イベント情報の取得中にエラーが発生しました: {error}</p>}
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
                {event ? (
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
                ) : (
                  // Show a placeholder if event data is still loading or failed for this specific venue
                  !error && <div className="mt-2 p-2 rounded-md bg-gray-100">
                    <p className="text-sm text-gray-500">イベント情報取得中...</p>
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
        「{stationName}」周辺のイベント情報 ({date})
      </h1>
      {renderContent()}
    </main>
  );
}
