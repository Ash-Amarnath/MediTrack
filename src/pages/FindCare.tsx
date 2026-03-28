import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Search, MapPin, Phone, Navigation, Star, Clock, X, List, Map as MapIcon, Mic } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default marker icons
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

interface Place {
  id: number;
  name: string;
  lat: number;
  lon: number;
  type: string;
  phone?: string;
  address?: string;
  opening_hours?: string;
  distance?: number;
}

type Category = "hospital" | "clinic" | "lab" | "pharmacy" | "emergency";

const CATEGORY_TAGS: Record<Category, string> = {
  hospital: '["amenity"="hospital"]',
  clinic: '["amenity"="clinic"]',
  lab: '["healthcare"="laboratory"]',
  pharmacy: '["amenity"="pharmacy"]',
  emergency: '["emergency"="yes"]',
};

const CATEGORY_FALLBACK: Record<Category, string> = {
  hospital: "",
  clinic: "",
  lab: '["amenity"="clinic"]["name"~"lab|diag|path|test",i]',
  pharmacy: "",
  emergency: '["amenity"="hospital"]',
};

const DISTANCE_OPTIONS = [2, 5, 10, 25];

const FindCare = () => {
  const { t } = useTranslation();
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [category, setCategory] = useState<Category>("hospital");
  const [distance, setDistance] = useState(5);
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [showList, setShowList] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  // Get user location
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setUserPos([pos.coords.latitude, pos.coords.longitude]),
      () => setUserPos([20.5937, 78.9629]) // Default: India center
    );
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !userPos || mapRef.current) return;

    const map = L.map(mapContainer.current, { zoomControl: true }).setView(userPos, 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const userIcon = L.divIcon({
      html: `<div style="width:16px;height:16px;background:hsl(var(--primary));border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
      iconSize: [16, 16],
      className: "",
    });
    userMarkerRef.current = L.marker(userPos, { icon: userIcon }).addTo(map).bindPopup("You are here");
    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    setTimeout(() => map.invalidateSize(), 200);
    return () => { map.remove(); mapRef.current = null; };
  }, [userPos]);

  const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const searchPlaces = useCallback(async () => {
    if (!userPos) return;
    setLoading(true);
    setSelectedPlace(null);

    const [lat, lon] = userPos;
    const radius = distance * 1000;
    const q = query.trim().toLowerCase();

    let results: Place[] = [];

    try {
      // If user typed a specific query, search via Nominatim first for name-based results
      if (q) {
        try {
          const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query.trim())}&format=json&limit=30&viewbox=${lon - 0.5},${lat + 0.5},${lon + 0.5},${lat - 0.5}&bounded=0&addressdetails=1&extratags=1`;
          const nomResp = await fetch(nominatimUrl, {
            headers: { "User-Agent": "MediTrack-HealthApp/1.0" },
          });
          const nomData = await nomResp.json();
          const healthKeywords = ["hospital", "clinic", "pharmacy", "laboratory", "lab", "diagnostic", "medical", "health", "nursing", "doctor", "chemist", "pathology"];

          const nominatimResults: Place[] = nomData
            .map((item: any) => {
              const itemLat = parseFloat(item.lat);
              const itemLon = parseFloat(item.lon);
              const dist = haversine(lat, lon, itemLat, itemLon);
              const itemType = item.type || item.class || "";
              const displayName = item.display_name || "";
              const nameOnly = displayName.split(",")[0]?.trim() || "Healthcare";
              const address = displayName.split(",").slice(1, 4).join(",").trim();

              return {
                id: parseInt(item.osm_id) || Math.random() * 100000,
                name: nameOnly,
                lat: itemLat,
                lon: itemLon,
                type: itemType,
                phone: item.extratags?.phone || item.extratags?.["contact:phone"],
                address,
                opening_hours: item.extratags?.opening_hours,
                distance: dist,
              } as Place;
            })
            .filter((p: Place) => p.distance! <= distance * 2); // Allow 2x distance for name matches

          results = [...nominatimResults];
        } catch (e) {
          console.warn("Nominatim search failed:", e);
        }
      }

      // Also do Overpass category search
      const tag = CATEGORY_TAGS[category];
      const fallback = CATEGORY_FALLBACK[category];
      const overpassQuery = `[out:json][timeout:15];(node${tag}(around:${radius},${lat},${lon});way${tag}(around:${radius},${lat},${lon}););out center body;`;

      const resp = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: `data=${encodeURIComponent(overpassQuery)}`,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      const data = await resp.json();
      const existingIds = new Set(results.map(r => r.id));

      const overpassResults: Place[] = data.elements
        .map((el: any) => {
          const elLat = el.lat ?? el.center?.lat;
          const elLon = el.lon ?? el.center?.lon;
          if (!elLat || !elLon || existingIds.has(el.id)) return null;
          return {
            id: el.id,
            name: el.tags?.name || el.tags?.["name:en"] || `${category.charAt(0).toUpperCase() + category.slice(1)}`,
            lat: elLat,
            lon: elLon,
            type: el.tags?.amenity || el.tags?.healthcare || category,
            phone: el.tags?.phone || el.tags?.["contact:phone"],
            address: [el.tags?.["addr:street"], el.tags?.["addr:city"]].filter(Boolean).join(", "),
            opening_hours: el.tags?.opening_hours,
            distance: haversine(lat, lon, elLat, elLon),
          };
        })
        .filter(Boolean) as Place[];

      results = [...results, ...overpassResults];

      // Fallback for sparse categories
      if (results.length < 3 && fallback) {
        const fallbackQuery = `[out:json][timeout:15];(node${fallback}(around:${radius},${lat},${lon});way${fallback}(around:${radius},${lat},${lon}););out center body;`;
        try {
          const resp2 = await fetch("https://overpass-api.de/api/interpreter", {
            method: "POST",
            body: `data=${encodeURIComponent(fallbackQuery)}`,
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
          });
          const data2 = await resp2.json();
          const allIds = new Set(results.map(r => r.id));
          const extra = data2.elements
            .map((el: any) => {
              const elLat = el.lat ?? el.center?.lat;
              const elLon = el.lon ?? el.center?.lon;
              if (!elLat || !elLon || allIds.has(el.id)) return null;
              return {
                id: el.id,
                name: el.tags?.name || el.tags?.["name:en"] || "Healthcare",
                lat: elLat, lon: elLon,
                type: category,
                phone: el.tags?.phone || el.tags?.["contact:phone"],
                address: [el.tags?.["addr:street"], el.tags?.["addr:city"]].filter(Boolean).join(", "),
                opening_hours: el.tags?.opening_hours,
                distance: haversine(lat, lon, elLat, elLon),
              };
            })
            .filter(Boolean) as Place[];
          results = [...results, ...extra];
        } catch {}
      }

      // If text query, prioritize name matches at the top
      if (q) {
        results.sort((a, b) => {
          const aMatch = a.name.toLowerCase().includes(q) ? 0 : 1;
          const bMatch = b.name.toLowerCase().includes(q) ? 0 : 1;
          if (aMatch !== bMatch) return aMatch - bMatch;
          return (a.distance ?? 999) - (b.distance ?? 999);
        });
      } else {
        results.sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));
      }

      // Deduplicate by name + approximate location
      const seen = new Set<string>();
      results = results.filter(p => {
        const key = `${p.name.toLowerCase()}-${p.lat.toFixed(3)}-${p.lon.toFixed(3)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setPlaces(results);
      updateMarkers(results);
    } catch {
      setPlaces([]);
    }
    setLoading(false);
  }, [userPos, category, distance, query]);

  // Auto-search on category/distance change
  useEffect(() => {
    if (userPos) searchPlaces();
  }, [category, distance, userPos]);

  const updateMarkers = (results: Place[]) => {
    if (!markersRef.current || !mapRef.current) return;
    markersRef.current.clearLayers();

    const catColors: Record<string, string> = {
      hospital: "#ef4444", clinic: "#3b82f6", lab: "#8b5cf6", pharmacy: "#10b981", emergency: "#f97316",
    };
    const color = catColors[category] || "#ef4444";

    results.forEach((place) => {
      const icon = L.divIcon({
        html: `<div style="width:12px;height:12px;background:${color};border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`,
        iconSize: [12, 12],
        className: "",
      });
      const marker = L.marker([place.lat, place.lon], { icon }).addTo(markersRef.current!);
      marker.bindPopup(`<b>${place.name}</b>${place.address ? `<br/>${place.address}` : ""}${place.phone ? `<br/>📞 ${place.phone}` : ""}`);
      marker.on("click", () => setSelectedPlace(place));
    });

    if (results.length > 0) {
      const bounds = L.latLngBounds(results.map(p => [p.lat, p.lon]));
      if (userPos) bounds.extend(userPos);
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  };

  const openDirections = (place: Place) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}`;
    window.open(url, "_blank");
  };

  const callPlace = (phone: string) => {
    window.open(`tel:${phone}`);
  };

  const formatDist = (km?: number) => {
    if (!km) return "";
    return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
  };

  const categories: { key: Category; labelKey: string }[] = [
    { key: "hospital", labelKey: "find_cat_hospital" },
    { key: "clinic", labelKey: "find_cat_clinic" },
    { key: "lab", labelKey: "find_cat_lab" },
    { key: "pharmacy", labelKey: "find_cat_pharmacy" },
    { key: "emergency", labelKey: "find_cat_emergency" },
  ];

  // Voice search
  const startVoiceSearch = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.lang = "en-IN";
    recognition.onresult = (e: any) => {
      const text = e.results[0]?.[0]?.transcript || "";
      setQuery(text);
      setTimeout(() => searchPlaces(), 300);
    };
    recognition.start();
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Search bar */}
      <div className="px-4 pt-4 pb-2 bg-card border-b border-border space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchPlaces()}
              placeholder={t("find_placeholder")}
              className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              aria-label={t("find_placeholder")}
            />
            <button
              onClick={startVoiceSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-accent/50 transition-colors active:scale-95"
              aria-label="Voice search"
            >
              <Mic className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <button
            onClick={searchPlaces}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:brightness-110 transition-all active:scale-95 disabled:opacity-50"
            aria-label={t("find_search")}
          >
            {loading ? t("find_searching") : t("find_search")}
          </button>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map(({ key, labelKey }) => (
            <button
              key={key}
              onClick={() => setCategory(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors active:scale-95 ${
                category === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-accent/50 text-muted-foreground hover:bg-accent"
              }`}
              aria-label={t(labelKey)}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>

        {/* Distance + view toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{t("find_distance")}:</span>
            {DISTANCE_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDistance(d)}
                className={`px-2 py-1 rounded-md text-xs font-medium transition-colors active:scale-95 ${
                  distance === d
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-accent/50"
                }`}
                aria-label={`${d} km`}
              >
                {d}km
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowList(!showList)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground hover:bg-accent/50 transition-colors active:scale-95"
            aria-label={showList ? t("find_show_map") : t("find_show_list")}
          >
            {showList ? <MapIcon className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
            {showList ? t("find_show_map") : t("find_show_list")}
          </button>
        </div>
      </div>

      {/* Map + Results */}
      <div className="flex-1 relative overflow-hidden">
        {/* Map */}
        <div
          ref={mapContainer}
          className={`absolute inset-0 z-0 ${showList ? "hidden" : "block"}`}
          style={{ minHeight: "100%" }}
        />

        {/* List view */}
        {showList && (
          <div className="absolute inset-0 z-10 bg-background overflow-y-auto p-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              {places.length} {t("find_results")}
            </p>
            {places.length === 0 && !loading && (
              <div className="text-center py-12">
                <MapPin className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-medium text-muted-foreground">{t("find_no_results")}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">{t("find_no_results_hint")}</p>
              </div>
            )}
            {places.map((place) => (
              <PlaceCard
                key={place.id}
                place={place}
                formatDist={formatDist}
                onDirections={() => openDirections(place)}
                onCall={() => place.phone && callPlace(place.phone)}
                onClick={() => { setSelectedPlace(place); setShowList(false); }}
                t={t}
              />
            ))}
          </div>
        )}

        {/* Bottom sheet with results (map view) */}
        {!showList && places.length > 0 && !selectedPlace && (
          <div className="absolute bottom-0 left-0 right-0 z-20 bg-card/95 backdrop-blur-sm border-t border-border rounded-t-2xl max-h-[40%] overflow-y-auto">
            <div className="w-10 h-1 rounded-full bg-border mx-auto mt-2 mb-1" />
            <div className="px-4 pb-4 space-y-2">
              <p className="text-xs text-muted-foreground">{places.length} {t("find_results")}</p>
              {places.slice(0, 20).map((place) => (
                <PlaceCard
                  key={place.id}
                  place={place}
                  formatDist={formatDist}
                  onDirections={() => openDirections(place)}
                  onCall={() => place.phone && callPlace(place.phone)}
                  onClick={() => {
                    setSelectedPlace(place);
                    mapRef.current?.setView([place.lat, place.lon], 16);
                  }}
                  t={t}
                  compact
                />
              ))}
            </div>
          </div>
        )}

        {/* Selected place detail card */}
        {!showList && selectedPlace && (
          <div className="absolute bottom-0 left-0 right-0 z-30 bg-card border-t border-border rounded-t-2xl p-4 shadow-xl">
            <button
              onClick={() => setSelectedPlace(null)}
              className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-accent/50 transition-colors active:scale-95"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
            <h3 className="text-base font-bold text-foreground pr-8">{selectedPlace.name}</h3>
            <p className="text-xs text-muted-foreground capitalize mt-0.5">{selectedPlace.type}</p>

            {selectedPlace.address && (
              <div className="flex items-start gap-1.5 mt-2">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <span className="text-xs text-muted-foreground">{selectedPlace.address}</span>
              </div>
            )}
            {selectedPlace.opening_hours && (
              <div className="flex items-start gap-1.5 mt-1.5">
                <Clock className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <span className="text-xs text-muted-foreground">{selectedPlace.opening_hours}</span>
              </div>
            )}
            {selectedPlace.phone && (
              <div className="flex items-start gap-1.5 mt-1.5">
                <Phone className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <span className="text-xs text-muted-foreground">{selectedPlace.phone}</span>
              </div>
            )}
            {selectedPlace.distance != null && (
              <p className="text-xs text-primary font-medium mt-2">
                {formatDist(selectedPlace.distance)} {t("find_away")}
              </p>
            )}

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => openDirections(selectedPlace)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:brightness-110 transition-all active:scale-95"
                aria-label={t("find_directions")}
              >
                <Navigation className="w-4 h-4" /> {t("find_directions")}
              </button>
              {selectedPlace.phone && (
                <button
                  onClick={() => callPlace(selectedPlace.phone!)}
                  className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-accent/50 transition-colors active:scale-95"
                  aria-label={t("find_call")}
                >
                  <Phone className="w-4 h-4" /> {t("find_call")}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Place card component
function PlaceCard({
  place, formatDist, onDirections, onCall, onClick, t, compact,
}: {
  place: Place;
  formatDist: (km?: number) => string;
  onDirections: () => void;
  onCall: () => void;
  onClick: () => void;
  t: (k: string) => string;
  compact?: boolean;
}) {
  return (
    <div
      className={`w-full text-left rounded-xl border border-border bg-card hover:bg-accent/30 transition-colors ${
        compact ? "p-2.5" : "p-3"
      }`}
    >
      {compact ? (
        <button onClick={onClick} className="w-full flex items-center gap-3 active:scale-[0.98]">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{place.name}</p>
            <p className="text-xs text-muted-foreground truncate">{place.address || place.type}</p>
          </div>
          {place.distance != null && (
            <span className="text-xs font-medium text-primary shrink-0">{formatDist(place.distance)}</span>
          )}
        </button>
      ) : (
        <>
          <button onClick={onClick} className="w-full text-left active:scale-[0.98]">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-foreground">{place.name}</h4>
                <p className="text-xs text-muted-foreground capitalize">{place.type}</p>
                {place.address && (
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3 shrink-0" /> {place.address}
                  </p>
                )}
                {place.opening_hours && (
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3 shrink-0" /> {place.opening_hours}
                  </p>
                )}
                {place.phone && (
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Phone className="w-3 h-3 shrink-0" /> {place.phone}
                  </p>
                )}
              </div>
              {place.distance != null && (
                <span className="text-xs font-medium text-primary ml-2 shrink-0">{formatDist(place.distance)}</span>
              )}
            </div>
          </button>
          <div className="flex gap-2 mt-2.5">
            <button
              onClick={onDirections}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:brightness-110 transition-all active:scale-95"
              aria-label={t("find_directions")}
            >
              <Navigation className="w-3.5 h-3.5" /> {t("find_directions")}
            </button>
            {place.phone && (
              <button
                onClick={onCall}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-accent/50 transition-colors active:scale-95"
                aria-label={t("find_call")}
              >
                <Phone className="w-3.5 h-3.5" /> {t("find_call")}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default FindCare;
