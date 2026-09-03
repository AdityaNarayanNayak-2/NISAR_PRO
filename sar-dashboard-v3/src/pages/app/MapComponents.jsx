import React, { useEffect, useState, useRef } from 'react';
import { useMap, useMapEvents, Rectangle } from 'react-leaflet';
import L from 'leaflet';

export function MapFlyTo({ center }) {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.flyTo(center, 8, { duration: 1.5 });
        }
    }, [center, map]);
    return null;
}

export function MapFlyToBounds({ bounds }) {
    const map = useMap();
    useEffect(() => {
        if (bounds) {
            try {
                map.flyToBounds(bounds, { padding: [60, 60], duration: 1.5, maxZoom: 9 });
            } catch (err) {
                console.warn('MapFlyToBounds failed:', err);
            }
        }
    }, [bounds, map]);
    return null;
}

export function MapEventTracker({ setCoords, setMapBounds }) {
    const map = useMap();
    useMapEvents({
        mousemove(e) {
            setCoords({ lat: e.latlng.lat.toFixed(4), lon: e.latlng.lng.toFixed(4) });
        },
        moveend(e) {
            setMapBounds(e.target.getBounds());
        }
    });
    useEffect(() => {
        setMapBounds(map.getBounds());
    }, [map, setMapBounds]);
    return null;
}

export function MapResizer() {
    const map = useMap();
    useEffect(() => {
        const container = map.getContainer();
        if (!container) return;

        map.invalidateSize();

        const resizeObserver = new ResizeObserver(() => {
            map.invalidateSize();
        });
        resizeObserver.observe(container);

        const t1 = setTimeout(() => map.invalidateSize(), 100);
        const t2 = setTimeout(() => map.invalidateSize(), 500);

        return () => {
            resizeObserver.disconnect();
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, [map]);
    return null;
}

export function MapAoiDrawer({ isDrawing, setIsDrawing, drawnAoi, setDrawnAoi, accent = '#2a8b91' }) {
    const map = useMap();
    const [startPt, setStartPt] = useState(null);
    const [currentPt, setCurrentPt] = useState(null);
    const isDrawingRef = useRef(isDrawing);

    useEffect(() => {
        isDrawingRef.current = isDrawing;
        const container = map.getContainer();
        if (isDrawing) {
            map.dragging.disable();
            if (container) container.style.cursor = 'crosshair';
        } else {
            map.dragging.enable();
            if (container) container.style.cursor = '';
            setStartPt(null);
            setCurrentPt(null);
        }
    }, [isDrawing, map]);

    useMapEvents({
        mousedown(e) {
            if (!isDrawingRef.current) return;
            setStartPt(e.latlng);
            setCurrentPt(e.latlng);
        },
        mousemove(e) {
            if (!isDrawingRef.current || !startPt) return;
            setCurrentPt(e.latlng);
        },
        mouseup(e) {
            if (!isDrawingRef.current || !startPt) return;
            const end = e.latlng;
            const minLat = Math.min(startPt.lat, end.lat);
            const maxLat = Math.max(startPt.lat, end.lat);
            const minLon = Math.min(startPt.lng, end.lng);
            const maxLon = Math.max(startPt.lng, end.lng);

            // Minimum area check (~1km x 1km)
            if (Math.abs(maxLat - minLat) > 0.01 && Math.abs(maxLon - minLon) > 0.01) {
                const bounds = [[minLat, minLon], [maxLat, maxLon]];
                const bbox = `${minLon.toFixed(4)},${minLat.toFixed(4)},${maxLon.toFixed(4)},${maxLat.toFixed(4)}`;
                setDrawnAoi({
                    bounds,
                    bbox,
                    minLat,
                    maxLat,
                    minLon,
                    maxLon,
                });
            }

            setStartPt(null);
            setCurrentPt(null);
            setIsDrawing(false);
        }
    });

    const liveBounds = startPt && currentPt ? [
        [Math.min(startPt.lat, currentPt.lat), Math.min(startPt.lng, currentPt.lng)],
        [Math.max(startPt.lat, currentPt.lat), Math.max(startPt.lng, currentPt.lng)],
    ] : null;

    return (
        <>
            {/* Live dragging preview rectangle */}
            {liveBounds && (
                <Rectangle
                    bounds={liveBounds}
                    pathOptions={{
                        color: accent,
                        weight: 2,
                        dashArray: '4, 4',
                        fillColor: accent,
                        fillOpacity: 0.2,
                    }}
                />
            )}

            {/* Confirmed Drawn AOI rectangle */}
            {!liveBounds && drawnAoi && drawnAoi.bounds && (
                <Rectangle
                    bounds={drawnAoi.bounds}
                    pathOptions={{
                        color: accent,
                        weight: 2,
                        dashArray: '6, 6',
                        fillColor: accent,
                        fillOpacity: 0.12,
                    }}
                />
            )}
        </>
    );
}
