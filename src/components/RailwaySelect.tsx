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
    <div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-4 py-2 border border-gray-300 rounded-md"
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
    </div>
  );
}
