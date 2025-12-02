import { NextRequest, NextResponse } from "next/server";

// --- .envから設定を読み込む ---
const CLIENT_ID = process.env.YAHOO_CLIENT_ID;

// --- APIのエンドポイント  ---
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const LOCAL_SEARCH_URL = "https://map.yahooapis.jp/search/local/V1/localSearch";
const VENUE_GC_CODES = "0301002,0301003,0301013,0303001,0305004";

// --- 内部で使う関数 ---

async function getStationCoordinates(stationName: string) {
  const params = new URLSearchParams({
    q: stationName,
    countrycodes: "jp",
    format: "jsonv2",
    limit: "1",
  });
  const url = `${NOMINATIM_URL}?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "ImaAiteruKun-App/1.0" },
    });
    if (!response.ok) throw new Error("Nominatim API request failed");

    const data = await response.json();
    if (data && data.length > 0) {
      const result = data[0];
      return {
        lat: result.lat,
        lon: result.lon,
        displayName: result.display_name,
      };
    }
    return { lat: null, lon: null, displayName: null };
  } catch (error) {
    console.error(`Nominatim APIエラー: ${error}`);
    return { lat: null, lon: null, displayName: null };
  }
}

async function searchEventVenues(clientId: string, lat: string, lon: string) {
  const params = new URLSearchParams({
    appid: clientId,
    lat: lat,
    lon: lon,
    gc: VENUE_GC_CODES,
    dist: "2.5",
    results: "100",
    sort: "dist",
    output: "json",
  });
  const url = `${LOCAL_SEARCH_URL}?${params.toString()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Yahoo! API request failed");
    return await response.json();
  } catch (error) {
    console.error(`Yahoo! APIエラー (会場検索): ${error}`);
    return null;
  }
}

// --- Next.js API Route Handler ---

export async function GET(request: NextRequest) {
  if (!CLIENT_ID) {
    console.error("エラー: 環境変数に YAHOO_CLIENT_ID を設定してください。");
    return NextResponse.json(
      { detail: "サーバー設定エラー" },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(request.url);
  const station = searchParams.get("stationName");

  if (!station || station.length < 2) {
    return NextResponse.json(
      { detail: "駅名(stationName)をクエリパラメータで指定してください。" },
      { status: 400 },
    );
  }

  // 1. 駅名から緯度・経度を取得
  const { lat, lon, displayName } = await getStationCoordinates(station);

  if (!lat || !lon) {
    return NextResponse.json(
      { detail: `「${station}」の座標が見つかりません。` },
      { status: 404 },
    );
  }

  // 2. 緯度・経度からイベント会場を検索
  const venueData = await searchEventVenues(CLIENT_ID, lat, lon);

  if (!venueData) {
    return NextResponse.json(
      { detail: "Yahoo! APIでの会場検索中にエラーが発生しました。" },
      { status: 500 },
    );
  }

  // 3. Reactに返す情報をまとめる
  // Yahoo! APIのレスポンスからカテゴリ情報を抽出し、フロントエンドの型に合わせる
  const processedVenueResults = {
    ...venueData,
    Feature: venueData.Feature.map((venue: any) => ({
      ...venue,
      Category: venue.Property?.Genre?.[0]?.Name || "", // カテゴリ情報を追加
    })),
  };

  return NextResponse.json({
    search_station: displayName,
    coordinates: { lat: lat, lon: lon },
    venue_results: processedVenueResults,
  });
}
