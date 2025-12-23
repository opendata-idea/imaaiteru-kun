import RailwayAndStationSelector from "@/components/RailwayAndStationSelector";
import { fetchRailwayOptions } from "@/lib/odpt";

export default async function Home() {
  const railwayOptions = await fetchRailwayOptions();

  return (
    <main className="min-h-screen bg-white text-gray-900 flex flex-col">
      <div className="flex-1 p-6">
        <h1 className="text-2xl text-gray-900 mb-8 flex items-center justify-center gap-3 font-['Yuji_Mai'] before:content-[''] before:block before:w-16 before:h-16 before:rounded-lg before:bg-white before:bg-[url('/icon.png')] before:bg-contain before:bg-center before:bg-no-repeat">
          いつ空いてる?
        </h1>
        <RailwayAndStationSelector railwayOptions={railwayOptions} />
      </div>

      <div className="bg-[linear-gradient(to_right,#ef4444,#eab308,#22c55e,#3b82f6,#a855f7)] text-white text-center py-4 font-bold">
        １ヶ月で１５ kg痩せるサプリ!!!
      </div>
      <div className="bg-[linear-gradient(to_right,#ef4444,#eab308,#22c55e,#3b82f6,#a855f7)] text-white text-center py-4 font-bold">
        １ヶ月で１００万円稼ぐ方法!!!
      </div>
    </main>
  );
}