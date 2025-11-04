import { fetchRailwayOptions } from "@/lib/odpt";
import RailwaySelect from "@/components/RailwaySelect";

export default async function TopRailwayDropdown() {
  try {
    const options = await fetchRailwayOptions();

    if (options.length === 0) {
      return (
        <div className="p-4 text-gray-500">
          路線情報が見つかりませんでした
        </div>
      );
    }

    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">路線選択</h1>
        <RailwaySelect options={options} />
      </div>
    );
  } catch (error) {
    console.error("Failed to fetch railway options:", error);
    return (
      <div className="p-4 text-red-500">
        路線情報の取得に失敗しました
      </div>
    );
  }
}

