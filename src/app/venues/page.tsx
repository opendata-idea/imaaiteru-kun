"use client";

import Image from "next/image";
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

// 混雑予測の時間帯ごとの情報
interface CongestionPrediction {
  start_hour: number;
  end_hour: number;
  label: string;
}

// 個々のイベント情報を表す型
interface EventInfo {
  event_name: string | null;
  scale: number;
  reason: string;
  congestion_predictions: CongestionPrediction[];
}

// APIから返される施設ごとのイベントリストの型
interface FacilityWithEvents {
  facility_name: string;
  events: EventInfo[];
}

// 時間帯でグループ化された、表示用のイベント情報
interface GroupedEvent {
  start_hour: number;
  end_hour: number;
  label: string;
  events: {
    venue_name: string;
    event_name: string | null;
    scale: number;
  }[];
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

// --- ヘルパー関数 ---

// 混雑度のスケールに応じて色を返す
const getScaleColor = (scale: number) => {
  if (scale >= 8) return "bg-red-100 text-red-800 border-red-200";
  if (scale >= 5) return "bg-yellow-100 text-yellow-800 border-yellow-200";
  if (scale >= 3) return "bg-blue-100 text-blue-800 border-blue-200";
  return "bg-gray-100 text-gray-800 border-gray-200";
};

// --- コンポーネント ---

export default function VenuesPage() {
  const searchParams = useSearchParams();
  const stationName = searchParams.get("stationName");
  const date = searchParams.get("date");

  const [venueData, setVenueData] = useState<VenueData | null>(null);
  const [eventData, setEventData] = useState<FacilityWithEvents[] | null>(null);
  const [groupedEvents, setGroupedEvents] = useState<GroupedEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCongestedEvents, setHasCongestedEvents] = useState(false);
  const [stationImageUrl, setStationImageUrl] = useState<string | null>(null);

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
      setGroupedEvents([]);
      setStationImageUrl(null);

      // --- Wikipedia画像取得用の関数 ---
      const fetchStationImage = async (
        lat: string,
        lon: string,
        stationName: string,
      ) => {
        let stationPageTitle: string | null = null;

        // 1. 座標から周辺のWikipediaページを検索 (geosearch)
        const geoSearchParams = new URLSearchParams({
          action: "query",
          list: "geosearch",
          gscoord: `${lat}|${lon}`,
          gsradius: "1000", // 1km圏内
          gslimit: "30",
          format: "json",
          origin: "*",
        });
        const geoSearchUrl = `https://ja.wikipedia.org/w/api.php?${geoSearchParams.toString()}`;

        try {
          const geoRes = await fetch(geoSearchUrl);
          if (!geoRes.ok) throw new Error("Wikipedia geosearch failed");
          const geoData = await geoRes.json();
          const pages = geoData.query.geosearch;
          console.log("Wikipedia geosearch results:", pages); // デバッグログ

          // 検索結果から「駅」を含むタイトルを探す
          for (const page of pages) {
            if (page.title.includes("駅")) {
              stationPageTitle = page.title;
              console.log("Found station page title:", stationPageTitle); // デバッグログ
              break;
            }
          }
        } catch (e) {
          console.error("Failed to geosearch Wikipedia", e);
          // geosearchに失敗してもフォールバックがあるので処理を続ける
        }

        // 2. geosearchで見つからなかった場合、駅名で直接検索するフォールバック
        if (!stationPageTitle) {
          console.warn(
            "No station page found via geosearch, falling back to title search.",
          );
          stationPageTitle = stationName.endsWith("駅")
            ? stationName
            : `${stationName}駅`;
        }

        // 3. 見つかったページのタイトルで画像URLを取得
        const imageParams = new URLSearchParams({
          action: "query",
          prop: "pageimages",
          titles: stationPageTitle,
          format: "json",
          pithumbsize: "500",
          origin: "*",
        });
        const imageUrl = `https://ja.wikipedia.org/w/api.php?${imageParams.toString()}`;

        try {
          const imgRes = await fetch(imageUrl);
          if (!imgRes.ok) throw new Error("Wikipedia pageimage fetch failed");
          const imgData = await imgRes.json();
          const imgPages = imgData.query.pages;
          const pageId = Object.keys(imgPages)[0];

          if (pageId !== "-1") {
            const thumbnail = imgPages[pageId].thumbnail;
            if (thumbnail) {
              setStationImageUrl(thumbnail.source);
            }
          } else {
            console.warn(`No image found for title: ${stationPageTitle}`);
          }
        } catch (e) {
          console.error("Failed to fetch station image", e);
        }
      };

      // --- 会場とイベント情報を取得する非同期処理 ---
      const fetchVenueAndEventData = async () => {
        let coords: { lat: string; lon: string } | null = null;
        try {
          // 1. Fetch venues (and coordinates)
          const venueRes = await fetch(
            `/api/search-venues?stationName=${stationName}`,
          );
          if (!venueRes.ok) {
            const errorData = await venueRes.json();
            throw new Error(
              errorData.detail ||
                `会場の検索に失敗しました (HTTP ${venueRes.status})`,
            );
          }
          const venues: VenueData = await venueRes.json();
          setVenueData(venues);
          coords = venues.coordinates; // 座標を取得

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
                station_name: stationName,
              }),
            });

            if (!eventRes.ok) {
              const errorData = await eventRes.json();
              let errorMessage =
                errorData.detail || "イベント情報の取得に失敗しました。";
              if (errorData.error) {
                errorMessage += ` (詳細: ${errorData.error})`;
              }
              setError(errorMessage);
              // setSortedVenues(venues.venue_results.Feature); // 不要なので削除
            } else {
              const eventsData: FacilityWithEvents[] = await eventRes.json();
              setEventData(eventsData);
              // 混雑するイベント（scale >= 5）が1つでも存在するかチェック
              const hasAnyCongestedEvent = eventsData.some((facility) =>
                facility.events.some((event) => event.scale >= 5),
              );
              setHasCongestedEvents(hasAnyCongestedEvent);
            }
          } else {
            setGroupedEvents([]); // イベントがない場合は空にする
          }
        } catch (e: unknown) {
          if (e instanceof Error) {
            setError(e.message || "データの取得に失敗しました。");
          } else {
            setError("データの取得中に不明なエラーが発生しました。");
          }
        }
        return coords; // 座標を返す
      };

      // --- データ取得を実行 ---
      // まず会場情報を取得して座標を得る
      const coordinates = await fetchVenueAndEventData();
      // 座標が得られたら、画像を取得する
      if (coordinates?.lat && coordinates.lon) {
        await fetchStationImage(coordinates.lat, coordinates.lon, stationName);
      }

      setIsLoading(false);
    };

    fetchAllData();
  }, [stationName, date]);

  // This effect handles the data transformation, sorting, and grouping logic.
  useEffect(() => {
    if (!eventData) return;

    const flatEvents = eventData.flatMap((facility) =>
      facility.events.flatMap((event) =>
        event.congestion_predictions.map((prediction) => ({
          ...prediction,
          venue_name: facility.facility_name,
          event_name: event.event_name,
          scale: event.scale,
        })),
      ),
    );

    // 混雑度が高い（scale >= 5）イベントのみフィルタリング
    const filteredEvents = flatEvents.filter((event) => event.scale >= 5);

    // 時間順にソート
    filteredEvents.sort((a, b) => a.start_hour - b.start_hour);

    // 時間帯でグルーピング
    const grouped = filteredEvents.reduce<GroupedEvent[]>((acc, event) => {
      const lastGroup = acc[acc.length - 1];
      if (
        lastGroup &&
        lastGroup.start_hour === event.start_hour &&
        lastGroup.end_hour === event.end_hour &&
        lastGroup.label === event.label
      ) {
        lastGroup.events.push({
          venue_name: event.venue_name,
          event_name: event.event_name,
          scale: event.scale,
        });
      } else {
        acc.push({
          start_hour: event.start_hour,
          end_hour: event.end_hour,
          label: event.label,
          events: [
            {
              venue_name: event.venue_name,
              event_name: event.event_name,
              scale: event.scale,
            },
          ],
        });
      }
      return acc;
    }, []);

    setGroupedEvents(grouped);
  }, [eventData]);

  const renderContent = () => {
    if (isLoading) {
      return <p>周辺の施設とイベント情報を検索中...</p>;
    }

    if (error) {
      return <p className="text-red-500">{error}</p>;
    }

    if (groupedEvents.length === 0) {
      return <p>混雑が予測されるイベントは見つかりませんでした。</p>;
    }

    return (
      <ul className="space-y-3">
        {groupedEvents.map((group, index) => {
          const maxScale = group.events.reduce(
            (max, event) => Math.max(max, event.scale),
            0,
          );
          return (
            <li
              key={index}
              className={`p-4 rounded-lg border ${getScaleColor(maxScale)}`}
            >
              <div className="flex items-baseline">
                <span className="font-bold text-xl">
                  {String(group.start_hour).padStart(2, "0")}:00 -{" "}
                  {String(group.end_hour).padStart(2, "0")}:00
                </span>
                <span className="text-sm ml-2">({group.label})</span>
              </div>
              <ul className="list-disc list-inside mt-2 pl-2 space-y-1">
                {group.events.map((event, eventIndex) => (
                  <li key={eventIndex} className="font-semibold">
                    {event.venue_name} - {event.event_name}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">
        「{stationName}」周辺の施設 ({date})
      </h1>

      {/* Station Image */}
      <div className="relative mb-4 w-full aspect-[16/9] max-h-60 overflow-hidden rounded-md shadow-md">
          {stationImageUrl ? (
            <div className="max-w-xs mx-auto">
              <Image
                src={stationImageUrl}
                alt={stationName}
                width={320}
                height={240}
                className="w-full h-auto rounded-lg shadow-md"
                style={{ objectFit: "contain" }}
              />
            </div>
          ) : (
            <div className="w-full h-48 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500">
              画像なし
            </div>
          )}
      </div>

      {renderContent()}
    </main>
  );
}
