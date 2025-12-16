"use client";

type RailwayOption = {
  label: string;
  value: string;
  color?: string;
  code?: string;
};

type RailwaySelectProps = {
  options: RailwayOption[];
  value: string;
  onChange: (value: string) => void;
};

export default function RailwaySelect({
  options,
  value,
  onChange,
}: RailwaySelectProps) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none bg-pink-100 text-gray-900 rounded-lg px-4 py-3 pr-10 text-left outline-none border border-transparent focus:ring-2 focus:ring-pink-300"
      >
        <option value="" disabled>
          路線を選択
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-gray-600"
      >
        ▼
      </span>
    </div>
  );
}
