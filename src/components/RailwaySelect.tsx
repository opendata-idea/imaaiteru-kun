"use client";

import { useState } from "react";

type RailwayOption = {
  label: string;
  value: string;
  color?: string;
  code?: string;
};

type RailwaySelectProps = {
  options: RailwayOption[];
};

export default function RailwaySelect({ options }: RailwaySelectProps) {
  const [value, setValue] = useState("");

  return (
    <div>
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
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

