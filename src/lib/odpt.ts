export type RailwayOption = {
  label: string;
  value: string;
  color?: string;
  code?: string;
};

export type StationOption = {
  label: string;
  value: string;
};

interface OdptRailway {
  "dc:title"?: string;
  "odpt:railwayTitle"?: { ja?: string };
  "owl:sameAs": string;
  "odpt:color"?: string;
  "odpt:lineCode"?: string;
}

interface OdptStation {
  "dc:title"?: string;
  "odpt:stationTitle"?: { ja?: string };
  "owl:sameAs": string;
}

export async function fetchRailwayOptions(): Promise<RailwayOption[]> {
  const key = process.env.ODPT_CONSUMER_KEY;
  if (!key) {
    throw new Error("ODPT_CONSUMER_KEY is not set");
  }

  const url = `https://api-challenge.odpt.org/api/v4/odpt:Railway?odpt:operator=odpt.Operator:JR-East&acl:consumerKey=${key}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });

  if (!res.ok) {
    throw new Error(`Failed to fetch railways: ${res.status}`);
  }

  const rows: OdptRailway[] = await res.json();

  return rows
    .map((r) => ({
      label: r["dc:title"] ?? r["odpt:railwayTitle"]?.ja ?? r["owl:sameAs"],
      value: r["owl:sameAs"],
      color: r["odpt:color"],
      code: r["odpt:lineCode"],
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "ja"));
}

export async function fetchStationsByRailway(
  railwayId: string,
): Promise<StationOption[]> {
  const key = process.env.ODPT_CONSUMER_KEY;
  if (!key) {
    throw new Error("ODPT_CONSUMER_KEY is not set");
  }
  if (!railwayId) {
    return [];
  }

  const url = `https://api-challenge.odpt.org/api/v4/odpt:Station?odpt:railway=${railwayId}&acl:consumerKey=${key}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });

  if (!res.ok) {
    throw new Error(`Failed to fetch stations: ${res.status}`);
  }

  const rows: OdptStation[] = await res.json();

  return rows
    .map((r) => ({
      label: r["dc:title"] ?? r["odpt:stationTitle"]?.ja ?? r["owl:sameAs"],
      value: r["owl:sameAs"],
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "ja"));
}
