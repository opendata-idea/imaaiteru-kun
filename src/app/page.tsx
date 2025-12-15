import RailwayAndStationSelector from "@/components/RailwayAndStationSelector";
import { fetchRailwayOptions } from "@/lib/odpt";

export default async function Home() {
  const railwayOptions = await fetchRailwayOptions();

  return (
    <main>
      <h1 className="text-2xl font-bold p-4">対象路線・駅選択</h1>
      <RailwayAndStationSelector railwayOptions={railwayOptions} />
    </main>
  );
}
