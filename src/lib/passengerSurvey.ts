// 型定義
type PassengerSurveyObject = {
  "odpt:surveyYear": number;
  "odpt:passengerJourneys": number;
};

type PassengerSurveyResponse = {
  "@id": string;
  "owl:sameAs": string;
  "odpt:station": string[];
  "odpt:passengerSurveyObject": PassengerSurveyObject[];
}[];

// 駅IDをキー、乗降者数を値とするマップ
export type StationPassengerData = Map<string, number>;

const API_KEY = process.env.ODPT_CONSUMER_KEY;

/**
 * ODPT APIからJR東日本の乗降者数データを取得し、
 * 駅IDをキー、最新の乗降者数を値とするMapを生成する。
 */
export async function fetchStationPassengerData(): Promise<StationPassengerData> {
  if (!API_KEY) {
    console.error("ODPT_CONSUMER_KEY is not configured.");
    // 本番環境ではエラーを投げるか、空のMapを返す
    return new Map();
  }

  const url = `https://api-challenge.odpt.org/api/v4/odpt:PassengerSurvey?odpt:operator=odpt.Operator:JR-East&acl:consumerKey=${API_KEY}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch passenger survey data: ${response.statusText}`);
      return new Map();
    }
    const surveyData: PassengerSurveyResponse = await response.json();

    const stationPassengerMap: StationPassengerData = new Map();

    for (const stationData of surveyData) {
      if (!stationData["odpt:passengerSurveyObject"] || stationData["odpt:passengerSurveyObject"].length === 0) {
        continue;
      }
      
      // 最新の乗降者数情報を取得
      const latestSurvey = stationData["odpt:passengerSurveyObject"].reduce(
        (latest, current) => {
          return current["odpt:surveyYear"] > latest["odpt:surveyYear"] ? current : latest;
        }
      );

      if (latestSurvey["odpt:passengerJourneys"] > 0) {
        // 複数の駅IDが含まれる場合があるため、それぞれに登録
        for (const stationId of stationData["odpt:station"]) {
          stationPassengerMap.set(stationId, latestSurvey["odpt:passengerJourneys"]);
        }
      }
    }
    
    return stationPassengerMap;

  } catch (error) {
    console.error("Error fetching or processing passenger survey data:", error);
    return new Map();
  }
}
