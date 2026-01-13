import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
} from "@google/generative-ai";
import { type NextRequest, NextResponse } from "next/server";
import { fetchStationPassengerData } from "@/lib/passengerSurvey";

const API_KEY = process.env.GEMINI_API_KEY;

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

const SYSTEM_PROMPT = `
あなたは施設のイベント来場者予測AIです。Google検索を使用し、入力情報に基づき以下のJSON形式のみを出力してください。Markdownは不要です。

### ルール
1. **検索の最適化**: 複数の施設を調査する場合、個別に検索するのではなく、できるだけ1回のGoogle検索で済むようにクエリを工夫してください。例えば、「(施設名1 OR 施設名2) YYYY年MM月DD日 イベント」のように、OR演算子を使って検索をまとめてください。
2. **イベント特定**: 各施設のイベントを調査。複数ある場合は全て列挙。イベントがない場合は空の配列を出力。
3. **来場者数予測**: イベントの推定来場者数を予測し、数値で出力してください。
4. **ピーク算出**: 開始1-2時間前を「開場前」、終了0-1時間後を「終演後」として24時間制数値で出力。

### 出力スキーマ
[
  {
    "facility_name": "string",
    "events": [
      {
        "event_name": "string",
        "estimated_attendees": number,
        "congestion_predictions": [
          { "start_hour": number, "end_hour": number, "label": "開場前" },
          { "start_hour": number, "end_hour": number, "label": "終演後" }
        ]
      }
    ]
  }
]
`;

const model = genAI
  ? genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      tools: [{ google_search: {} }],
      systemInstruction: SYSTEM_PROMPT,
    })
  : null;

const _safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

export async function POST(request: NextRequest) {
  if (!genAI || !model) {
    console.error("GEMINI_API_KEY is not configured.");
    return NextResponse.json(
      { detail: "サーバー側でAPIキーが設定されていません。" },
      { status: 500 },
    );
  }

  let target_date: string, facility_list: string[], station_name: string, station_id: string;
  try {
    const body = await request.json();
    target_date = body.target_date;
    facility_list = body.facility_list;
    station_name = body.station_name;
    station_id = body.station_id;

    if (!target_date || !facility_list || !Array.isArray(facility_list) || !station_name || !station_id) {
      return NextResponse.json({ detail: "target_date, facility_list, station_name, and station_id are required." }, { status: 400 });
    }
  } catch (_error) {
    return NextResponse.json({ detail: "Invalid JSON in request body." }, { status: 400 });
  }

  try {
    // Step 1: 乗降者数データを取得
    const stationPassengerMap = await fetchStationPassengerData();
    
    // station_id を使って乗降者数を直接取得
    const dailyBoardingPassengers = stationPassengerMap.get(station_id) || 25000; // デフォルト値も半分に
    if (dailyBoardingPassengers === 25000) {
        console.warn(`Passenger data not found for station ID: ${station_id}. Using default of 25000.`);
    }
    // 乗車人員と降車人員を考慮し、総乗降客数を2倍として概算する
    const stationPassengers = dailyBoardingPassengers * 2;

    // Step 2: Gemini APIでイベント情報と推定来場者数を取得
    const prompt = `
### 入力
- 駅: ${station_name}
- 日付: ${target_date}
- 施設: ${JSON.stringify(facility_list)}
`;
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    console.log("Gemini API Raw Response:", responseText);

    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
    const cleanedText = jsonMatch ? jsonMatch[1] : responseText;
    if (!cleanedText.trim()) {
      // 空の応答が返ってきた場合は、イベントなしとして扱う
      return NextResponse.json([]);
    }
    const rawEventsData = JSON.parse(cleanedText);
    const eventsInput = Array.isArray(rawEventsData) ? rawEventsData : [rawEventsData];

    const finalResponse = eventsInput.map(facility => {
        if (!facility.events) return { ...facility, events: [] };

        const newEvents = facility.events.map(event => {
            const attendees = event.estimated_attendees || 0;
            let scale = 1;
            
            // 時間帯を考慮した駅利用者数を計算
            let weightedPassengers = 0;
            const timeZones = [
              { start: 7, end: 10, ratio: 0.12 },  // 朝ラッシュ
              { start: 10, end: 17, ratio: 0.05 }, // 昼間
              { start: 17, end: 20, ratio: 0.12 }, // 夕ラッシュ
              { start: 20, end: 24, ratio: 0.05 }, // 夜
              { start: 0, end: 7, ratio: 0.01 },   // 早朝・深夜
            ];

            // イベントの各ピーク時間帯について計算
            for (const prediction of event.congestion_predictions) {
                const eventStart = prediction.start_hour;
                const eventEnd = prediction.end_hour;
                let peakWeightedPassengers = 0;

                for (const zone of timeZones) {
                    const overlapStart = Math.max(eventStart, zone.start);
                    const overlapEnd = Math.min(eventEnd, zone.end);
                    const overlapDuration = Math.max(0, overlapEnd - overlapStart);

                    if (overlapDuration > 0) {
                        const zoneDuration = zone.end - zone.start;
                        if (zoneDuration > 0) {
                            const passengersPerHourInZone = (stationPassengers * zone.ratio) / zoneDuration;
                            peakWeightedPassengers += passengersPerHourInZone * overlapDuration;
                        }
                    }
                }
                // 複数のピーク時間帯がある場合、最大のものを採用
                weightedPassengers = Math.max(weightedPassengers, peakWeightedPassengers);
            }

            const ratio = weightedPassengers > 0 ? attendees / weightedPassengers : 0;

            // 判定ロジックは維持
            if (ratio > 0.5 || attendees > 50000) {
                scale = 10;
            } else if (ratio > 0.2 || attendees > 10000) {
                scale = 8;
            } else if (ratio > 0.05) {
                scale = 5;
            } else if (attendees > 0) {
                scale = 3;
            }

            return {
                ...event,
                scale: scale,
                reason: `来場者予測:${attendees}人 / 駅利用者(時間帯考慮):${Math.round(weightedPassengers)}人`,
            };
        });
        return { ...facility, events: newEvents };
    });

    return NextResponse.json(finalResponse);

  } catch (error: any) {
    console.error("Error in POST /api/events:", error);
    // JSONパースエラーの場合も考慮
    if (error instanceof SyntaxError) {
        return NextResponse.json({ detail: "Gemini APIからの応答が不正なJSON形式でした。" }, { status: 500 });
    }
    return NextResponse.json(
      {
        detail: error.message || "An unknown error occurred.",
        error: error.toString(),
      },
      { status: 500 },
    );
  }
}