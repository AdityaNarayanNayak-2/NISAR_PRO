import { useEffect } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';

export function MapFlyTo({ center }) {
    const map = useMap();
    useEffect(() => { if (center) map.flyTo(center, 8, { duration: 1.5 }); }, [center, map]);
    return null;
}

export function MapEventTracker({ setCoords, setMapBounds }) {
    const map = useMap();
    useMapEvents({
        mousemove(e) { setCoords({ lat: e.latlng.lat.toFixed(4), lon: e.latlng.lng.toFixed(4) }); },
        moveend(e) { setMapBounds(e.target.getBounds()); }
    });
    useEffect(() => { setMapBounds(map.getBounds()); }, [map]);
    return null;
}
