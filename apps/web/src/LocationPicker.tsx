import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
export function LocationPicker({
  latitude,
  longitude,
  onChange,
}: {
  latitude: number;
  longitude: number;
  onChange: (latitude: number, longitude: number) => void;
}) {
  const element = useRef<HTMLDivElement>(null),
    callback = useRef(onChange);
  callback.current = onChange;
  useEffect(() => {
    const map = L.map(element.current!).setView([latitude, longitude], 15);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    const marker = L.circleMarker([latitude, longitude], {
      radius: 10,
      color: "#0d9f8b",
      fillOpacity: 1,
    }).addTo(map);
    map.on("click", (event: L.LeafletMouseEvent) => {
      marker.setLatLng(event.latlng);
      callback.current(event.latlng.lat, event.latlng.lng);
    });
    return () => {
      map.remove();
    };
  }, []);
  return (
    <div>
      <p className="muted">지도에서 정확한 인수 위치를 눌러 주세요.</p>
      <div ref={element} className="geo-map picker" />
      <p className="muted">
        선택한 위치: {latitude.toFixed(5)}, {longitude.toFixed(5)}
      </p>
    </div>
  );
}
