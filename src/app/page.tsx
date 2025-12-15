// src/app/page.tsx (修正版)
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Yuji_Mai } from 'next/font/google';

const yujiMai = Yuji_Mai({
  weight: '400',
  subsets: ['latin'],
});

type RailwayOption = {
  label: string;
  value: string;
  color?: string;
  code?: string;
};

type StationOption = {
  label: string;
  value: string;
};

type VenueFeature = {
  Name: string;
  Property?: {
    Address?: string;
    Genre?: Array<{ Name: string }>;
  };
  Geometry?: {
    Coordinates: string;
  };
  Category?: string;
};

type EventInfo = {
  facility_name: string;
  event_name: string | null;
  scale: number;
  reason: string;
};

type SearchResult = {
  search_station: string;
  coordinates: { lat: string; lon: string };
  venue_results: {
    ResultInfo: { Count: number; Total: number };
    Feature: VenueFeature[];
  };
};

export default function Home() {
  const [month, setMonth] = useState<number | null>(null);
  const [day, setDay] = useState<number | null>(null);
  const [railways, setRailways] = useState<RailwayOption[]>([]);
  const [stations, setStations] = useState<StationOption[]>([]);
  const [selectedRailway, setSelectedRailway] = useState<RailwayOption | null>(null);
  const [selectedStation, setSelectedStation] = useState<StationOption | null>(null);
  const [showRailwayDropdown, setShowRailwayDropdown] = useState(false);
  const [showStationDropdown, setShowStationDropdown] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth() + 1);
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [eventInfo, setEventInfo] = useState<EventInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingRailways, setIsLoadingRailways] = useState(false);
  const [isLoadingStations, setIsLoadingStations] = useState(false);
  const [activeTab, setActiveTab] = useState<'event' | 'transit'>('event');

  // 路線データを取得（修正版）
  useEffect(() => {
    const fetchRailways = async () => {
      setIsLoadingRailways(true);
      setError(null);
      
      console.log('🔍 路線データ取得開始...');
      
      try {
        const response = await fetch('/api/railways');
        
        console.log('📡 レスポンスステータス:', response.status);
        console.log('📡 レスポンスOK:', response.ok);
        
        // ✅ 修正: 先にテキストとして読み込む
        const responseText = await response.text();
        console.log('📄 レスポンス本文:', responseText.substring(0, 200));
        
        if (!response.ok) {
          // テキストをJSONとしてパースを試みる
          let errorDetail = '路線データの取得に失敗しました';
          try {
            const errorData = JSON.parse(responseText);
            console.error('❌ エラーレスポンス:', errorData);
            errorDetail = errorData.error || errorData.detail || errorDetail;
          } catch (e) {
            console.error('❌ エラーテキスト:', responseText);
            errorDetail = responseText || errorDetail;
          }
          
          // より詳細なエラーメッセージ
          throw new Error(
            `${errorDetail}\n\n` +
            `ステータス: ${response.status}\n` +
            `【確認事項】\n` +
            `1. src/app/api/railways/route.ts が存在するか\n` +
            `2. .env.local に ODPT_CONSUMER_KEY が設定されているか\n` +
            `3. ODPT_CONSUMER_KEY が有効なキーか\n` +
            `4. サーバーを再起動したか (npm run dev)`
          );
        }
        
        // テキストをJSONとしてパース
        const data = JSON.parse(responseText);
        console.log('✅ 取得した路線データ:', data);
        console.log('✅ 路線数:', data.length);
        
        if (!Array.isArray(data) || data.length === 0) {
          throw new Error(
            '路線データが空です。\n\n' +
            'ODPT APIキーが有効か確認してください:\n' +
            '1. https://developer.odpt.org/ にアクセス\n' +
            '2. ログインして「トークン」ページを確認\n' +
            '3. APIキーが有効期限内か確認'
          );
        }
        
        setRailways(data);
        console.log('✅ 路線データ設定完了');
        
      } catch (err) {
        console.error('❌ 路線取得エラー:', err);
        
        let errorMessage = '路線データの取得に失敗しました。';
        
        if (err instanceof Error) {
          errorMessage = err.message;
        }
        
        setError(errorMessage);
      } finally {
        setIsLoadingRailways(false);
      }
    };
    fetchRailways();
  }, []);

  // 路線選択時に駅データを取得（修正版）
  useEffect(() => {
    if (!selectedRailway) {
      setStations([]);
      return;
    }

    const fetchStations = async () => {
      setIsLoadingStations(true);
      setError(null);
      
      console.log('🔍 駅データ取得開始:', selectedRailway.label);
      
      try {
        const response = await fetch(`/api/stations?railwayId=${encodeURIComponent(selectedRailway.value)}`);
        
        console.log('📡 駅データレスポンス:', response.status);
        
        // ✅ 修正: 先にテキストとして読み込む
        const responseText = await response.text();
        
        if (!response.ok) {
          let errorDetail = '駅データの取得に失敗しました';
          try {
            const errorData = JSON.parse(responseText);
            console.error('❌ エラーレスポンス:', errorData);
            errorDetail = errorData.error || errorData.detail || errorDetail;
          } catch (e) {
            console.error('❌ エラーテキスト:', responseText);
          }
          throw new Error(`${errorDetail} (ステータス: ${response.status})`);
        }
        
        const data = JSON.parse(responseText);
        console.log('✅ 取得した駅データ:', data);
        console.log('✅ 駅数:', data.length);
        
        setStations(data);
        
      } catch (err) {
        console.error('❌ 駅取得エラー:', err);
        setError(err instanceof Error ? err.message : '駅データの取得に失敗しました');
      } finally {
        setIsLoadingStations(false);
      }
    };
    fetchStations();
  }, [selectedRailway]);

  const handleSearch = async () => {
    if (!selectedStation) {
      setError('駅を選択してください');
      return;
    }

    if (!month || !day) {
      setError('日付を選択してください');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSearchResults(null);
    setEventInfo([]);

    console.log('🔍 検索開始:', selectedStation.label, `${month}月${day}日`);

    try {
      // 1. 会場検索
      console.log('📍 会場検索中...');
      const venueResponse = await fetch(`/api/search-venues?stationName=${encodeURIComponent(selectedStation.label)}`);
      
      const venueText = await venueResponse.text();
      
      if (!venueResponse.ok) {
        let errorDetail = '会場検索に失敗しました';
        try {
          const errorData = JSON.parse(venueText);
          console.error('❌ 会場検索エラー:', errorData);
          errorDetail = errorData.detail || errorDetail;
        } catch (e) {
          console.error('❌ エラーテキスト:', venueText);
        }
        throw new Error(errorDetail);
      }
      
      const venueData = JSON.parse(venueText);
      console.log('✅ 会場データ:', venueData);
      console.log('✅ 会場数:', venueData.venue_results.Feature.length);
      
      setSearchResults(venueData);

      // 2. イベント情報取得
      if (venueData.venue_results.Feature.length > 0) {
        setIsLoadingEvents(true);
        console.log('🎪 イベント情報取得中...');
        
        const currentYear = new Date().getFullYear();
        const targetDate = `${currentYear}年${month}月${day}日`;
        const facilityList = venueData.venue_results.Feature.map((f: VenueFeature) => f.Name);

        console.log('📅 対象日付:', targetDate);
        console.log('🏢 施設リスト:', facilityList);

        const eventResponse = await fetch('/api/events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            target_date: targetDate,
            facility_list: facilityList,
          }),
        });

        const eventText = await eventResponse.text();

        if (!eventResponse.ok) {
          let errorDetail = 'イベント情報の取得に失敗しました';
          try {
            const errorData = JSON.parse(eventText);
            console.error('❌ イベント取得エラー:', errorData);
            errorDetail = errorData.detail || errorDetail;
          } catch (e) {
            console.error('❌ エラーテキスト:', eventText);
          }
          throw new Error(errorDetail);
        }

        const events = JSON.parse(eventText);
        console.log('✅ イベントデータ:', events);
        
        setEventInfo(events);
      }
      
      console.log('✅ 検索完了');
      
    } catch (err) {
      console.error('❌ 検索エラー:', err);
      setError(err instanceof Error ? err.message : '検索中にエラーが発生しました');
    } finally {
      setIsLoading(false);
      setIsLoadingEvents(false);
    }
  };

  const handleRailwaySelect = (railway: RailwayOption) => {
    setSelectedRailway(railway);
    setSelectedStation(null);
    setShowRailwayDropdown(false);
    setSearchResults(null);
    setEventInfo([]);
    setError(null);
  };

  const handleStationSelect = (station: StationOption) => {
    setSelectedStation(station);
    setShowStationDropdown(false);
  };

  const handleDaySelect = (selectedMonth: number, selectedDay: number) => {
    setMonth(selectedMonth);
    setDay(selectedDay);
    setShowCalendar(false);
  };

  const handlePrevMonth = () => {
    setCalendarMonth(prev => prev === 1 ? 12 : prev - 1);
  };

  const handleNextMonth = () => {
    setCalendarMonth(prev => prev === 12 ? 1 : prev + 1);
  };

  const handleBackToSearch = () => {
    setSearchResults(null);
    setEventInfo([]);
    setActiveTab('event');
    setError(null);
  };

  const getDaysInMonth = (monthNum: number) => {
    const year = new Date().getFullYear();
    return new Date(year, monthNum, 0).getDate();
  };

  const daysInCalendarMonth = getDaysInMonth(calendarMonth);
  const weekDays = ['日', '月', '火', '水', '木', '金', '土'];

  // 混雑度に応じた色を取得
  const getScaleColor = (scale: number) => {
    if (scale >= 8) return 'bg-red-500 text-white';
    if (scale >= 5) return 'bg-yellow-500 text-white';
    if (scale >= 3) return 'bg-blue-500 text-white';
    return 'bg-green-500 text-white';
  };

  // 混雑度の説明を取得
  const getScaleDescription = (scale: number) => {
    if (scale >= 8) return '非常に混雑';
    if (scale >= 5) return '混雑';
    if (scale >= 3) return 'やや混雑';
    return '空いている';
  };

  // 検索結果画面
  if (searchResults) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        {/* ヘッダー */}
        <div className="bg-gray-300 h-48 relative">
          <button
            onClick={handleBackToSearch}
            className="absolute top-4 left-4 p-2 bg-white rounded-lg shadow-md"
          >
            <span className="text-2xl">←</span>
          </button>
        </div>

        {/* 駅名エリア */}
        <div className="bg-white px-6 py-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold">{selectedStation?.label}駅</h1>
          <p className="text-gray-600 text-sm">{selectedStation?.label} Station</p>
          
          {/* タブ */}
          <div className="flex gap-4 mt-4">
            <button
              onClick={() => setActiveTab('event')}
              className="flex flex-col items-center gap-2"
            >
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                activeTab === 'event' ? 'bg-pink-200' : 'bg-gray-300'
              }`}>
                <span className="text-2xl">🎪</span>
              </div>
              <span className={`text-sm font-medium ${
                activeTab === 'event' ? 'text-black' : 'text-gray-600'
              }`}>イベント</span>
            </button>
            
            <button
              onClick={() => setActiveTab('transit')}
              className="flex flex-col items-center gap-2"
            >
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                activeTab === 'transit' ? 'bg-pink-200' : 'bg-gray-300'
              }`}>
                <span className="text-2xl">🚃</span>
              </div>
              <span className={`text-sm font-medium ${
                activeTab === 'transit' ? 'text-black' : 'text-gray-600'
              }`}>運行情報</span>
            </button>
          </div>
        </div>

        {/* コンテンツエリア */}
        <div className="flex-1 p-6">
          {activeTab === 'event' && (
            <>
              <h2 className="text-xl font-bold mb-4">イベント</h2>
              
              {isLoadingEvents && (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
                  <p className="mt-2 text-gray-600">イベント情報を取得中...</p>
                </div>
              )}

              {!isLoadingEvents && eventInfo.length > 0 && (
                <>
                  <p className="text-sm text-gray-600 mb-4">
                    {month}月{day}日の混雑予測 ({eventInfo.length}件)
                  </p>
                  
                  <div className="space-y-4">
                    {eventInfo.map((event, index) => (
                      <div
                        key={index}
                        className="bg-white rounded-lg p-4 border-2 border-gray-200 shadow-sm"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-bold text-lg flex-1">{event.facility_name}</h3>
                          <div className={`px-3 py-1 rounded-full text-sm font-bold ${getScaleColor(event.scale)}`}>
                            {event.scale}/10
                          </div>
                        </div>
                        
                        <div className="mb-2">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getScaleColor(event.scale)}`}>
                            {getScaleDescription(event.scale)}
                          </span>
                        </div>

                        {event.event_name && (
                          <div className="mb-2 p-3 bg-pink-50 rounded">
                            <p className="text-sm font-medium text-pink-800">
                              🎪 {event.event_name}
                            </p>
                          </div>
                        )}
                        
                        <p className="text-sm text-gray-600 mt-2">
                          {event.reason}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* 総合評価 */}
                  <div className="mt-6 p-4 bg-gradient-to-r from-pink-100 to-purple-100 rounded-lg">
                    <h3 className="font-bold mb-2">総合評価</h3>
                    <p className="text-sm">
                      平均混雑度: <span className="font-bold text-lg">
                        {(eventInfo.reduce((sum, e) => sum + e.scale, 0) / eventInfo.length).toFixed(1)}/10
                      </span>
                    </p>
                    <p className="text-xs text-gray-600 mt-2">
                      ※ AIによる予測です。実際の混雑状況とは異なる場合があります。
                    </p>
                  </div>
                </>
              )}

              {!isLoadingEvents && eventInfo.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  <p>イベント情報が見つかりませんでした</p>
                </div>
              )}
            </>
          )}

          {activeTab === 'transit' && (
            <>
              <h2 className="text-xl font-bold mb-4">運行情報</h2>
              <div className="text-center text-gray-500 py-8">
                <p>運行情報は現在準備中です</p>
              </div>
            </>
          )}
        </div>

        {/* 広告バナー */}
        <div className="bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 text-white text-center py-4 font-bold">
          1ヶ月で15kg痩せるサプリ!!!
        </div>
        <div className="bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 text-white text-center py-4 font-bold">
          1ヶ月で１００万円稼ぐ方法!!!
        </div>
      </div>
    );
  }

  // 検索画面
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* メインコンテンツ */}
      <div className="flex-1 p-6">
        {/* タイトルエリア */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center overflow-hidden">
            <Image
              src="/icon.png"
              alt="いつ空いてる"
              width={64}
              height={64}
            />
          </div>
          <h1 className={`text-2xl ${yujiMai.className}`}>いつ空いてる?</h1>
        </div>

        {/* エラーメッセージ */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            <div className="font-bold mb-2">❌ エラーが発生しました</div>
            <pre className="text-sm whitespace-pre-wrap">{error}</pre>
            <div className="mt-3 text-xs">
              <p>💡 ブラウザのコンソール (F12) で詳細ログを確認できます</p>
            </div>
          </div>
        )}

        {/* 日付選択 */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-3">
            調べたい日付は?
          </label>
          
          <div className="relative">
            <button
              onClick={() => setShowCalendar(!showCalendar)}
              className="w-full bg-pink-100 rounded-lg px-4 py-3 text-left outline-none flex items-center justify-between"
            >
              <span className={month && day ? 'text-black' : 'text-gray-400'}>
                {month && day ? `${month}月${day}日` : '日付を選択'}
              </span>
              <span className="text-2xl">📅</span>
            </button>
            
            {showCalendar && (
              <div className="absolute z-10 w-full mt-1 bg-pink-50 rounded-lg shadow-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={handlePrevMonth}
                    className="p-1 hover:bg-pink-200 rounded text-sm"
                  >
                    ◀
                  </button>
                  <div className="font-bold text-base">
                    {calendarMonth}月
                  </div>
                  <button
                    onClick={handleNextMonth}
                    className="p-1 hover:bg-pink-200 rounded text-sm"
                  >
                    ▶
                  </button>
                </div>
                
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {weekDays.map((day) => (
                    <div
                      key={day}
                      className="text-center text-xs font-medium text-gray-600"
                    >
                      {day}
                    </div>
                  ))}
                </div>
                
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: daysInCalendarMonth }, (_, i) => i + 1).map((d) => (
                    <button
                      key={d}
                      onClick={() => handleDaySelect(calendarMonth, d)}
                      className={`aspect-square flex items-center justify-center rounded text-xs
                        ${month === calendarMonth && day === d 
                          ? 'bg-pink-400 text-white font-bold' 
                          : 'hover:bg-pink-200 bg-white'
                        } border border-pink-200`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(month && day) && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setMonth(null);
                  setDay(null);
                }}
                className="absolute right-12 top-1/2 -translate-y-1/2 p-2"
              >
                <span className="text-xl">🗑️</span>
              </button>
            )}
          </div>
        </div>

        {/* 路線選択 */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-3">
            使いたい路線を入力
          </label>
          <div className="relative">
            <button
              onClick={() => setShowRailwayDropdown(!showRailwayDropdown)}
              disabled={isLoadingRailways}
              className="w-full bg-pink-100 rounded-lg px-4 py-3 text-left outline-none flex items-center justify-between disabled:opacity-50"
            >
              <span className={selectedRailway ? 'text-black' : 'text-gray-400'}>
                {isLoadingRailways ? '読み込み中...' : (selectedRailway?.label || '路線を選択')}
              </span>
              <span className="text-xl">{showRailwayDropdown ? '∧' : '∨'}</span>
            </button>
            
            {showRailwayDropdown && !isLoadingRailways && railways.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-pink-50 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {railways.map((railway) => (
                  <button
                    key={railway.value}
                    onClick={() => handleRailwaySelect(railway)}
                    className="w-full text-left px-4 py-3 hover:bg-pink-200 border-b border-pink-200 last:border-b-0"
                  >
                    {railway.label}
                  </button>
                ))}
              </div>
            )}
            
            {showRailwayDropdown && !isLoadingRailways && railways.length === 0 && (
              <div className="absolute z-10 w-full mt-1 bg-pink-50 rounded-lg shadow-lg p-4 text-center text-gray-500">
                路線データがありません
              </div>
            )}
          </div>
        </div>

        {/* 駅名選択 */}
        <div className="mb-8">
          <label className="block text-sm font-medium mb-3">
            使いたい駅名を入力
          </label>
          <div className="relative">
            <button
              onClick={() => setShowStationDropdown(!showStationDropdown)}
              disabled={!selectedRailway || isLoadingStations}
              className="w-full bg-pink-100 rounded-lg px-4 py-3 text-left outline-none flex items-center justify-between disabled:opacity-50"
            >
              <span className={selectedStation ? 'text-black' : 'text-gray-400'}>
                {isLoadingStations ? '読み込み中...' : (selectedStation?.label || '駅を選択')}
              </span>
              <span className="text-xl">{showStationDropdown ? '∧' : '∨'}</span>
            </button>
            
            {showStationDropdown && selectedRailway && !isLoadingStations && (
              <div className="absolute z-10 w-full mt-1 bg-pink-50 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {stations.map((station) => (
                  <button
                    key={station.value}
                    onClick={() => handleStationSelect(station)}
                    className="w-full text-left px-4 py-3 hover:bg-pink-200 border-b border-pink-200 last:border-b-0"
                  >
                    {station.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 検索ボタン */}
        <button
          onClick={handleSearch}
          disabled={!selectedStation || !month || !day || isLoading}
          className="w-full bg-pink-200 hover:bg-pink-300 text-gray-800 font-medium py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? '検索中...' : '検索'}
        </button>
      </div>

      {/* 広告バナー */}
      <div className="bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 text-white text-center py-4 font-bold">
        1ヶ月で15kg痩せるサプリ!!!
      </div>
      <div className="bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 text-white text-center py-4 font-bold">
        1ヶ月で１００万円稼ぐ方法!!!
      </div>
    </div>
  );
}