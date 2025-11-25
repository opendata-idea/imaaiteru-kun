"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

// APIレスポンスの型定義 (Yahoo! APIの構造に合わせる)
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

export default function VenuesPage() {
  const searchParams = useSearchParams();
  const stationName = searchParams.get("stationName");

  const [data, setData] = useState<VenueData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!stationName) {
      setError("駅名が指定されていません。");
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
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
        setData(result);
      } catch (e: any) {
        setError(e.message || "データの取得に失敗しました。");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [stationName]);

  const renderContent = () => {
    if (isLoading) {
      return <p>周辺の施設を検索中...</p>;
    }

    if (error) {
      return <p className="text-red-500">{error}</p>;
    }

    if (!data || data.venue_results.ResultInfo.Count === 0) {
      return <p>周辺に該当する施設は見つかりませんでした。</p>;
    }

    return (
      <div>
        <h2 className="text-xl font-semibold mb-2">
          検索結果 ({data.venue_results.ResultInfo.Count}件)
        </h2>
        <ul className="space-y-3">
          {data.venue_results.Feature.map((venue) => (
            <li key={venue.Id} className="p-3 border rounded-md">
              <p className="font-bold">{venue.Name}</p>
              <p className="text-sm">
                {venue.Property?.Address}
              </p>
              <p className="text-xs">
                カテゴリ: {venue.Property?.Genre?.[0]?.Name || "N/A"}
              </p>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <main className="p-4">
      <h1 className="text-
      2xl font-bold mb-4">
        「{stationName}」周辺の施設
      </h1>
      {renderContent()}
    </main>
  );
}
