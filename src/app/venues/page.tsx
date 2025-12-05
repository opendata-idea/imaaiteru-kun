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

interface EventInfo {
  facility_name: string;
  event_name: string | null;
  scale: number;
  reason: string;
}

// Combined type for sorting
type SortedVenue = Venue & { event?: EventInfo };

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
  const [sortedVenues, setSortedVenues] = useState<SortedVenue[]>([]);
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
      setSortedVenues([]);
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
          gslimit: "20",
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
              setSortedVenues(venues.venue_results.Feature);
            } else {
              const events: EventInfo[] = await eventRes.json();
              const filteredEvents = events.filter((event) => event.scale >= 5);
              setEventData(filteredEvents);
              setHasCongestedEvents(filteredEvents.length > 0);
            }
          } else {
            setSortedVenues([]);
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

  // This effect handles the sorting logic whenever venue or event data changes.
  useEffect(() => {
    if (!venueData) return;

    const combined = venueData.venue_results.Feature.map(
      (venue): SortedVenue => {
        const event = eventData?.find((e) => e.facility_name === venue.Name);
        return { ...venue, event };
      },
    );

    combined.sort((a, b) => {
      const scaleA = a.event?.scale ?? 0;
      const scaleB = b.event?.scale ?? 0;
      return scaleB - scaleA;
    });

    setSortedVenues(combined);
  }, [venueData, eventData]);

  const renderContent = () => {
    if (isLoading) {
      return <p>周辺の施設とイベント情報を検索中...</p>;
    }

    if (error && sortedVenues.length === 0) {
      return <p className="text-red-500">{error}</p>;
    }

    if (sortedVenues.length === 0) {
      return <p>周辺に該当する施設は見つかりませんでした。</p>;
    }

    // If venues were found, but no congested events (scale >= 5) were found among them
    if (venueData && !hasCongestedEvents) {
      return <p>混雑が予測されるイベントは見つかりませんでした。</p>;
    }

    return (
      <div>
        {error && !eventData && (
          <p className="text-red-500 my-4">
            イベント情報の取得中にエラーが発生しました: {error}
          </p>
        )}
        <ul className="space-y-3">
          {sortedVenues.map((venue) => {
            const { event } = venue;
            // Only render venues that have a congested event associated with them
            if (event) {
              // 'event' here will only exist if scale >= 5 due to filtering
              return (
                <li key={venue.Id} className="p-3 border rounded-md">
                  <p className="font-bold">{venue.Name}</p>
                  <p className="text-sm">{venue.Property?.Address}</p>
                  <p className="text-xs mb-2">
                    カテゴリ: {venue.Property?.Genre?.[0]?.Name || "N/A"}
                  </p>
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
                </li>
              );
            }
            return null; // Don't render venues without congested events
          })}
        </ul>
      </div>
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
          <Image
            src={stationImageUrl}
            alt={`${stationName}駅の画像`}
            fill
            style={{ objectFit: "contain" }}
            priority // 画像がLCPになる可能性が高いため、優先的に読み込む
          />
        ) : (
          // Placeholder to prevent layout shift
          <div className="w-full h-full bg-gray-200 animate-pulse" />
        )}
      </div>

      {renderContent()}
    </main>
  );
}
