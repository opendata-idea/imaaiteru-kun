"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Truck from "@/components/Truck";

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

// --- コンポーネント ---

const ProgressBar = ({
  progress,
  message,
}: {
  progress: number;
  message: string;
}) => (
  <div className="w-full max-w-md mx-auto">
    <div className="bg-pink-50 rounded-lg p-5 border border-pink-200 shadow-sm">
      <p className="text-center text-sm text-gray-600 mb-3">{message}</p>
      <div className="w-full bg-white rounded-full h-2.5 border border-pink-200">
        <div
          className="bg-pink-400 h-2.5 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-center text-xs text-gray-500 mt-3">{progress}%</p>
    </div>
  </div>
);

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupedEvent | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");

  useEffect(() => {
    if (!stationName || !date) {
      setError("駅名と日付が指定されていません。");
      setIsLoading(false);
      return;
    }

    const fetchAllData = async () => {
      setIsLoading(true);
      setProgress(0);
      setProgressMessage("準備中...");
      setError(null);
      setVenueData(null);
      setEventData(null);
      setGroupedEvents([]);
      setStationImageUrl(null);

      try {
        // 1. まず会場情報を取得して、後続処理に必要な座標と施設リストを得る
        setProgress(10);
        setProgressMessage("周辺の施設を検索しています...");
        const venueRes = await fetch(
          `/api/search-venues?stationName=${stationName}`
        );
        if (!venueRes.ok) {
          const errorData = await venueRes.json();
          throw new Error(
            errorData.detail ||
              `会場の検索に失敗しました (HTTP ${venueRes.status})`
          );
        }
        const venuesData: VenueData = await venueRes.json();
        setVenueData(venuesData);
        setProgress(30);

        const { coordinates } = venuesData;
        const venueFeatures = venuesData.venue_results.Feature;

        // 2. イベント情報取得と画像取得を並列で実行
        const eventPromise = (async () => {
          setProgressMessage(
            "イベント情報を分析し、混雑を予測しています... (AI)"
          );
          if (venueFeatures.length === 0) {
            setEventData([]); // 会場がなければイベントもない
            setProgress((p) => p + 60); // このステップの分の進捗を加算
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
            facility.events.some((event) => event.scale >= 5)
          );
          setHasCongestedEvents(hasAnyCongestedEvent);
          setProgress((p) => p + 60); // AI処理が重いので60%分
        })();

        const imagePromise = (async () => {
          if (!coordinates?.lat || !coordinates.lon) {
            setProgress((p) => p + 10); // このステップの分の進捗を加算
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
              const exactMatchTitle = stationName.endsWith("駅")
                ? stationName
                : `${stationName}駅`;
              for (const page of pages) {
                if (page.title === exactMatchTitle) {
                  stationPageTitle = page.title;
                  break;
                }
              }

              // 優先度2: stationNameを含み、かつ「駅」を含むタイトルを探す (例: "東京駅 (JR)")
              if (!stationPageTitle) {
                for (const page of pages) {
                  if (
                    page.title.includes(stationName) &&
                    page.title.includes("駅")
                  ) {
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

          // 2-2. geosearchで見つからなかった場合、駅名で直接検索
          if (!stationPageTitle) {
            stationPageTitle = stationName.endsWith("駅")
              ? stationName
              : `${stationName}駅`;
          }

          // 2-3. 見つかったページのタイトルで画像URLを取得
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
            if (imgRes.ok) {
              const imgData = await imgRes.json();
              const imgPages = imgData.query.pages;
              const pageId = Object.keys(imgPages)[0];
              if (pageId !== "-1") {
                const thumbnail = imgPages[pageId].thumbnail;
                if (thumbnail) {
                  setStationImageUrl(thumbnail.source);
                }
              }
            }
          } catch (e) {
            console.error("Failed to fetch station image", e);
          }
          setProgress((p) => p + 10); // 画像取得分として10%
        })();

        // 両方の処理が終わるのを待つ
        await Promise.all([eventPromise, imagePromise]);
        setProgressMessage("完了！");
        setProgress(100);
      } catch (e: unknown) {
        if (e instanceof Error) {
          setError(e.message || "データの取得に失敗しました。");
        } else {
          setError("データの取得中に不明なエラーが発生しました。");
        }
        setProgress(100); // エラー時もバーを100%にして終了を示す
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
        }))
      )
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
      return (
        <div className="py-10">
          <div className="mb-4">
            <Truck compact />
          </div>
          <ProgressBar progress={progress} message={progressMessage} />
        </div>
      );
    }

    if (error) {
      return (
        <div className="max-w-md mx-auto">
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            <div className="font-bold mb-2">❌ エラーが発生しました</div>
            <pre className="text-sm whitespace-pre-wrap">{error}</pre>
          </div>
        </div>
      );
    }

    if (groupedEvents.length === 0) {
      return (
        <div className="max-w-md mx-auto">
          <div className="bg-pink-50 rounded-lg p-6 border border-pink-200 text-center text-gray-600">
            <p className="mb-2">
              🎉 混雑が予測されるイベントは見つかりませんでした
            </p>
            <p className="text-sm">この日は比較的空いている可能性があります</p>
          </div>
        </div>
      );
    }

    const HOUR_HEIGHT = 50; // 1時間あたりの高さ（ピクセル）
    const START_HOUR = 5;
    const END_HOUR = 24;

    return (
      // --- 全体を固定高のスクロールコンテナで囲む ---
      <div className="max-w-md mx-auto">
        <div className="max-h-[600px] overflow-y-auto border border-pink-200 rounded-lg bg-white shadow-sm">
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
                  HOUR_HEIGHT / 2
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
      </div>
    );
  };

  return (
    <>
      <div className="min-h-screen bg-white flex flex-col">
        {/* ヘッダー */}
        <div className="px-4 pt-6">
          <Link
            href="/"
            className="text-pink-500 hover:text-pink-700 mb-4 inline-block"
          >
            ← 戻る
          </Link>

          {/* Station Image */}
          <div className="max-w-md mx-auto rounded-lg">
            <div className="relative w-full h-52 sm:h-60 overflow-hidden rounded-lg bg-white">
              {stationImageUrl ? (
                <div className="absolute inset-0">
                  <Image
                    src={stationImageUrl}
                    alt={stationName || "station"}
                    width={500}
                    height={320}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
                  画像なし
                </div>
              )}
            </div>
            <div className="pt-5 px-2 text-2xl font-bold text-gray-700">
              {stationName}駅
            </div>
          </div>
        </div>

        {/* 本文 */}
        <main className="flex-1 px-6 py-2 space-y-2">
          <div className="flex border-b">
            <div className="text-black text-sm flex-1 py-3 text-start font-medium">
              イベント情報
            </div>
            <div className="text-black text-sm flex-1 py-3 text-start font-medium">
              運行情報
            </div>
          </div>

          <div className="flex items-center justify-start gap-3 pt-3">
            <h1 className="text-black text-xl font-bold">イベント情報</h1>
          </div>

          <div className="text-start text-sm text-gray-600">{date}</div>

          {/* タイムライン / 状態表示 */}
          <div className="max-w-md mx-auto rounded-lg pt-3">
            <div className="text-sm font-medium text-gray-700 mb-3">
              混雑が予測される時間帯
            </div>
            {renderContent()}
            {/* AIによる予測に関する注意書き */}
            <div className="mt-6 p-4 text-xs text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
              <p className="font-semibold mb-1">【ご注意】</p>
              <ul className="list-disc list-inside space-y-1">
                <li>この情報はAIによる予測を含みます。</li>
                <li>常に同じ結果が出るとは限りません。</li>
                <li>予測やイベント表示が実際と異なる場合があります。</li>
                <li>あくまで参考情報としてご利用ください。</li>
              </ul>
            </div>
          </div>
        </main>

        {/* 広告バナー */}
        <div className="bg-linear-to-r from-red-500 via-green-500 to-purple-500 text-white text-center py-4 font-bold">
          1ヶ月で15kg痩せるサプリ!!!
        </div>
        <div className="bg-linear-to-r from-red-500 via-green-500 to-purple-500 text-white text-center py-4 font-bold">
          1ヶ月で１００万円稼ぐ方法!!!
        </div>
      </div>

      {/* Modal Window */}
      {isModalOpen && selectedGroup && (
        <div className="fixed inset-0 bg-black/30 flex justify-center items-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-lg w-full border border-pink-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-black">
                {String(selectedGroup.start_hour).padStart(2, "0")}:00 -{" "}
                {String(selectedGroup.end_hour).padStart(2, "0")}:00 のイベント
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 hover:text-pink-600"
              >
                &times;
              </button>
            </div>
            <ul className="space-y-2">
              {selectedGroup.events.map((event, index) => (
                <li
                  key={index}
                  className="border-b border-pink-100 pb-2 last:border-b-0"
                >
                  <p className="font-semibold text-black">
                    {event.venue_name} - {event.event_name}
                  </p>
                  <p className="text-sm text-black">混雑度: {event.scale}/10</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
