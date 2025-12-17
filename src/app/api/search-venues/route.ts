import { type NextRequest, NextResponse } from "next/server";

// --- .envから設定を読み込む ---
const CLIENT_ID = process.env.YAHOO_CLIENT_ID;

// --- APIのエンドポイント  ---
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const LOCAL_SEARCH_URL = "https://map.yahooapis.jp/search/local/V1/localSearch";
const VENUE_GC_CODES = "0301002,0301003,0301013,0303001,0305004";

interface YahooVenueFeature {
  Id: string;
  Name: string;
  Property?: {
    Address?: string;
    Genre?: {
      Name: string;
    }[];
  };
}

interface ProcessedVenueFeature extends YahooVenueFeature {
  Category: string;
}

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
    return NextResponse.json({ detail: "サーバー設定エラー" }, { status: 500 });
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

  // 3. Yahoo! APIのレスポンスを加工する
  const originalFeatures = venueData.Feature || [];

  // 3-1. カテゴリで除外 (追加の必要あり)
  const EXCLUDED_CATEGORIES = new Set([
    "スポーツクラブ",
    "スポーツショップ",
    "ゴルフ場",
    "ゴルフ練習場",
    "趣味、習い事",
    "ファッション、アクセサリー、時計",
    "ゲームセンター",
    "農林水産団体",
    "スポーツ教室",
    "市区町村機関"
  ]);
  const categoryFilteredFeatures = originalFeatures.filter(
    (venue: YahooVenueFeature) => {
      const categoryName = venue.Property?.Genre?.[0]?.Name;
      return !categoryName || !EXCLUDED_CATEGORIES.has(categoryName);
    },
  );

  // 3-2. 名称で重複を削除
  const uniqueNames = new Set<string>();
  const deduplicatedFeatures: ProcessedVenueFeature[] = [];
  for (const venue of categoryFilteredFeatures) {
    // 名前の主要部分（スペースや特定部署名より前）を抽出
    const baseName = venue.Name.split(" ")[0].split("　")[0];
    if (!uniqueNames.has(baseName)) {
      uniqueNames.add(baseName);
      deduplicatedFeatures.push({
        ...venue,
        Category: venue.Property?.Genre?.[0]?.Name || "", // カテゴリ情報を追加
      });
    }
  }

  // 4. Reactに返す情報をまとめる
  const processedVenueResults = {
    ...venueData,
    ResultInfo: {
      ...venueData.ResultInfo,
      Count: deduplicatedFeatures.length, // 件数を更新
    },
    Feature: deduplicatedFeatures,
  };

  return NextResponse.json({
    search_station: displayName,
    coordinates: { lat: lat, lon: lon },
    venue_results: processedVenueResults,
  });
}
