'use client';

import Truck from "./Truck";

type LoadingScreenProps = {
  message?: string;
};

const LoadingScreen = ({ message = "検索中..." }: LoadingScreenProps) => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white">
      <div className="w-full max-w-md px-4">
        <Truck compact />
        <p className="text-center text-lg font-medium text-gray-700 mt-6">
          {message}
        </p>
      </div>
    </div>
  );
};

export default LoadingScreen;
