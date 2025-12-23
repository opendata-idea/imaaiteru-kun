"use client";

import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import LoadingScreen from "@/components/LoadingScreen";

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
  totalScale: number;
  eventCount: number;
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

export default function VenuesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const stationName = searchParams.get("stationName");
  const date = searchParams.get("date");

  const [venueData, setVenueData] = useState<VenueData | null>(null);
  const [eventData, setEventData] = useState<FacilityWithEvents[] | null>(null);
  const [groupedEvents, setGroupedEvents] = useState<GroupedEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCongestedEvents, setHasCongestedEvents] = useState(false);
  const [stationImageUrl, setStationImageUrl] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupedEvent | null>(null);
  const [progressMessage, setProgressMessage] = useState("");

  useEffect(() => {
    if (!stationName || !date) {
      setError("駅名と日付が指定されていません。");
      setIsLoading(false);
      return;
    }

    const fetchAllData = async () => {
      setIsLoading(true);
      setProgressMessage("準備中...");
      setError(null);
      setVenueData(null);
      setEventData(null);
      setGroupedEvents([]);
      setStationImageUrl(null);

      try {
        // 1. まず会場情報を取得して、後続処理に必要な座標と施設リストを得る
        setProgressMessage("周辺の施設を検索しています...");
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
        const venuesData: VenueData = await venueRes.json();
        setVenueData(venuesData);

        const { coordinates } = venuesData;
        const venueFeatures = venuesData.venue_results.Feature;

        // 2. イベント情報取得と画像取得を並列で実行
        const eventPromise = (async () => {
          setProgressMessage("イベント情報を分析し、混雑を予測しています... (AI)");
          if (venueFeatures.length === 0) {
            setEventData([]); // 会場がなければイベントもない
            return;
          }

          const facilityList = venueFeatures.map((venue) => venue.Name);
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
            throw new Error(errorMessage); // Promise.allでキャッチさせる
          }

          const eventsData: FacilityWithEvents[] = await eventRes.json();
          setEventData(eventsData);
          const hasAnyCongestedEvent = eventsData.some((facility) =>
            facility.events.some((event) => event.scale >= 5),
          );
          setHasCongestedEvents(hasAnyCongestedEvent);
        })();

        const imagePromise = (async () => {
          if (!coordinates?.lat || !coordinates.lon) {
            return; // 座標がなければ何もしない
          }

          let stationPageTitle: string | null = null;
          const { lat, lon } = coordinates;

          // 2-1. 座標から周辺のWikipediaページを検索 (geosearch)
          const geoSearchParams = new URLSearchParams({
            action: "query",
            list: "geosearch",
            gscoord: `${lat}|${lon}`,
            gsradius: "1000",
            gslimit: "30",
            format: "json",
            origin: "*",
          });
          const geoSearchUrl = `https://ja.wikipedia.org/w/api.php?${geoSearchParams.toString()}`;

          try {
            const geoRes = await fetch(geoSearchUrl);
            if (geoRes.ok) {
              const geoData = await geoRes.json();
              const pages = geoData.query.geosearch;

              // 優先度1: stationNameと完全に一致するタイトルを探す (例: "東京駅")
              const exactMatchTitle = stationName.endsWith("駅") ? stationName : `${stationName}駅`;
              for (const page of pages) {
                if (page.title === exactMatchTitle) {
                  stationPageTitle = page.title;
                  break;
                }
              }

              // 優先度2: stationNameを含み、かつ「駅」を含むタイトルを探す (例: "東京駅 (JR)")
              if (!stationPageTitle) {
                for (const page of pages) {
                  if (page.title.includes(stationName) && page.title.includes("駅")) {
                    stationPageTitle = page.title;
                    break;
                  }
                }
              }

              // 優先度3: 「駅」を含むタイトルを探す (既存のロジック)
              if (!stationPageTitle) {
                for (const page of pages) {
                  if (page.title.includes("駅")) {
                    stationPageTitle = page.title;
                    break;
                  }
                }
              }
            }
          } catch (e) {
            console.error("Failed to geosearch Wikipedia", e);
          }

          // 2-2. 見つかったページのタイトルから画像を取得
          if (stationPageTitle) {
            const imgParams = new URLSearchParams({
              action: "query",
              titles: stationPageTitle,
              prop: "pageimages",
              pithumbsize: "500",
              format: "json",
              origin: "*",
            });
            const imgUrl = `https://ja.wikipedia.org/w/api.php?${imgParams.toString()}`;

            try {
              const imgRes = await fetch(imgUrl);
              const imgData = await imgRes.json();
              const imgPages = imgData.query.pages;
              const pageId = Object.keys(imgPages)[0];
              if (pageId !== "-1") {
                const thumbnail = imgPages[pageId].thumbnail;
                if (thumbnail) {
                  setStationImageUrl(thumbnail.source);
                }
              }
            } catch (e) {
              console.error("Failed to fetch station image", e);
            }
          }
        })();

        // 両方の処理が終わるのを待つ
        await Promise.all([eventPromise, imagePromise]);
        setProgressMessage("完了！");
      } catch (e: unknown) {
        if (e instanceof Error) {
          setError(e.message || "データの取得に失敗しました。");
        } else {
          setError("データの取得中に不明なエラーが発生しました。");
        }
        setProgressMessage("エラーが発生しました");
      } finally {
        // 完了またはエラーメッセージを少しの間表示させる
        setTimeout(() => {
          setIsLoading(false);
        }, 500);
      }
    };

    fetchAllData();
  }, [stationName, date]);

  // This effect handles the data transformation, sorting, and grouping logic.
  useEffect(() => {
    if (!eventData || !Array.isArray(eventData)) return;

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

    // 時間帯でグルーピングし、混雑度を合算
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
        lastGroup.totalScale = Math.min(10, lastGroup.totalScale + event.scale);
        lastGroup.eventCount += 1;
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
          totalScale: event.scale,
          eventCount: 1,
        });
      }
      return acc;
    }, []);

    setGroupedEvents(grouped);
  }, [eventData]);

  const renderContent = () => {
    if (isLoading) {
      return <LoadingScreen message={progressMessage} />;
    }

    if (error) {
      return <p className="text-red-500">{error}</p>;
    }

    if (groupedEvents.length === 0) {
      return <p>混雑が予測されるイベントは見つかりませんでした。</p>;
    }

    const HOUR_HEIGHT = 50; // 1時間あたりの高さ（ピクセル）
    const START_HOUR = 5;
    const END_HOUR = 24;

    return (
      // --- 全体を固定高のスクロールコンテナで囲む ---
      <div className="max-h-[600px] overflow-y-auto border rounded-lg max-w-md mx-auto">
        <div className="relative flex">
          {/* 時間軸 */}
          <div className="w-16 text-right pr-2 pt-2">
            {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => (
              <div
                key={i}
                className="text-xs text-gray-500"
                style={{ height: `${HOUR_HEIGHT}px` }}
              >
                {String(START_HOUR + i).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* タイムライン本体 */}
          <div
            className="relative flex-1 border-l border-gray-200"
            style={{
              height: `${(END_HOUR - START_HOUR + 1) * HOUR_HEIGHT}px`,
            }}
          >
            {/* 時間区切りの線 */}
            {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => (
              <div
                key={i}
                className="absolute w-full border-t border-gray-200"
                style={{ top: `${i * HOUR_HEIGHT}px` }}
              />
            ))}

            {/* イベントブロック */}
            {groupedEvents.map((group, index) => {
              const top = (group.start_hour - START_HOUR) * HOUR_HEIGHT;
              // 最低でも30分の高さは確保する
              const height = Math.max(
                (group.end_hour - group.start_hour) * HOUR_HEIGHT,
                HOUR_HEIGHT / 2,
              );
              const bgColor = getScaleColor(group.totalScale);

              return (
                <div
                  key={index}
                  className={`absolute left-2 p-2 rounded-md border ${bgColor} overflow-hidden cursor-pointer hover:opacity-80 w-[calc(100%-1rem)]`}
                  style={{
                    top: `${top}px`,
                    height: `${height - 4}px`, // paddingとborder分を引く
                    lineHeight: "1.2",
                  }}
                  onClick={() => {
                    setSelectedGroup(group);
                    setIsModalOpen(true);
                  }}
                >
                  <div className="font-bold text-xs">
                    混雑度: {group.totalScale}/10
                  </div>
                  <div className="text-xs truncate">
                    {group.eventCount === 1
                      ? group.events[0].event_name
                      : `${group.eventCount}件のイベント`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <main className="p-4">
        {/* 戻るボタン */}
        <button
          onClick={() => router.back()}
          className="mb-4 flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
              clipRule="evenodd"
            />
          </svg>
          戻る
        </button>

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

      {/* Modal Window */}
      {isModalOpen && selectedGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-25 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-lg w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-black">
                {String(selectedGroup.start_hour).padStart(2, "0")}:00 -{" "}
                {String(selectedGroup.end_hour).padStart(2, "0")}:00 のイベント
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 hover:text-gray-800"
              >
                &times;
              </button>
            </div>
            <ul className="space-y-2">
              {selectedGroup.events.map((event, index) => (
                <li key={index} className="border-b pb-2">
                  <p className="font-semibold text-black">
                    {event.venue_name} - {event.event_name}
                  </p>
                  <p className="text-sm text-black">
                    混雑度: {event.scale}/10
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}